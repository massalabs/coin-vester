// The entry file of your WebAssembly module.
import {
  Context,
  Storage,
  balance,
  transferCoins,
  Address,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  u64ToBytes,
  bytesToU64,
  u8toByte,
  Amount,
  Currency,
} from '@massalabs/as-types';
import { u128 } from 'as-bignum/assembly';

/**
 * Convert u64 to MAS Amount
 * @param amount - Amount in 64
 * @returns
 */
function u64ToMAS(amount: u64): Amount {
  return new Amount(amount, new Currency('MAS', 9));
}

/**
 * This function is meant to be called only one time: when the contract is deployed.
 */
export function constructor(_: StaticArray<u8>): StaticArray<u8> {
  return [];
}

/**
 * VestingSchedule structure
 */
export class VestingSessionInfo {
  toAddr: Address;
  totalAmount: Amount;
  startTimestamp: u64;
  initialReleaseAmount: Amount;
  cliffDuration: u64;
  linearDuration: u64;
  tag: string;

  constructor(bytes: StaticArray<u8>) {
    const argsObj = new Args(bytes);
    this.toAddr = argsObj
      .nextSerializable<Address>()
      .expect('Missing to_addr argument.');
    this.totalAmount = argsObj
      .nextSerializable<Amount>()
      .expect('Missing total_amount argument.');
    this.startTimestamp = argsObj
      .nextU64()
      .expect('Missing start_timestamp argument.');
    this.initialReleaseAmount = argsObj
      .nextSerializable<Amount>()
      .expect('Missing initial_release_amount argument.');
    this.cliffDuration = argsObj
      .nextU64()
      .expect('Missing cliff_duration argument.');
    this.linearDuration = argsObj
      .nextU64()
      .expect('Missing linear_duration argument.');
    this.tag = argsObj.nextString().expect('Missing tag argument.');
    if (argsObj.offset !== bytes.length) {
      throw new Error('Extra data in buffer.');
    }

    // check that the amounts have the right currency and precision (MAS, 1e-9)
    if (
      this.totalAmount.currency.name !== 'MAS' ||
      this.totalAmount.currency.minorUnit !== 9
    ) {
      throw new Error('total_amount must be in MAS.');
    }
    if (
      this.initialReleaseAmount.currency.name !== 'MAS' ||
      this.initialReleaseAmount.currency.minorUnit !== 9
    ) {
      throw new Error('initial_release_amount must be in MAS.');
    }

    // check that the initial release amount is not greater than the total amount
    if (this.initialReleaseAmount > this.totalAmount) {
      throw new Error(
        'initial_release_amount cannot be greater than total_amount.',
      );
    }
  }

  /**
   * @param currentTimestamp - current timestamp
   * @returns the amount that has been unlocked at the given timestamp
   */
  public getUnlockedAt(timestamp: u64): Amount {
    // before activation
    if (timestamp < this.startTimestamp) {
      return u64ToMAS(0);
    }

    // during cliff
    if (timestamp - this.startTimestamp < this.cliffDuration) {
      return this.initialReleaseAmount;
    }

    // time after cliff end
    const timeAfterCliffEnd =
      timestamp - this.startTimestamp - this.cliffDuration;

    // after linear release
    if (timeAfterCliffEnd >= this.linearDuration) {
      // full release
      return this.totalAmount;
    }

    // total amount to be released linearly
    const linearAmount: Amount = (
      this.totalAmount - this.initialReleaseAmount
    ).unwrap();

    // amount released linearly so far
    // use unsigned 128 bit integer to avoid overflow

    const linearReleased = u64ToMAS(
      (
        (u128.fromU64(linearAmount.value) * u128.fromU64(timeAfterCliffEnd)) /
        u128.fromU64(this.linearDuration)
      ).toU64(),
    );

    // total released amount until timestamp
    return (this.initialReleaseAmount + linearReleased).unwrap();
  }
}

/**
 * Create a unique ID.
 * @returns a unique ID
 */
function createUniqueId(): u64 {
  const prefix = u8toByte(0x01);

  // get the counter
  let id: u64 = 0;
  if (Storage.has(prefix)) {
    id = bytesToU64(Storage.get(prefix)) + 1;
  }

  // save the updated counter
  Storage.set(prefix, u64ToBytes(id));

  return id;
}

/**
 * Get the vesting info storage key.
 * @param toAddr - address of the beneficiary
 * @param sessionId - vesting session ID
 * @returns the key for the claimed amount
 */
function getVestingInfoKey(toAddr: Address, sessionId: u64): StaticArray<u8> {
  const prefix = u8toByte(0x02);
  return new Args().add(prefix).add(toAddr).add(sessionId).serialize();
}

/**
 * Get the claimed amount storage key.
 * @param toAddr - address of the beneficiary
 * @param sessionId - vesting session ID
 * @returns the key for the claimed amount
 */
