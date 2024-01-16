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
    MAX_GAS_DEPLOYMENT, toMAS
} from '@massalabs/massa-web3';
import {getDynamicCosts, assert} from "./utils";
import {IDatastoreEntryInput} from "@massalabs/massa-web3/dist/esm/interfaces/IDatastoreEntryInput";
import {VestingSessionInfo} from "./serializables/vesting";

// Load .env file content into process.env
dotenv.config();

// Get the URL for a public JSON RPC API endpoint from the environment variables
const publicApi = process.env.JSON_RPC_URL_PUBLIC;
if (!publicApi) {
    throw new Error('Missing JSON_RPC_URL_PUBLIC in .env file');
}

// Get the secret key for the wallet to be used for the deployment from the environment variables
const secretKey = process.env.WALLET_SECRET_KEY;
if (!secretKey) {
    throw new Error('Missing WALLET_SECRET_KEY in .env file');
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

// get all the vesting sessions of the user
let addrInfo = await client
    .publicApi()
    .getAddresses([sc_addr]);
let allKeys = addrInfo[0].candidate_datastore_keys;

// console.log("allKeys:", allKeys);

/*
for(let i=0; i<allKeys.length; i++) {

}
*/

let allSessionKeys = allKeys.filter((k) => {
   return k[0] === 0x02;
});

console.log("Found", allSessionKeys.length, "session keys");
console.log("Details:");
for(let i=0; i<allSessionKeys.length; i++) {
    let session_key = allSessionKeys[i];

    let args = new Args(session_key);
    let prefix = args.nextU8();
    let addr = args.nextString();
    let sessionId = args.nextU64();

    console.log("Key", i, `: prefix: ${prefix}, addr: ${addr}, sessionId: ${sessionId}`);

    // TODO: fetch Vesting session info

    let vestingSessions = await client.publicApi().getDatastoreEntries([{
        address: sc_addr,
        key: new Uint8Array(session_key)
    }]);

    // console.log(vestingSessions);
    assert(vestingSessions.length !== 0, "Could not find vesting sessions");
    assert(vestingSessions.length === 1, "Found more than 1 vesting sessions");

    let vestingSessionBytes = vestingSessions[0].final_value;

    let vestingSession = new Args(vestingSessionBytes).nextSerializable(VestingSessionInfo);

    console.log("  - ", vestingSession);
    assert(vestingSession.toAddr === addr, "Vesting session info addr and key are !=");
    console.log("  totalAmount:", toMAS(vestingSession.totalAmount).toString(), "MAS");
    console.log("  initialReleaseAmount:", toMAS(vestingSession.initialReleaseAmount).toString(), "MAS");
    let start = new Date(Number(vestingSession.startTimestamp)).toUTCString();
    console.log("  startTimestamp (UTC)", start);

    let claimedAmountKey = new Args().addU8(3).addString(addr).addU64(sessionId).serialize();

    let claimedAmounts = await client.publicApi().getDatastoreEntries([{
        address: sc_addr,
        key: new Uint8Array(claimedAmountKey)
    }]);

    // 0 claimed amount is valid
    assert(claimedAmounts.length === 1, "Found more than 1 claimed amount");

    let claimedAmountBytes = claimedAmounts[0].final_value;
    let claimedAmount = new Args(claimedAmountBytes).nextU64();

    console.log("  - Claimed amount:", toMAS(claimedAmount).toString(), "MAS");
}



