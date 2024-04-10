// The entry file of your WebAssembly module.
import {
  Context,
  Storage,
  balance,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import { Args } from '@massalabs/as-types';

import { u128 } from 'as-bignum/assembly';

import {
  createUniqueId,
  getVestingInfoKey,
  getClaimedAmountKey,
} from './utils';
import { VestingSessionInfo } from './vesting';

/**
 * This function is meant to be called only one time: when the contract is deployed.
 */
export function constructor(_: StaticArray<u8>): StaticArray<u8> {
  return [];
}

/**
 * Consolidate the necessary payment (including storage fees) to and from the caller.
 * @param initialSCBalance - The balance of the SC at the beginning of the call
 * @param internalSCCredits - Non-storage coins expected to have been received by the SC during the call
 * @param internalSCDebits - Non-storage coins expected to have been sent by the SC during the call
 * @param callerCredit - Non-storage coins expected to have been credited to the caller during the call
 * @param callerDebit - Non-storage coins expected to have been send by the caller to the SC for the call
 */
function consolidatePayment(
  initialSCBalance: u64,
  internalSCCredits: u64,
  internalSCDebits: u64,
  callerCredit: u64,
  callerDebit: u64,
): void {
  // How much we charge the caller:
  // caller_cost = initial_sc_balance + internal_sc_credits + caller_debit - internal_sc_debits - caller_credit - get_balance()
  const callerCostPos: u128 =
    u128.fromU64(initialSCBalance) +
    u128.fromU64(internalSCCredits) +
    u128.fromU64(callerDebit);
  const callerCostNeg: u128 =
    u128.fromU64(internalSCDebits) +
    u128.fromU64(callerCredit) +
    u128.fromU64(balance());
  const callerPayment: u128 = u128.fromU64(Context.transferredCoins());

  if (callerCostPos >= callerCostNeg) {
    // caller needs to pay
    const callerCost: u128 = callerCostPos - callerCostNeg;
    if (callerPayment < callerCost) {
      // caller did not pay enough
      throw new Error(
        'Need at least ' +
          callerCost.toString() +
          ' elementary coin units to pay but only ' +
          callerPayment.toString() +
          ' were sent.',
      );
    } else if (callerPayment > callerCost) {
      // caller paid too much: send remainder back
      const delta: u128 = callerPayment - callerCost;
      if (delta > u128.fromU64(u64.MAX_VALUE)) {
        throw new Error('Overflow');
      }
      transferCoins(Context.caller(), delta.toU64());
    }
  } else {
    // caller needs to be paid
    const delta: u128 = callerCostNeg - callerCostPos + callerPayment;
    if (delta > u128.fromU64(u64.MAX_VALUE)) {
      throw new Error('Overflow');
    }
    transferCoins(Context.caller(), delta.toU64());
  }
}

/**
 * @param args - serialized arguments: to_addr, total_amount, start_timestamp,
 *               initial_release_amount, cliff_duration, linear_duration, tag
 * @returns the vesting session ID
 */
export function createVestingSession(args: StaticArray<u8>): StaticArray<u8> {
  // get the initial balance of the smart contract
  const initialSCBalance = balance();

  // deserialize object
  const vInfo = new VestingSessionInfo(args);

  // get unique session ID
  const sessionId = createUniqueId();

  // save vesting info
  Storage.set(getVestingInfoKey(vInfo.toAddr, sessionId), args);

  // initialize the claimed coin counter
  const initialCounterValue: u64 = 0;
  Storage.set(
    getClaimedAmountKey(vInfo.toAddr, sessionId),
    new Args().add(initialCounterValue).serialize(),
  );

  // consolidate payment
  consolidatePayment(initialSCBalance, 0, 0, 0, vInfo.totalAmount);

  // return session ID
  return new Args().add(sessionId).serialize();
}

/**
 * Claim a certain amount of coins from a vesting session.
 * @param args - serialized arguments: session_id, amount
 * @returns
 */
export function claimVestingSession(args: StaticArray<u8>): StaticArray<u8> {
  // get the initial balance of the smart contract
  const initialSCBalance = balance();

  // deserialize arguments
  let deser = new Args(args);
  const sessionId = deser.nextU64().expect('Missing session_id argument.');
  const amount = deser.nextU64().expect('Missing amount argument.');
  if (deser.offset !== args.length) {
    throw new Error(
      `Extra data in serialized args (len: ${args.length}) after session id and amount, aborting...`,
    );
  }

  // get current timestamp
  const timestamp = Context.timestamp();

  // get vesting data
  const addr = Context.caller();
  const vestingInfo = new VestingSessionInfo(
    Storage.get(getVestingInfoKey(addr, sessionId)),
  );
  const claimedAmountKey = getClaimedAmountKey(addr, sessionId);
  const claimedAmount = new Args(Storage.get(claimedAmountKey))
    .nextU64()
    .unwrap();

  // compute the claimable amount of coins
  const claimableAmount = vestingInfo.getUnlockedAt(timestamp) - claimedAmount;

  // check amount
  if (amount > claimableAmount) {
    throw new Error('not enough amount unlocked to fulfill claim');
  }

  // update the claimed amount
  Storage.set(
    claimedAmountKey,
    new Args().add(claimedAmount + amount).serialize(),
  );

  // transfer the coins to the claimer
  transferCoins(addr, amount);

  // consolidate payment
  consolidatePayment(initialSCBalance, 0, amount, 0, 0);

  return [];
}

/**
 * Clear a finished vesting session.
 * @param args - serialized arguments: session_id
 * @returns
 */
export function clearVestingSession(args: StaticArray<u8>): StaticArray<u8> {
  // get the initial balance of the smart contract
  const initialSCBalance = balance();

  // deserialize arguments
  let deser = new Args(args);
  const sessionId = deser.nextU64().expect('Missing session_id argument.');
  if (deser.offset !== args.length) {
    throw new Error(
      `Extra data in serialized args (len: ${args.length}) after session id, aborting...`,
    );
  }

  // get vesting data
  const addr = Context.caller();
  const vestingInfoKey = getVestingInfoKey(addr, sessionId);
  const vestingInfo = new VestingSessionInfo(Storage.get(vestingInfoKey));
  const claimedAmountKey = getClaimedAmountKey(addr, sessionId);
  const claimedAmount = new Args(Storage.get(claimedAmountKey))
    .nextU64()
    .unwrap();

  // check that everything was claimed
  if (claimedAmount < vestingInfo.totalAmount) {
    throw new Error('cannot delete a session that was not fully claimed');
  }

  // delete entries
  Storage.del(vestingInfoKey);
  Storage.del(claimedAmountKey);

  // consolidate payment
  consolidatePayment(initialSCBalance, 0, 0, 0, 0);

  return [];
}