function getClaimedAmountKey(toAddr: Address, sessionId: u64): StaticArray<u8> {
  const prefix = u8toByte(0x03);
  return new Args().add(prefix).add(toAddr).add(sessionId).serialize();
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
  initialSCBalance: Amount,
  internalSCCredits: Amount,
  internalSCDebits: Amount,
  callerCredit: Amount,
  callerDebit: Amount,
): void {
  // How much we charge the caller:
  // caller_cost = initial_sc_balance + internal_sc_credits + caller_debit - internal_sc_debits - get_balance()
  const callerCostPos: u128 =
    u128.fromU64(initialSCBalance.value) +
    u128.fromU64(internalSCCredits.value) +
    u128.fromU64(callerDebit.value);
  const callerCostNeg: u128 =
    u128.fromU64(internalSCDebits.value) +
    u128.fromU64(callerCredit.value) +
    u128.fromU64(balance());
  const callerPayment: Amount = u64ToMAS(Context.transferredCoins());

  if (callerCostPos >= callerCostNeg) {
    // caller needs to pay
    const delta: u128 = callerCostPos - callerCostNeg;
    if (delta > u128.fromU64(u64.MAX_VALUE)) {
      throw new Error('Overflow');
    }
    const callerCost: Amount = u64ToMAS(delta.toU64());
    if (callerPayment < callerCost) {
      // caller did not pay enough
      throw new Error(
        'Need at least ' +
          callerCost.value.toString() +
          ' elementary coin units to pay but only ' +
          callerPayment.value.toString() +
          ' were sent.',
      );
    } else if (callerPayment > callerCost) {
      // caller paid too much: send remainder back
      transferCoins(
        Context.caller(),
        (callerPayment - callerCost).unwrap().value,
      );
    }
  } else {
    const delta: u128 = callerCostNeg - callerCostPos;
    if (delta > u128.fromU64(u64.MAX_VALUE)) {
      throw new Error('Overflow');
    }

    // caller needs to be paid
    transferCoins(
      Context.caller(),
      (u64ToMAS(delta.toU64()) + callerPayment).unwrap().value,
    );
  }
}

/**
 * @param args - serialized arguments: to_addr, total_amount, start_timestamp,
 *               initial_release_amount, cliff_duration, linear_duration, tag
 * @returns the vesting session ID
 */
export function createVestingSession(args: StaticArray<u8>): StaticArray<u8> {
  // get the initial balance of the smart contract
  const initialSCBalance = u64ToMAS(balance());

  // deserialize object
  const vInfo = new VestingSessionInfo(args);

  // get unique session ID
  const sessionId = createUniqueId();

  // save vesting info
  Storage.set(getVestingInfoKey(vInfo.toAddr, sessionId), args);

  // initialize the claimed coin counter
  Storage.set(
    getClaimedAmountKey(vInfo.toAddr, sessionId),
    new Args().add(u64ToMAS(0)).serialize(),
  );

  // consolidate payment
  // `total_amount` is expected to be received by the SC as call coins
  consolidatePayment(
    initialSCBalance,
    u64ToMAS(0),
    u64ToMAS(0),
    u64ToMAS(0),
    vInfo.totalAmount,
  );

  // return session ID
  return u64ToBytes(sessionId);
}

/**
 * Claim a certain amount of coins from a vesting session.
 * @param args - serialized arguments: session_id, amount
 * @returns
 */
export function claimVestingSession(args: StaticArray<u8>): StaticArray<u8> {
  // get the initial balance of the smart contract
  const initialSCBalance = u64ToMAS(balance());

  // deserialize arguments
  let deser = new Args(args);
  const sessionId = deser.nextU64().expect('Missing session_id argument.');
  const amount: Amount = deser
    .nextSerializable<Amount>()
    .expect('Missing amount argument.');
  if (deser.offset !== args.length) {
    throw new Error('Extra data in buffer.');
  }

  // get current timestamp
  const timestamp = Context.timestamp();

  // get vesting data
  const addr = Context.caller();
  const vestingInfo = new VestingSessionInfo(
    Storage.get(getVestingInfoKey(addr, sessionId)),
  );
  const claimedAmountKey = getClaimedAmountKey(addr, sessionId);
  const claimedAmount: Amount = new Args(Storage.get(claimedAmountKey))
    .nextSerializable<Amount>()
    .expect('Missing claimed_amount.');

  // compute the claimable amount of coins
  const claimableAmount = (
    vestingInfo.getUnlockedAt(timestamp) - claimedAmount
  ).unwrap();

  // check amount
  if (amount > claimableAmount) {
    throw new Error('not enough amount unlocked to fulfill claim');
  }

  // update the claimed amount
  Storage.set(
    claimedAmountKey,
    new Args().add((claimedAmount + amount).unwrap()).serialize(),
  );

  // transfer the coins to the claimer
  transferCoins(addr, amount.value);

  // consolidate payment
  consolidatePayment(
    initialSCBalance,
    u64ToMAS(0),
    amount,
    u64ToMAS(0),
    u64ToMAS(0),
  );

  return [];
}

/**
 * Clear a finished vesting session.
 * @param args - serialized arguments: session_id
 * @returns
 */
export function clearVestingSession(args: StaticArray<u8>): StaticArray<u8> {
  // get the initial balance of the smart contract
  const initialSCBalance = u64ToMAS(balance());

  // deserialize arguments
  let deser = new Args(args);
  const sessionId = deser.nextU64().expect('Missing session_id argument.');
  if (deser.offset !== args.length) {
    throw new Error('Extra data in buffer.');
  }

  // get vesting data
  const addr = Context.caller();
  const vestingInfoKey = getVestingInfoKey(addr, sessionId);
  const vestingInfo = new VestingSessionInfo(Storage.get(vestingInfoKey));
  const claimedAmountKey = getClaimedAmountKey(addr, sessionId);
  const claimedAmount: Amount = new Args(Storage.get(claimedAmountKey))
    .nextSerializable<Amount>()
    .expect('Missing claimed_amount.');

  // check that everything was claimed
  if (claimedAmount < vestingInfo.totalAmount) {
    throw new Error('cannot delete a session that was not fully claimed');
  }

  // delete entries
  Storage.del(vestingInfoKey);
  Storage.del(claimedAmountKey);

  // consolidate payment
  consolidatePayment(
    initialSCBalance,
    u64ToMAS(0),
    u64ToMAS(0),
    u64ToMAS(0),
    u64ToMAS(0),
  );

  return [];
}
