import {Address, balance, Context, Storage, transferCoins, generateEvent} from '@massalabs/massa-as-sdk';
import { Args } from '@massalabs/as-types';

/**
 * Create a unique ID.
 * @returns a unique ID
 */
export function createUniqueId(): u64 {
  const prefixTag: u8 = 0x01;
  const prefix = new Args().add(prefixTag).serialize();

  // get the counter
  let id: u64 = 0;
  if (Storage.has(prefix)) {
    let currentId = new Args(Storage.get(prefix)).nextU64().unwrap();
    if (currentId == u64.MAX_VALUE) {
      throw new Error('ID overflow');
    }
    id = currentId + 1;
  }

  // save the updated counter
  Storage.set(prefix, new Args().add(id).serialize());

  return id;
}

/**
 * Get the vesting info storage key.
 * @param toAddr - address of the beneficiary
 * @param sessionId - vesting session ID
 * @returns the key for the claimed amount
 */
export function getVestingInfoKey(
  toAddr: Address,
  sessionId: u64,
): StaticArray<u8> {
  const prefix: u8 = 0x02;
  return new Args().add(prefix).add(toAddr).add(sessionId).serialize();
}

/**
 * Get the claimed amount storage key.
 * @param toAddr - address of the beneficiary
 * @param sessionId - vesting session ID
 * @returns the key for the claimed amount
 */
export function getClaimedAmountKey(
  toAddr: Address,
  sessionId: u64,
): StaticArray<u8> {
  const prefix: u8 = 0x03;
  return new Args().add(prefix).add(toAddr).add(sessionId).serialize();
}

export function refund(initialBalance: u64): void {

  // generateEvent(`initialBalance: ${initialBalance}`);
  const newBalance: u64 = balance();
  // generateEvent(`newBalance: ${newBalance}`);
  // Should never assert (or something is seriously wrong in the blockchain)
  // assert(initialBalance >= newBalance, "Runtime error");
  /*
  if (initialBalance <= newBalance) {
    // No Storage modification or some Storage have been deleted
    generateEvent(`Estimated storage cost: 0`);
    return;
  }
  */

  // Set balanceDelta to 0 (No Storage modification or Storage deletion) so:
  // transferredCoins could be refund (call sc) or estimated storage cost == 0 (read sc)
  let balanceDelta: u64 = initialBalance > newBalance ? initialBalance - newBalance: 0;
  // generateEvent(`balanceDelta: ${balanceDelta}`);

  let transferredCoins = Context.transferredCoins();
  if (transferredCoins > 0) {
    // Only refund if caller has transferred too much coins (parameter coins of callSmartContract)
    let coinsToRefund = transferredCoins > balanceDelta ? transferredCoins - balanceDelta : 0;
    if (coinsToRefund > 0) {
      // generateEvent(`[refund] send back ${coinsToRefund} coins`);
      transferCoins(Context.caller(), coinsToRefund);
    }
  } else {
    // read only call - transferred coins is set to 0
    // to estimate gas cost & Storage cost
    // TEMP: need an event to retrieve gas cost
    let storageCost: u64 = balanceDelta;
    generateEvent(`Estimated storage cost: ${storageCost}`);
  }
}
