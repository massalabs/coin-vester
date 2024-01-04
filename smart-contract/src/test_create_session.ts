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

// let sc_addr = "AS1VtQNYyHacsykHtCVP9CeYPB4oE4QmPvetfqqn9hb1PMLeNbmN";
// let sc_addr = "AS12tx6aLtn6GWVB9i9NRzD5GEkUezbKQYsxvdmUaKqVgNgo6sZ2f";

console.log("Creating a Vesting session...");

// Placeholder function for send logic
let serialized_arg = new Args();
let sendToAddr = "AU16pM2bgEvcQe2ZN3VbQNwErjvZ8v75QgsPrEDwSX8Rrf1wcTkm";
let sendTotalAmount = BigInt(198);
let sendStartTimestamp = BigInt(Date.now());
let sendInitialReleaseAmount = BigInt(50);
let sendCliffDuration = BigInt(1000);
let sendLinearDuration = BigInt(1000);
let sendTag = "testw3 t7";

serialized_arg.addString(sendToAddr);
serialized_arg.addU64(sendTotalAmount);
serialized_arg.addU64(sendStartTimestamp);
serialized_arg.addU64(sendInitialReleaseAmount);
serialized_arg.addU64(sendCliffDuration);
serialized_arg.addU64(sendLinearDuration);
serialized_arg.addString(sendTag);
let serialized = serialized_arg.serialize();

// Estimate gas cost & storage cost

let [gas_cost, storage_cost] = await getDynamicCosts(
    client,
    sc_addr,
    "createVestingSession",
    serialized
);

console.log("e gas_cost", gas_cost);
console.log("e storage_cost", storage_cost);

// End Estimate


// let storage_fees = BigInt(99000000); // TODO calculate storage fees

let op = await client.smartContracts().callSmartContract({
    targetAddress: sc_addr,
    functionName: "createVestingSession",
    parameter: serialized,
    maxGas: gas_cost,  // BigInt(1000000000),  //TODO estimate gas
    coins: sendTotalAmount + BigInt(storage_cost), // sendTotalAmount + storage_fees,
    fee: BigInt(0),   //TODO calculate fee
});

console.log("Done creating a Vesting session:", op);

await awaitOperationFinalization(client, op);

let addrInfo = await client
    .publicApi()
    .getAddresses([sc_addr]);

console.log("Addr info:", addrInfo);

async function awaitOperationFinalization(
    web3Client: Client,
    operationId: string,
): Promise<void> {
    console.log(`Awaiting FINAL transaction status....`);
    let status: EOperationStatus;
    try {
        status = await web3Client
            .smartContracts()
            .awaitRequiredOperationStatus(
                operationId,
                EOperationStatus.FINAL_SUCCESS,
            );
        console.log(
            `Transaction with Operation ID ${operationId} has reached finality!`,
        );
    } catch (ex) {
        const msg = `Error getting finality of transaction ${operationId}`;
        console.error(msg);
        throw ex;
    }

    if (status !== EOperationStatus.FINAL_SUCCESS) {
        let msg = `Transaction ${operationId} did not reach finality after considerable amount of time.`;
        msg +=
            'Please review the transaction logs to identify potential issues or try redeploying a new contract';
        console.error(msg);
        throw new Error(msg);
    }
}
