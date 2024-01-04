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

