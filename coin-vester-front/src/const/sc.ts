import { fromMAS } from '@massalabs/massa-web3';

export const SC_ADDRESS = import.meta.env.VITE_SC_ADDRESS;
export const VESTING_SESSION_STORAGE_COST = fromMAS(2);
export const DEFAULT_OP_FEES = import.meta.env.VITE_OP_FEES;
