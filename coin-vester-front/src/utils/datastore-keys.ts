import { Args, Client } from '@massalabs/massa-web3';
import { SC_ADDRESS } from '../const/sc';

const VESTING_INFO_TAG = 0x02;
const CLAIMED_AMOUNT_TAG = 0x03;

interface DatastoreKeysResult {
  address: string;
  is_final: boolean;
  keys: number[][];
}

// Nodes cap the number of keys returned by one call (500 on mainnet), so we page.
const PAGE_SIZE = 500;

async function getDatastoreKeysByPrefix(
  client: Client,
  address: string,
  prefix: number[],
): Promise<number[][]> {
  const url = client.getPublicProviders()[0]?.url;
  if (!url) throw new Error('No public provider configured');

  const allKeys: number[][] = [];
  let startKey: number[] | undefined;
  for (;;) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get_addresses_datastore_keys',
        params: [
          [
            {
              address,
              prefix,
              is_final: false,
              count: PAGE_SIZE,
              ...(startKey && {
                start_key: startKey,
                inclusive_start_key: false,
              }),
            },
          ],
        ],
      }),
    });
    const json = await res.json();
    if (json.error) {
      throw new Error(
        `get_addresses_datastore_keys failed: ${json.error.message} ${
          json.error.data ?? ''
        }`,
      );
    }
    const page: number[][] = (json.result as DatastoreKeysResult[])[0].keys;
    allKeys.push(...page);
    if (page.length < PAGE_SIZE) return allKeys;
    startKey = page[page.length - 1];
  }
}

/**
 * Get the vesting-info and claimed-amount datastore keys of the vesting
 * contract that belong to the given user address.
 *
 * Keys are serialized as `Args(u8 tag, string address, u64 sessionId)`, so
 * filtering by `tag + address` prefix returns only this user's keys.
 */
export async function getUserVestingKeys(
  client: Client,
  userAddress: string,
): Promise<number[][]> {
  const prefixFor = (tag: number) =>
    new Args().addU8(tag).addString(userAddress).serialize();

  const [infoKeys, claimedKeys] = await Promise.all([
    getDatastoreKeysByPrefix(client, SC_ADDRESS, prefixFor(VESTING_INFO_TAG)),
    getDatastoreKeysByPrefix(client, SC_ADDRESS, prefixFor(CLAIMED_AMOUNT_TAG)),
  ]);
  return [...infoKeys, ...claimedKeys];
}
