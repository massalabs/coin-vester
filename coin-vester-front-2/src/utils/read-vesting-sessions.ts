import { Address, Args, Client } from '@massalabs/massa-web3';
import { VestingSession } from '../types/types';
import { SC_ADDRESS } from '../const/sc';
import { useCallback, useState } from 'react';
import { IAccount } from '@massalabs/wallet-provider';

export function useReadVestingSessions(client?: Client) {
  const [vestingSessions, setVestingSessions] = useState<VestingSession[]>([]);
  const [error, setError] = useState<string | null>();

  const getAccountVestingSessions = useCallback(
    async (account: IAccount) => {
      try {
        setError(null);

        if (!client) {
          console.error('Client not found');
          return;
        }

        // get all the addresses of the user from their wallet
        let userAddresses = [new Address(account.address())];

        // get all the vesting sessions of the user
        let addrInfo = await client.publicApi().getAddresses([SC_ADDRESS]);
        let allKeys = addrInfo[0].candidate_datastore_keys;

        // list of sessions
        let sessions: VestingSession[] = [];

        // find the keys
        for (let i = 0; i < allKeys.length; i++) {
          let key = allKeys[i];

          let deser = new Args(key);
          let keyTag = Number(deser.nextU8());

          if (keyTag !== 0x02 && keyTag !== 0x03) {
            // only interested in VestingInfoKey & ClaimedAmountKey
            continue;
          }

          let keyAddress = new Address(deser.nextString());
          let keySessionId = deser.nextU64();

          // check that the address is in user_addresses, otherwise skip
          // Note: use filter here as there is no eq operator implemented for Address
          let userAddressesFilter = userAddresses.filter((addr) => {
            return addr.base58Encoded === keyAddress.base58Encoded;
          });
          if (userAddressesFilter.length === 0) {
            continue;
          }

          // find the session in the list of sessions
          let sessionIndex = sessions.findIndex((s) => s.id === keySessionId);
          if (sessionIndex === -1) {
            // create a new session
            sessions.push({
              address: keyAddress,
              id: keySessionId,
              vestingInfoKey: [],
              claimedAmountKey: [],
              claimedAmount: BigInt(0),
              availableAmount: BigInt(0),
            });
            sessionIndex = sessions.length - 1;
          }

          if (keyTag === 0x02) {
            // vesting info key
            sessions[sessionIndex].vestingInfoKey = key;
          } else if (keyTag === 0x03) {
            // claimed amount key
            sessions[sessionIndex].claimedAmountKey = key;
          }
        }

        // Here we have all the sessions of the user and their datastore keys.
        // Now get the values from the datastore.
        let queryKeys = [];
        // let newClaimAmount = [];
        for (let i = 0; i < sessions.length; i++) {
          queryKeys.push({
            address: SC_ADDRESS,
            key: Uint8Array.from(sessions[i].vestingInfoKey),
          });
          queryKeys.push({
            address: SC_ADDRESS,
            key: Uint8Array.from(sessions[i].claimedAmountKey),
          });
          // if (i < claimAmount.length) {
          //   newClaimAmount.push(claimAmount[i]);
          // } else {
          //   newClaimAmount.push(BigInt(0));
          // }
        }
        // if (newClaimAmount.length !== claimAmount.length) {
        //   setClaimAmount(newClaimAmount);
        // }
        let res = await client.publicApi().getDatastoreEntries(queryKeys);

        if (res.length !== queryKeys.length) {
          throw new Error('Error: datastore entries length invalid');
        }

        let now = Date.now();
        for (let i = 0; i < queryKeys.length; i += 2) {
          let vestingInfoSerialized = res[i]!.candidate_value;
          let claimedAmountSerialized = res[i + 1]!.candidate_value;

          if (
            vestingInfoSerialized === null ||
            claimedAmountSerialized === null
          ) {
            // throw error
            throw new Error('Error: datastore entry not found');
          }

          if (
            vestingInfoSerialized?.length === 0 ||
            claimedAmountSerialized?.length === 0
          ) {
            // Note: sometimes we got empty Uint8Array
            // This prevents an error in our app
            console.error('Empty datastore entry');
            continue;
          }

          // deserialize the vesting info
          let deser = new Args(vestingInfoSerialized);

          let vestingInfo = {
            toAddr: new Address(deser.nextString()),
            totalAmount: deser.nextU64(),
            startTimestamp: deser.nextU64(),
            initialReleaseAmount: deser.nextU64(),
            cliffDuration: deser.nextU64(),
            linearDuration: deser.nextU64(),
            tag: deser.nextString(),
          };

          // deserialize the claimed amount
          deser = new Args(claimedAmountSerialized);
          let claimedAmount = deser.nextU64();
          // add the values to the session
          sessions[i / 2].vestingInfo = vestingInfo;
          sessions[i / 2].claimedAmount = claimedAmount;

          // calculate the available amount
          let availableAmount = BigInt(0);
          if (now < vestingInfo.startTimestamp) {
            // before start
            availableAmount = BigInt(0);
          } else if (
            now <
            vestingInfo.startTimestamp + vestingInfo.cliffDuration
          ) {
            // cliff
            availableAmount = vestingInfo.initialReleaseAmount;
          } else if (
            now >
            vestingInfo.startTimestamp +
              vestingInfo.cliffDuration +
              vestingInfo.linearDuration
          ) {
            // after linear period
            availableAmount = vestingInfo.totalAmount;
          } else {
            // in the linear period
            let timePassed =
              BigInt(now) -
              (vestingInfo.startTimestamp + vestingInfo.cliffDuration);
            availableAmount =
              vestingInfo.initialReleaseAmount +
              ((vestingInfo.totalAmount - vestingInfo.initialReleaseAmount) *
                timePassed) /
                vestingInfo.linearDuration;
          }
          // update the available amount
          sessions[i / 2].availableAmount = availableAmount - claimedAmount;
        }

        // sort sessions by total amount
        sessions.sort((a, b) =>
          (a.vestingInfo?.totalAmount ?? 0n) >
          (b.vestingInfo?.totalAmount ?? 0n)
            ? -1
            : 1,
        );

        // set sessions
        setVestingSessions(sessions);
      } catch (e) {
        setError(`An error occurred while fetching vesting sessions\n
    Please try again later.`);
        console.error(e);
      }
    },
    [client],
  );

  return {
    error,
    vestingSessions,
    getAccountVestingSessions,
  };
}
