import { useCallback, useEffect, useState } from 'react';
import {
  Args,
  Address,
  fromMAS,
  EOperationStatus,
} from '@massalabs/massa-web3';

import VestingSessionCard from '../components/SessionCard';

import { scAddr } from '../const/sc';
import { VestingSession } from '../types/types';
import { toast } from '@massalabs/react-ui-kit';
import { ConnectMassaWallet } from '../components/ConnectMassaWallets/ConnectMassaWallet';
import { IAccount } from '@massalabs/wallet-provider';
import { useAccountStore } from '../store';
import { Card } from '../components/Card';

export default function HomePage() {
  const [vestingSessions, setVestingSessions] = useState<VestingSession[]>([]);
  const [error, setError] = useState<string | null>();

  const {
    connectedAccount,
    massaClient: client,
    currentProvider,
  } = useAccountStore();

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
        let addrInfo = await client.publicApi().getAddresses([scAddr]);
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
            address: scAddr,
            key: Uint8Array.from(sessions[i].vestingInfoKey),
          });
          queryKeys.push({
            address: scAddr,
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

        // sort sessions by ID
        sessions.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

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

  const updateVestingSessions = useCallback(async () => {
    if (connectedAccount && client) {
      await getAccountVestingSessions(connectedAccount);
    }
  }, [connectedAccount, client, getAccountVestingSessions]);

  useEffect(() => {
    if (vestingSessions.length === 0 && connectedAccount) {
      updateVestingSessions();
    }
  }, [connectedAccount, updateVestingSessions, vestingSessions.length]);

  const handleClaim = async (vestingSessionId: bigint, amount: bigint) => {
    setError(null);

    const vestingSession = vestingSessions.find(
      (session) => session.id === vestingSessionId,
    );
    if (!vestingSession) {
      setError('Vesting session not found');
      return;
    }

    if (!client) {
      setError('Client not found for vesting session');
      return;
    }

    let serializedArg = new Args();
    serializedArg.addU64(vestingSession.id);
    serializedArg.addU64(amount);
    let serialized = serializedArg.serialize();

    // Note: we use a fixed storage cost in order to minimize code
    let gasCost = BigInt(2550000);
    let storageCostFees = fromMAS(0);
    let opFee = BigInt(0);

    const op = await client.smartContracts().callSmartContract({
      targetAddress: scAddr,
      targetFunction: 'claimVestingSession',
      parameter: serialized,
      maxGas: gasCost,
      coins: storageCostFees,
      fee: opFee,
    });

    const opStatusPromise = client
      .smartContracts()
      .awaitRequiredOperationStatus(op, EOperationStatus.SPECULATIVE_SUCCESS);

    toast.promise(opStatusPromise, {
      loading: (
        <div>
          Claiming...
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://explorer.massa.net/mainnet/operation/${op}`}
          >
            View on explorer
          </a>
        </div>
      ),
      success: 'Successfully claimed',
      error: 'Claim failed',
    });

    await opStatusPromise
      .finally(() => {
        updateVestingSessions();
      })
      .catch((e) => {
        console.error('Error claiming vesting session: ', e);
      });
  };

  const handleDelete = async (vestingSessionId: bigint) => {
    setError(null);

    const vestingSession = vestingSessions.find(
      (session) => session.id === vestingSessionId,
    );
    if (!vestingSession) {
      setError('Vesting session not found');
      return;
    }

    if (!client) {
      setError('Client not found for vesting session');
      return;
    }

    let serializedArg = new Args();
    serializedArg.addU64(vestingSession.id);
    let serialized = serializedArg.serialize();

    // Note: we use a fixed storage cost in order to minimize code
    let gasCost = BigInt(2550000);
    let storageCostFees = fromMAS(0);
    let opFee = BigInt(0);

    let op = await client.smartContracts().callSmartContract({
      targetAddress: scAddr,
      targetFunction: 'clearVestingSession',
      parameter: serialized,
      maxGas: gasCost,
      coins: storageCostFees,
      fee: opFee,
    });

    const opStatusPromise = client
      .smartContracts()
      .awaitRequiredOperationStatus(op, EOperationStatus.SPECULATIVE_SUCCESS);

    toast.promise(opStatusPromise, {
      loading: (
        <div>
          Deleting...
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://explorer.massa.net/mainnet/operation/${op}`}
          >
            View on explorer
          </a>
        </div>
      ),
      success: 'Successfully deleted',
      error: 'Deletion failed',
    });

    await opStatusPromise
      .finally(() => {
        updateVestingSessions();
      })
      .catch((e) => {
        console.error('Error claiming vesting session: ', e);
      });
  };

  const providerName = currentProvider?.name();

  return (
    <div className="sm:w-full md:max-w-4xl mx-auto">
      <div className="flex justify-between mb-2">
        <img
          src="/logo_massa.svg"
          alt="Massa logo"
          style={{ height: '64px' }}
        />
      </div>
      <div className="p-5">
        <section className="mb-4 p-2">
          <h2 className="mas-h2">Coin Vester</h2>
          <h4 className="mas-body">
            This tool allows receiving vested MAS tokens securely.
            <br />
            This app requires a compatible Massa wallet. We recommend{' '}
            <a href="https://station.massa.net">Massa Station</a>.<br />
            The section below displays the active vesting sessions targeting
            your wallet address.
            <br />
            For each session, the currently available amount that can be claimed
            is displayed as "Available to Claim".
          </h4>
        </section>
        <section className="mb-10">
          <Card bgColor="bg-gray-300">
            <ConnectMassaWallet />
          </Card>
        </section>
        <section className="mb-10">
          {!connectedAccount && (
            <Card>
              <h3 className="mas-h3">
                Connect a wallet to view your vesting sessions
              </h3>
            </Card>
          )}
          {error && (
            <Card>
              <h3 className="mas-h3">{error}</h3>
            </Card>
          )}
          {vestingSessions.length ? (
            vestingSessions.map((s) => (
              <VestingSessionCard
                key={s.id.toString()}
                vestingSession={s}
                accountProvider={providerName}
                accountName={connectedAccount?.name()}
                handleClaim={handleClaim}
                handleDelete={handleDelete}
              />
            ))
          ) : (
            <Card>
              <h3 className="mas-h3">No active vesting sessions</h3>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
