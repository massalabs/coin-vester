import {Storage} from "@massalabs/massa-as-sdk";
import {bytesToU64, u64ToBytes, u8toByte} from "@massalabs/as-types";

/**
 * Create a unique ID.
 * @returns a unique ID
 */
export function createUniqueId(): u64 {
    const prefix = u8toByte(0x01);

    // get the counter
    let id: u64 = 0;
    if (Storage.has(prefix)) {
        let current_id: u64 = bytesToU64(Storage.get(prefix));
        assert(current_id < u64.MAX_VALUE);
        id = current_id + 1;
    }

    // save the updated counter
    Storage.set(prefix, u64ToBytes(id));

    return id;
}