import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deploySC, WalletClient, ISCData } from '@massalabs/massa-sc-deployer';
import {
    Args, Client,
    ClientFactory,
    DefaultProviderUrls,
    EOperationStatus,
    fromMAS,
    MAX_GAS_DEPLOYMENT
} from '@massalabs/massa-web3';
import {getDynamicCosts} from "./utils";

// Load .env file content into process.env
dotenv.config();

// Get the URL for a public JSON RPC API endpoint from the environment variables
const publicApi = process.env.JSON_RPC_URL_PUBLIC;
if (!publicApi) {
    throw new Error('Missing JSON_RPC_URL_PUBLIC in .env file');
}

// Get the secret key for the wallet to be used for the deployment from the environment variables
const secretKey = process.env.WALLET_SECRET_KEY_2;
if (!secretKey) {
    throw new Error('Missing WALLET_SECRET_KEY_2 in .env file');
}

const chainId_ = process.env.CHAIN_ID;
if (!chainId_) {
    throw new Error('Missing CHAIN_ID in .env file');
}
const chainId = BigInt(chainId_);

const sc_addr = process.env.SC_ADDR;
if (!sc_addr) {
    throw new Error('Missing SC_ADDR in .env file');
}

// Create an account using the private key
const deployerAccount = await WalletClient.getAccountFromSecretKey(secretKey);

// Obtain the current file name and directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

console.log("Account ready...");

let client = await ClientFactory.createDefaultClient(
    publicApi as DefaultProviderUrls,
    chainId,
    false,
    deployerAccount,
);

console.log("Client ready...");

// let sc_addr = "AS1VtQNYyHacsykHtCVP9CeYPB4oE4QmPvetfqqn9hb1PMLeNbmN";
// let sc_addr = "AS12tx6aLtn6GWVB9i9NRzD5GEkUezbKQYsxvdmUaKqVgNgo6sZ2f";
let vesting_session_id = BigInt(0);

console.log("Deleting Vesting session:", vesting_session_id);

let serialized_arg = new Args();
serialized_arg.addU64(vesting_session_id);
let serialized = serialized_arg.serialize();

// Estimation
let [gas_cost, storage_cost] = await getDynamicCosts(
    client as Client,
    sc_addr,
    "clearVestingSession",
    serialized
);
console.log("Estimated gas_cost", gas_cost);
console.log("Estimated storage_cost", storage_cost);
// End Estimation

let op = await client.smartContracts().callSmartContract({
    targetAddress: sc_addr,
    functionName: "clearVestingSession",
    parameter: serialized,
    maxGas: gas_cost, // BigInt(1000000000),  //TODO estimate gas
    coins: BigInt(storage_cost), // BigInt(0),
    fee: BigInt(0),   //TODO calculate fee
});
console.log("Deleting op:", op);


