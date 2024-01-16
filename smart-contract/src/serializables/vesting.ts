import {IDeserializedResult, ISerializable, Args} from "@massalabs/massa-web3";
// import {Args} from "@massalabs/as-types";
// import {Address} from "@massalabs/massa-as-sdk";

export class VestingSessionInfo implements ISerializable<VestingSessionInfo> {
    // private data: number = 0; // u8
    // private heartbeat: number = 0; // u32
    // private timestamp: number = 0; // u32
    // private price: bigint = BigInt(0); // u128
    toAddr: string;
    totalAmount: bigint = BigInt(0);
    startTimestamp: bigint = BigInt(0);
    initialReleaseAmount: bigint = BigInt(0);
    cliffDuration: bigint = BigInt(0);
    linearDuration: bigint = BigInt(0);
    tag: string;

    constructor() {
        // this.data = data;
        // this.heartbeat = heartbeat;
        // this.timestamp = timestamp;
        // this.price = price;

    }

    serialize(): Uint8Array {
        let args = new Args()
            .addU8(this.data)
            .addU32(this.heartbeat)
            .addU32(this.timestamp)
            .addU128(BigInt(this.price));
        return new Uint8Array(args.serialize());
    }

    deserialize(data: Uint8Array, offset: number): IDeserializedResult<VestingSessionInfo> {
        const args = new Args(data, offset);
        // this.data = parseInt(args.nextU8().toString());
        // this.heartbeat = args.nextU32();
        // this.timestamp = args.nextU32();
        // this.price = BigInt(parseInt(args.nextU128().toString()));

        this.toAddr = args.nextString();
        this.totalAmount = args.nextU64();
        this.startTimestamp = args.nextU64();
        this.initialReleaseAmount = args.nextU64();
        this.cliffDuration = args.nextU64();
        this.linearDuration = args.nextU64();
        this.tag = args.nextString();
        return { instance: this, offset: args.offset };
    }
}