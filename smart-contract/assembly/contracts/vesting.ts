import { Address } from '@massalabs/massa-as-sdk';
import { Args } from '@massalabs/as-types';

import { u128 } from 'as-bignum/assembly';

const MAX_TAG_LEN: i32 = 127;

/**
 * VestingSchedule structure
 */
export class VestingSessionInfo {
  toAddr: Address;
  totalAmount: u64;
  startTimestamp: u64;
  initialReleaseAmount: u64;
  cliffDuration: u64;
  linearDuration: u64;
  tag: string;

  constructor(bytes: StaticArray<u8>) {
    const argsObj = new Args(bytes);
    this.toAddr = argsObj
      .nextSerializable<Address>()
      .expect('Missing to_addr argument.');
    this.totalAmount = argsObj
      .nextU64()
      .expect('Missing total_amount argument.');
    this.startTimestamp = argsObj
      .nextU64()
      .expect('Missing start_timestamp argument.');
    this.initialReleaseAmount = argsObj
      .nextU64()
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

    if (this.tag.length > MAX_TAG_LEN) {
      throw new Error('Tag is too long');
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
  public getUnlockedAt(timestamp: u64): u64 {
    // before activation
    if (timestamp < this.startTimestamp) {
      return 0;
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
    const linearAmount = this.totalAmount - this.initialReleaseAmount;

    // amount released linearly so far
    // use unsigned 128 bit integer to avoid overflow

    const linearReleased = (
      (u128.fromU64(linearAmount) * u128.fromU64(timeAfterCliffEnd)) /
      u128.fromU64(this.linearDuration)
    ).toU64();

    // total released amount until timestamp
    return this.initialReleaseAmount + linearReleased;
  }
}
