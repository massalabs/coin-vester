import {Address, call, mockScCall, resetStorage, Storage} from '@massalabs/massa-as-sdk';
import {Amount, Args, bytesToU64, Currency, u64ToBytes, u8toByte} from '@massalabs/as-types';

import {createUniqueId, isValidMAS, u64ToMAS} from "../contracts/utils";
import {createVestingSession} from "../contracts/main";
import {VestingSessionInfo} from "../contracts/vesting";


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

describe("Vesting session info", () => {

  beforeEach(() => {
    resetStorage(); // We make sure that the contract's storage is empty before each test.
  });

  afterAll(() => {
    resetStorage(); // We make sure that the contract's storage is reset.
  });

  it("test 1", () => {

    const addr_1 = new Address(
        'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
    );

    let totalAmount = u64ToMAS(420);
    let initialReleaseAmount_: u64 = 220;
    let initialReleaseAmount = u64ToMAS(initialReleaseAmount_);
    let startTimestamp = 5;
    let cliffDuration = 10;
    let linearDuration = 10;
    let tag = "42";
    let session_args = serializeVestingInfo(
        addr_1,
        totalAmount,
        startTimestamp,
        initialReleaseAmount,
        cliffDuration,
        linearDuration,
        tag
    );

    let svi = new VestingSessionInfo(session_args);

    // Test amount release before startTimestamp
    expect<u64>(svi.getUnlockedAt(0).value).toBe(0);
    expect<u64>(svi.getUnlockedAt(1).value).toBe(0);
    expect(svi.getUnlockedAt(5)).toBe(initialReleaseAmount);

    // Test amount release during cliff
    expect(svi.getUnlockedAt(6)).toBe(initialReleaseAmount);
    expect(svi.getUnlockedAt(10)).toBe(initialReleaseAmount);

    // Test linear release
    for(let i=0; i<(linearDuration+1); i++) {
      expect<u64>(svi.getUnlockedAt(startTimestamp+cliffDuration+i).value).toBe(initialReleaseAmount_+(i*20));
    }

    // Test amount release after linear duration
    expect(svi.getUnlockedAt(startTimestamp+cliffDuration+linearDuration)).toBe(totalAmount);
    expect(svi.getUnlockedAt(u64.MAX_VALUE)).toBe(totalAmount);
  });

  throws("test limits 1", () => {

    const addr_1 = new Address(
        'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
    );

    let totalAmount = u64ToMAS(420);
    let initialReleaseAmount_: u64 = 220;
    let initialReleaseAmount = u64ToMAS(initialReleaseAmount_);
    let startTimestamp = 5;
    let cliffDuration = 10;
    let linearDuration = 10;
    let tag = "2".repeat(200);
    let session_args = serializeVestingInfo(
        addr_1,
        totalAmount,
        startTimestamp,
        initialReleaseAmount,
        cliffDuration,
        linearDuration,
        tag
    );

    let svi = new VestingSessionInfo(session_args);
  });

  it("test limits 2", () => {

    const addr_1 = new Address(
        'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
    );

    let totalAmount = u64ToMAS(420);
    let initialReleaseAmount_: u64 = 220;
    let initialReleaseAmount = u64ToMAS(initialReleaseAmount_);
    let startTimestamp = 5;
    let cliffDuration = 10;
    let linearDuration = u64.MAX_VALUE;
    let tag = "4242";
    let session_args = serializeVestingInfo(
        addr_1,
        totalAmount,
        startTimestamp,
        initialReleaseAmount,
        cliffDuration,
        linearDuration,
        tag
    );

    let svi = new VestingSessionInfo(session_args);

    // Test amount release before startTimestamp
    expect<u64>(svi.getUnlockedAt(0).value).toBe(0);
    expect<u64>(svi.getUnlockedAt(1).value).toBe(0);
    expect(svi.getUnlockedAt(5)).toBe(initialReleaseAmount);

    // Test amount release during cliff
    expect(svi.getUnlockedAt(6)).toBe(initialReleaseAmount);
    expect(svi.getUnlockedAt(10)).toBe(initialReleaseAmount);

    // Test amount release after linear duration
    expect(svi.getUnlockedAt(u64.MAX_VALUE)).toBeLessThan(totalAmount);
  });


  throws("test invalid initial release amount", () => {

    const addr_1 = new Address(
        'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
    );

    let totalAmount = u64ToMAS(420);
    // Note: init release amount > total amount - this should error
    let initialReleaseAmount_: u64 = 520;
    let initialReleaseAmount = u64ToMAS(initialReleaseAmount_);
    let startTimestamp = 5;
    // let cliffDuration = u64.MAX_VALUE;
    let cliffDuration = 10;
    let linearDuration = 10;
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

    let svi = new VestingSessionInfo(session_args);
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
      'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
    );
    // AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT

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

    // let session_id_bytes = createVestingSession(session_args);
    // let session_id = bytesToU64(session_id_bytes);

    // let session_id = 1;
    // log<string>(`Session 1: ${session_id}`);

  });

  /*
    expect(posts).toStrictEqual([post1]);
    expect(res).toBe(mockValue);
    expect(call).toThrow();
    */
});
