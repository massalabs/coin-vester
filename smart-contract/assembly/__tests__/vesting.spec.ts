import { Address, resetStorage, Storage } from '@massalabs/massa-as-sdk';
import { Args } from '@massalabs/as-types';
import { createUniqueId } from '../contracts/utils';
import { VestingSessionInfo } from '../contracts/vesting';

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
  totalAmount: u64,
  startTimestamp: u64,
  initialReleaseAmount: u64,
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

  afterEach(() => {
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
    resetStorage(); // We make sure that the contract's storage is empty before each test.
  });

  afterEach(() => {
    resetStorage(); // We make sure that the contract's storage is reset.
  });

  throws('create overflowing ID', () => {
    const prefixTag: u8 = 0x01;
    const prefix = new Args().add(prefixTag).serialize();
    Storage.set(prefix, new Args().add(u64.MAX_VALUE).serialize());
    createUniqueId();
  });
});

describe('Vesting session info', () => {
  beforeEach(() => {
    resetStorage(); // We make sure that the contract's storage is empty before each test.
  });

  afterEach(() => {
    resetStorage(); // We make sure that the contract's storage is reset.
  });

  it('test 1', () => {
    const addr1 = new Address(
      'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
    );

    let totalAmount: u64 = 420;
    let initialReleaseAmount: u64 = 220;
    let startTimestamp: u64 = 5;
    let cliffDuration: u64 = 10;
    let linearDuration: u64 = 10;
    let tag = '42';
    let sessionArgs = serializeVestingInfo(
      addr1,
      totalAmount,
      startTimestamp,
      initialReleaseAmount,
      cliffDuration,
      linearDuration,
      tag,
    );

    let svi = new VestingSessionInfo(sessionArgs);

    // Test amount release before startTimestamp
    expect<u64>(svi.getUnlockedAt(0)).toBe(0);
    expect<u64>(svi.getUnlockedAt(1)).toBe(0);
    expect(svi.getUnlockedAt(5)).toBe(initialReleaseAmount);

    // Test amount release during cliff
    expect(svi.getUnlockedAt(6)).toBe(initialReleaseAmount);
    expect(svi.getUnlockedAt(10)).toBe(initialReleaseAmount);

    // Test linear release
    for (let i: u64 = 0; i < linearDuration + 1; i++) {
      expect<u64>(svi.getUnlockedAt(startTimestamp + cliffDuration + i)).toBe(
        initialReleaseAmount + i * 20,
      );
    }

    // Test amount release after linear duration
    expect(
      svi.getUnlockedAt(startTimestamp + cliffDuration + linearDuration),
    ).toBe(totalAmount);
    expect(svi.getUnlockedAt(u64.MAX_VALUE)).toBe(totalAmount);
  });

  throws('test limits 1', () => {
    const addr1 = new Address(
      'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
    );

    let totalAmount: u64 = 420;
    let initialReleaseAmount: u64 = 220;
    let startTimestamp: u64 = 5;
    let cliffDuration: u64 = 10;
    let linearDuration: u64 = 10;
    let tag = '2'.repeat(200);
    let sessionArgs = serializeVestingInfo(
      addr1,
      totalAmount,
      startTimestamp,
      initialReleaseAmount,
      cliffDuration,
      linearDuration,
      tag,
    );

    new VestingSessionInfo(sessionArgs);
  });

  it('test limits 2', () => {
    const addr1 = new Address(
      'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
    );

    let totalAmount: u64 = 420;
    let initialReleaseAmount: u64 = 220;
    let startTimestamp: u64 = 5;
    let cliffDuration: u64 = 10;
    let linearDuration: u64 = u64.MAX_VALUE;
    let tag = '4242';
    let sessionArgs = serializeVestingInfo(
      addr1,
      totalAmount,
      startTimestamp,
      initialReleaseAmount,
      cliffDuration,
      linearDuration,
      tag,
    );

    let svi = new VestingSessionInfo(sessionArgs);

    // Test amount release before startTimestamp
    expect<u64>(svi.getUnlockedAt(0)).toBe(0);
    expect<u64>(svi.getUnlockedAt(1)).toBe(0);
    expect(svi.getUnlockedAt(5)).toBe(initialReleaseAmount);

    // Test amount release during cliff
    expect(svi.getUnlockedAt(6)).toBe(initialReleaseAmount);
    expect(svi.getUnlockedAt(10)).toBe(initialReleaseAmount);

    // Test amount release after linear duration
    expect(svi.getUnlockedAt(u64.MAX_VALUE)).toBeLessThan(totalAmount);
  });

  throws('test invalid initial release amount', () => {
    const addr1 = new Address(
      'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
    );

    let totalAmount: u64 = 420;
    // Note: init release amount > total amount - this should error
    let initialReleaseAmount: u64 = 520;
    let startTimestamp: u64 = 5;
    // let cliffDuration = u64.MAX_VALUE;
    let cliffDuration: u64 = 10;
    let linearDuration: u64 = 10;
    let tag = '42';
    let sessionArgs = serializeVestingInfo(
      addr1,
      totalAmount,
      startTimestamp,
      initialReleaseAmount,
      cliffDuration,
      linearDuration,
      tag,
    );

    new VestingSessionInfo(sessionArgs);
  });
});

describe('Scenarios', () => {
  beforeEach(() => {
    resetStorage(); // We make sure that the contract's storage is empty before each test.
  });

  afterEach(() => {
    resetStorage(); // We make sure that the contract's storage is reset.
  });

  test('createSession', () => {
    const addr1 = new Address(
      'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
    );
    // AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT

    // const res = call(addr, 'createVestingSession', NoArg, 0);

    let totalAmount: u64 = 420;
    let initialReleaseAmount: u64 = 220;
    let startTimestamp: u64 = 0;
    let cliffDuration: u64 = 10;
    let linearDuration: u64 = 5;
    let tag = '42';

    serializeVestingInfo(
      addr1,
      totalAmount,
      startTimestamp,
      initialReleaseAmount,
      cliffDuration,
      linearDuration,
      tag,
    );

    // ISSUE: no way to define the "coins" parameter ?

    // let sessionId = new Args(createVestingSession(sessionArgs)).nextU64().unwrap();
  });
});
