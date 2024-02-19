import { Address } from "@massalabs/massa-web3";

export type vestingInfoType = {
  toAddr: Address;
  totalAmount: bigint;
  startTimestamp: bigint;
  initialReleaseAmount: bigint;
  cliffDuration: bigint;
  linearDuration: bigint;
  tag: String;
};

export type vestingSessionType = {
  address: Address;
  id: bigint;
  vestingInfoKey: number[];
  claimedAmountKey: number[];
  vestingInfo?: vestingInfoType;
  claimedAmount: bigint;
  availableAmount: bigint;
};

export type SupportedWallets = "MASSASTATION" | "BEARBY";
