import { Address } from '@massalabs/massa-web3';

export type VestingInfo = {
  toAddr: Address;
  totalAmount: bigint;
  startTimestamp: bigint;
  initialReleaseAmount: bigint;
  cliffDuration: bigint;
  linearDuration: bigint;
  tag: string;
};

export type VestingSession = {
  address: Address;
  id: bigint;
  vestingInfoKey: number[];
  claimedAmountKey: number[];
  vestingInfo?: VestingInfo;
  claimedAmount: bigint;
  availableAmount: bigint;
};
