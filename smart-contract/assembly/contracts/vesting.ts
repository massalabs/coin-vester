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
    u8toByte,
    Amount,
    Currency,
} from '@massalabs/as-types';

import { u128 } from 'as-bignum/assembly';

import{isValidMAS, u64ToMAS} from "./utils";

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
            !isValidMAS(this.totalAmount)
        ) {
            throw new Error('total_amount must be in MAS.');
        }
        if (
            !isValidMAS(this.initialReleaseAmount)
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
