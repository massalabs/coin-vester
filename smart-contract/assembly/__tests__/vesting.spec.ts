import {Address, call, mockScCall, resetStorage, Storage} from '@massalabs/massa-as-sdk';
import {Amount, Args, bytesToU64, Currency, u64ToBytes, u8toByte} from '@massalabs/as-types';

import {createUniqueId, isValidMAS, u64ToMAS} from "../contracts/utils";
import {createVestingSession} from "../../build/main";


/**
 * Get the vesting info storage key.
 * @param toAddr - address of the beneficiary
 * @param sessionId - vesting session ID
 * @returns the key for the claimed amount
 */
/*
function getVestingInfoKey(toAddr: Address, sessionId: u64): StaticArray<u8> {
  const prefix = u8toByte(0x02);
  return new Args().add(prefix).add(toAddr).add(sessionId).serialize();
}
*/

/**
 * Get the claimed amount storage key.
 * @param toAddr - address of the beneficiary
 * @param sessionId - vesting session ID
 * @returns the key for the claimed amount
 */
/*
function getClaimedAmountKey(toAddr: Address, sessionId: u64): StaticArray<u8> {
  const prefix = u8toByte(0x03);
  return new Args().add(prefix).add(toAddr).add(sessionId).serialize();
}
*/

/**
 * Serialize vesting info.
 * @param toAddr - target address
 * @param totalAmount - total amount to be vested
 * @param startTimestamp - start timestamp
 * @param initialReleaseAmount - initial release amount
 * @param cliffDuration - cliff duration
 * @param linearDuration - linear duration
 * @param tag - tag
 * @returns serialized bytes
 */
function serializeVestingInfo(
  toAddr: Address,
  totalAmount: Amount,
  startTimestamp: u64,
  initialReleaseAmount: Amount,
  cliffDuration: u64,
  linearDuration: u64,
  tag: String,
): StaticArray<u8> {
  return new Args()
    .add(toAddr)
    .add(totalAmount)
    .add(startTimestamp)
    .add(initialReleaseAmount)
    .add(cliffDuration)
    .add(linearDuration)
    .add(tag)
    .serialize();
}

describe('Unique id', () => {
  beforeEach(() => {
    resetStorage(); // We make sure that the contract's storage is empty before each test.
  });

  afterAll(() => {
    resetStorage(); // We make sure that the contract's storage is reset.
  });

  test('create unique id', () => {
    let id1 = createUniqueId();
    expect<u64>(id1).toBe(0);
    let id2 = createUniqueId();
    expect<u64>(id2).toBe(1);
  });
});

describe('Unique id overflow', () => {
  beforeEach(() => {
    const prefix = u8toByte(0x01);
    Storage.set(prefix, u64ToBytes(u64.MAX_VALUE));
  });

  throws('create unique id', () => {
    let id1 = createUniqueId();
  });
});

describe('Check amount', () => {

  it('Not MAS', () => {
    const usdt = new Currency("USDT", 9);
    let a = new Amount(42, usdt);
    expect(isValidMAS(a)).toBe(false);
  });
  it('Not enough precision', () => {
    const usdt5 = new Currency("MAS", 5);
    let a = new Amount(42, usdt5);
    expect(isValidMAS(a)).toBe(false);
  });
});


describe('Scenarios', () => {
  beforeEach(() => {
    resetStorage(); // We make sure that the contract's storage is empty before each test.
  });

  afterAll(() => {
    resetStorage(); // We make sure that the contract's storage is reset.
  });

  test('createSession', () => {
    const addr_1 = new Address(
      'A12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT',
    );

    // const res = call(addr, 'createVestingSession', NoArg, 0);

    let totalAmount = u64ToMAS(420);
    let initialReleaseAmount = u64ToMAS(220);
    let startTimestamp = 0;
    let cliffDuration = 10;
    let linearDuration = 5;
    let tag = "42";
    let session_args = serializeVestingInfo(
        addr_1,
        totalAmount,
        0,
        initialReleaseAmount,
        cliffDuration,
        linearDuration,
        tag
        );

    let session_id_bytes = createVestingSession(session_args);
    let session_id = bytesToU64(session_id_bytes);

    // let session_id = 1;
    log<string>(`Session 1: ${session_id}`);

  });

  /*
    expect(posts).toStrictEqual([post1]);
    expect(res).toBe(mockValue);
    expect(call).toThrow();
    */
});
