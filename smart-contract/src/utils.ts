import {Client} from "@massalabs/massa-web3";

export async function getDynamicCosts(
    client: Client,
    targetAddress: string,
    targetFunction: string,
    parameter: number[],
): Promise<bigint> {

    const MAX_GAS = 4294167295; // Max gas for an op on Massa blockchain
    const gas_margin = 1.2;
    let estimatedGas: bigint = BigInt(MAX_GAS);
    // const prefix = "Estimated storage cost: ";
    // let estimatedStorageCost: number = 0;
    // const storage_cost_margin = 1.1;

    try {
        const readOnlyCall = await client.smartContracts().readSmartContract({
            targetAddress: targetAddress,
            targetFunction: targetFunction,
            parameter,
            maxGas: BigInt(MAX_GAS),
        });
        console.log("readOnlyCall:", readOnlyCall);
        console.log("events", readOnlyCall.info.output_events);
        console.log("===");

        estimatedGas = BigInt(Math.min(Math.floor(readOnlyCall.info.gas_cost * gas_margin), MAX_GAS));
        // let filteredEvents = readOnlyCall.info.output_events.filter((e) => e.data.includes(prefix));
        // // console.log("filteredEvents:", filteredEvents);
        // estimatedStorageCost = Math.floor(
        //     parseInt( filteredEvents[0].data.slice(prefix.length) , 10) * storage_cost_margin
        // );

    } catch (err) {
        console.log(
            `Failed to get dynamic gas cost for ${targetFunction} at ${targetAddress}. Using fallback value `,
            err,
        );
    }
    return estimatedGas;
}

export function assert(condition: unknown, msg?: string): asserts condition {
    if (condition === false) throw new Error(msg)
}