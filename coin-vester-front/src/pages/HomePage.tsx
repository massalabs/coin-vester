import { useCallback, useEffect, useState } from "react";
import {
  ClientFactory,
  Args,
  Address,
  IClient,
  fromMAS,
  EOperationStatus,
} from "@massalabs/massa-web3";
import { IAccount, providers } from "@massalabs/wallet-provider";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import VestingSessionCard from "../components/SessionCard";

import { ReactComponent as MassaWalletIcon } from "../assets/massa_wallet.svg";
import { ReactComponent as BearbyWalletIcon } from "../assets/bearby_wallet.svg";

import { sc_addr } from "../constants/sc";
import { SupportedWallets, vestingSessionType } from "../types/types";
import { formatAddress } from "../utils";

export default function HomePage() {
  const [accounts, setAccounts] = useState<IAccount[]>([]);
  const [clients, setClients] = useState<{ [key: string]: IClient } | null>(
    null
  );
  const [vestingSessions, setVestingSessions] = useState<vestingSessionType[]>(
    []
  );

  const [connectedWallet, setConnectedWallet] =
    useState<SupportedWallets | null>(null);
  const [error, setError] = useState<string | null>();

  async function connectToWallet(walletProviderName: SupportedWallets) {
    try {
      setError(null);
      const allProviders = await providers(true, 10000);

      if (!allProviders || allProviders.length === 0) {
        throw new Error("No providers available");
      }

      const walletProvider = allProviders.find(
        (provider) => provider.name() === walletProviderName
      );

      if (!walletProvider) {
        setError(
          `Wallet ${walletProviderName} not found. Please make sure it is installed and running.`
        );
        return;
      }

      const isConnected = await walletProvider.connect();
      if (!isConnected) {
        throw new Error(`Failed to connect to ${walletProviderName} wallet`);
      }

      const providerAccounts = await walletProvider.accounts();
      if (providerAccounts.length === 0) {
        setError(`No accounts found in ${walletProviderName} wallet`);
        return;
      }

      setAccounts([...accounts, ...providerAccounts]);

      let newClients = { ...clients };
      for (let account of providerAccounts) {
        newClients[account.address()] = await ClientFactory.fromWalletProvider(
          walletProvider,
          account
        );
      }

      setClients(newClients);
      setConnectedWallet(walletProviderName);
    } catch (e) {
      setError(
        `An error occurred while connecting to ${walletProviderName} wallet. 
        Please make sure it is installed and running.`
      );
      console.error(e);
    }
  }

  function disconnectFromWallets() {
    setAccounts([]);
    setClients(null);
    setVestingSessions([]);
    setError(null);
    setConnectedWallet(null);
  }

  async function getAccountVestingSessions(account: IAccount) {
    try {
      setError(null);

      if (!clients) {
        throw new Error("No clients available");
      }
      const client = clients[account.address()];
      if (!client) {
        throw new Error("Client not found");
      }
      // get all the addresses of the user from their wallet
      // TODO, for now we support only one address
      let user_addresses = [new Address(account.address())];

      // get all the vesting sessions of the user
      let addrInfo = await client.publicApi().getAddresses([sc_addr]);
      let allKeys = addrInfo[0].candidate_datastore_keys;

      // list of sessions
      let sessions: vestingSessionType[] = [];

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
        let user_addresses_filter = user_addresses.filter((addr) => {
          return addr.base58Encode === keyAddress.base58Encode;
        });
        if (user_addresses_filter.length === 0) {
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
      for (let i = 0; i < sessions.length; i++) {
        queryKeys.push({
          address: sc_addr,
          key: Uint8Array.from(sessions[i].vestingInfoKey),
        });
        queryKeys.push({
          address: sc_addr,
          key: Uint8Array.from(sessions[i].claimedAmountKey),
        });
      }
      let res = await client.publicApi().getDatastoreEntries(queryKeys);

      if (res.length !== queryKeys.length) {
        throw new Error("Error: datastore entries length invalid");
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
          throw new Error("Error: datastore entry not found");
        }

        if (
          vestingInfoSerialized?.length === 0 ||
          claimedAmountSerialized?.length === 0
        ) {
          // Note: sometimes we got empty Uint8Array
          // This prevents an error in our app
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

      // set sessions
      setVestingSessions((prevSessions) => {
        const oldSessions = prevSessions.filter(
          (session) => session.address.base58Encode !== account.address()
        );

        return [...oldSessions, ...sessions].sort((a, b) =>
          (a.vestingInfo?.totalAmount || 0) <= (b.vestingInfo?.totalAmount || 0)
            ? 1
            : -1
        );
      });
    } catch (e) {
      setError(`An error occurred while fetching vesting sessions\n
    Please try again later.`);
      console.error(e);
    }
  }

  const updateVestingSessions = useCallback(() => {
    if (accounts.length > 0 && clients) {
      accounts.forEach((account) => {
        getAccountVestingSessions(account);
      });
    }
  }, [accounts, clients]);
  
  useEffect(() => {
    updateVestingSessions();
  }, [updateVestingSessions]);

  const handleClaim = async (vestingSessionId: bigint, amount: bigint) => {
    setError(null);

    const vestingSession = vestingSessions.find(
      (session) => session.id === vestingSessionId
    );
    if (!vestingSession) {
      setError("Vesting session not found");
      return;
    }

    const client = clients?.[vestingSession.address.base58Encode];
    if (!client) {
      setError("Client not found for vesting session");
      return;
    }

    let serialized_arg = new Args();
    serialized_arg.addU64(vestingSession.id);
    serialized_arg.addU64(amount);
    let serialized = serialized_arg.serialize();

    // Note: we use a fixed storage cost in order to minimize code
    let gas_cost = BigInt(2550000);
    let storage_cost_fees = fromMAS(0);
    let op_fee = BigInt(0);

    const op = await client.smartContracts().callSmartContract({
      targetAddress: sc_addr,
      functionName: "claimVestingSession",
      parameter: serialized,
      maxGas: gas_cost,
      coins: storage_cost_fees,
      fee: op_fee,
    });

    const opStatusPromise = client
      .smartContracts()
      .awaitRequiredOperationStatus(op, EOperationStatus.SPECULATIVE_SUCCESS);

    toast.promise(opStatusPromise, {
      pending: {
        render() {
          return (
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
          );
        },
      },
      success: {
        render: "Successfully claimed",
      },
      error: {
        render: "Claim failed",
      },
    });

    await opStatusPromise
      .finally(() => {
        updateVestingSessions();
      })
      .catch((e) => {
        console.error("Error claiming vesting session: ", e);
      });
  };

  const handleDelete = async (vestingSessionId: bigint) => {
    setError(null);

    const vestingSession = vestingSessions.find(
      (session) => session.id === vestingSessionId
    );
    if (!vestingSession) {
      setError("Vesting session not found");
      return;
    }

    const client = clients?.[vestingSession.address.base58Encode];
    if (!client) {
      setError("Client not found for vesting session");
      return;
    }

    let serialized_arg = new Args();
    serialized_arg.addU64(vestingSession.id);
    let serialized = serialized_arg.serialize();

    // Note: we use a fixed storage cost in order to minimize code
    let gas_cost = BigInt(2550000);
    let storage_cost_fees = fromMAS(0);
    let op_fee = BigInt(0);

    let op = await client.smartContracts().callSmartContract({
      targetAddress: sc_addr,
      functionName: "clearVestingSession",
      parameter: serialized,
      maxGas: gas_cost,
      coins: storage_cost_fees,
      fee: op_fee,
    });

    const opStatusPromise = client
      .smartContracts()
      .awaitRequiredOperationStatus(op, EOperationStatus.SPECULATIVE_SUCCESS);

    toast.promise(opStatusPromise, {
      pending: {
        render() {
          return (
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
          );
        },
      },
      success: {
        render: "Successfully deleted",
      },
      error: {
        render: "Deletion failed",
      },
    });

    await opStatusPromise
      .finally(() => {
        updateVestingSessions();
      })
      .catch((e) => {
        console.error("Error claiming vesting session: ", e);
      });
  };

  // We get the list of accounts that do not have any vesting sessions
  const walletsWithVesting = vestingSessions.map(
    (session) => session.address.base58Encode
  );
  const walletsWithNoVesting = accounts.filter(
    (account) => !walletsWithVesting.includes(account.address())
  );

  return (
    <div
      style={{
        fontFamily: "Urbane, sans-serif",
      }}
    >
      <div className="app-header">
        <img
          src="/logo_massa.svg"
          alt="Massa logo"
          className="logo"
          style={{ height: "64px" }}
        />
        <div className="button-container">
          <div className="connect-buttons">
            {!connectedWallet && (
              <>
                <button onClick={() => connectToWallet("MASSASTATION")}>
                  <MassaWalletIcon />
                  Connect MassaWallet
                </button>
                <button onClick={() => connectToWallet("BEARBY")}>
                  <BearbyWalletIcon />
                  Connect Bearby
                </button>
              </>
            )}
          </div>
          {connectedWallet && (
            <>
              <button disabled>
                {connectedWallet === "MASSASTATION" ? (
                  <MassaWalletIcon />
                ) : (
                  <BearbyWalletIcon />
                )}
                Connected
              </button>
              <button className="disconnect" onClick={disconnectFromWallets}>
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>
      <ToastContainer />
      <div className="app-body">
        <section
          style={{
            marginBottom: "20px",
            marginLeft: "8px",
            marginRight: "8px",
          }}
        >
          <h1 className="title">Coin Vester</h1>
          <h4 className="description">
            This tool allows receiving vested MAS tokens securely.
            <br />
            This app requires a compatible Massa wallet. We recommend{" "}
            <a href="https://station.massa.net">Massa Station</a>.<br />
            The section below displays the active vesting sessions targeting
            your wallet address.
            <br />
            For each session, the currently available amount that can be claimed
            is displayed as "Available to Claim".
          </h4>
        </section>
        <section style={{ marginBottom: "40px" }}>
          {!connectedWallet && (
            <div className="vesting-session-card">
              <div className="header">
                <h3>Connect a wallet to view your vesting sessions</h3>
              </div>
            </div>
          )}
          {error ? (
            <div className="vesting-session-card">
              <div className="header">
                <h3>Error</h3>
              </div>
              <div className="total-amount">{error}</div>
            </div>
          ) : (
            <>
              {vestingSessions.map((s) => (
                <VestingSessionCard
                  key={s.id.toString()}
                  vestingSession={s}
                  accountProvider={connectedWallet ?? undefined}
                  accountName={accounts
                    .find((a) => a.address() === s.address.base58Encode)
                    ?.name()}
                  handleClaim={handleClaim}
                  handleDelete={handleDelete}
                />
              ))}
              {walletsWithNoVesting.map((account) => (
                <div className="vesting-session-card" key={account.address()}>
                  <div className="header">
                    <div className="avatar-container">
                      {connectedWallet === "MASSASTATION" ? (
                        <MassaWalletIcon
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                          }}
                        />
                      ) : connectedWallet === "BEARBY" ? (
                        <BearbyWalletIcon />
                      ) : null}
                      <h3 style={{ marginLeft: "8px" }}>
                        {account.name() ? account.name() : "Account"} -{" "}
                        {formatAddress(account.address())}
                      </h3>
                    </div>
                  </div>
                  <div className="total-amount">
                    No active vesting sessions for this address
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
