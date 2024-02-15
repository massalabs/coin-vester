import { useEffect, useState } from "react";
import { ClientFactory, Args, Address, IClient } from "@massalabs/massa-web3";
import { IAccount, providers } from "@massalabs/wallet-provider";

import { vestingSessionType } from "../types/types";
import VestingSessionCard from "../components/SessionCard";

import { ReactComponent as MassaWalletIcon } from "../assets/massa_wallet.svg";
import { ReactComponent as BearbyWalletIcon } from "../assets/bearby_wallet.svg";

const sc_addr = "AS12qzyNBDnwqq2vYwvUMHzrtMkVp6nQGJJ3TETVKF5HCd4yymzJP";

export default function HomePage() {
  const [accounts, setAccounts] = useState<IAccount[]>([]);
  const [clients, setClients] = useState<{ [key: string]: IClient } | null>(
    null
  );
  const [vestingSessions, setVestingSessions] = useState<vestingSessionType[]>([
    {
      address: new Address(
        "AU12NT6c6oiYQhcXNAPRRqDudZGurJkFKcYNLPYSwYkMoEniHv8FW"
      ),
      id: BigInt(272192101),
      vestingInfoKey: [],
      claimedAmountKey: [],
      claimedAmount: BigInt(975641534401036),
      availableAmount: BigInt(62715407963),
      vestingInfo: {
        toAddr: new Address(
          "AU1qq5TsoJKeRKcxmDT1rSNaWCmGgL8iFQG8wRbWB2S9yW3WRG5r"
        ),
        totalAmount: BigInt(15000000000000000),
        startTimestamp: BigInt(1705312800000),
        initialReleaseAmount: BigInt(750000000000000),
        cliffDuration: BigInt(31536000000), // 1 year
        linearDuration: BigInt(157680000000),
        tag: "richboy",
      },
    },
  ]);

  const [error, setError] = useState<string | null>(null);

  // claim fields
  const [claimAmount, setClaimAmount] = useState<bigint[]>([]);

  async function connectToWallet(
    walletProviderName: "MASSASTATION" | "BEARBY"
  ) {
    try {
      const allProviders = await providers(true, 10000);

      if (!allProviders || allProviders.length === 0) {
        throw new Error("No providers available");
      }

      const walletProvider = allProviders.find(
        (provider) => provider.name() === walletProviderName
      );

      if (!walletProvider) {
        setError(`Wallet ${walletProviderName} not found\n
          Please make sure it is installed and running.`);
        return;
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

      console.log("Successfully connected to", walletProviderName, "wallet");
    } catch (e) {
      setError(
        `An error occurred while connecting to ${walletProviderName} wallet\n
        Please make sure it is installed and running.`
      );
      console.error(e);
    }
  }

  function disconnectFromWallet() {
    setAccounts([]);
    setClients(null);
    setVestingSessions([]);
    setError(null);
    setClaimAmount([]);
  }

  useEffect(() => {
    connectToWallet("MASSASTATION");
    document.title = "Massa Coin Vester";
  }, []);

  async function getAccountVestingSessions(account: IAccount) {
    try {
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
      let newClaimAmount = [];
      for (let i = 0; i < sessions.length; i++) {
        queryKeys.push({
          address: sc_addr,
          key: Uint8Array.from(sessions[i].vestingInfoKey),
        });
        queryKeys.push({
          address: sc_addr,
          key: Uint8Array.from(sessions[i].claimedAmountKey),
        });
        if (i < claimAmount.length) {
          newClaimAmount.push(claimAmount[i]);
        } else {
          newClaimAmount.push(BigInt(0));
        }
      }
      if (newClaimAmount.length !== claimAmount.length) {
        setClaimAmount(newClaimAmount);
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

      // sort sessions by ID
      sessions.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

      // set sessions
      setVestingSessions([...vestingSessions, ...sessions]);
      console.log(
        "Successfully fetched vesting sessions for",
        account.address(),
        "found",
        sessions.length,
        "sessions"
      );
    } catch (e) {
      setError(`An error occurred while fetching vesting sessions\n
    Please try again later.`);
      console.error(e);
    }
  }

  useEffect(() => {
    if (accounts.length > 0 && clients) {
      accounts.forEach((account) => {
        getAccountVestingSessions(account);
      });
    }
  }, [accounts]);

  // /**
  //  * Fetch session data when web3client is set
  //  */
  // useEffect(() => {
  //   /**
  //    * Function to get the list of sessions and their info
  //    */
  //   async function funcGetData() {
  //     if (client && account) {
  //       // get all the addresses of the user from their wallet
  //       // TODO, for now we support only one address
  //       let user_addresses = [new Address(account.address())];

  //       // get all the vesting sessions of the user
  //       let addrInfo = await client.publicApi().getAddresses([sc_addr]);
  //       let allKeys = addrInfo[0].candidate_datastore_keys;

  //       // list of sessions
  //       let sessions: vestingSessionType[] = [];

  //       // find the keys
  //       for (let i = 0; i < allKeys.length; i++) {
  //         let key = allKeys[i];

  //         let deser = new Args(key);
  //         let keyTag = Number(deser.nextU8());

  //         if (keyTag !== 0x02 && keyTag !== 0x03) {
  //           // only interested in VestingInfoKey & ClaimedAmountKey
  //           continue;
  //         }

  //         let keyAddress = new Address(deser.nextString());
  //         let keySessionId = deser.nextU64();

  //         // check that the address is in user_addresses, otherwise skip
  //         // Note: use filter here as there is no eq operator implemented for Address
  //         let user_addresses_filter = user_addresses.filter((addr) => {
  //           return addr.base58Encode === keyAddress.base58Encode;
  //         });
  //         if (user_addresses_filter.length === 0) {
  //           continue;
  //         }

  //         // find the session in the list of sessions
  //         let sessionIndex = sessions.findIndex((s) => s.id === keySessionId);
  //         if (sessionIndex === -1) {
  //           // create a new session
  //           sessions.push({
  //             address: keyAddress,
  //             id: keySessionId,
  //             vestingInfoKey: [],
  //             claimedAmountKey: [],
  //             claimedAmount: BigInt(0),
  //             availableAmount: BigInt(0),
  //           });
  //           sessionIndex = sessions.length - 1;
  //         }

  //         if (keyTag === 0x02) {
  //           // vesting info key
  //           sessions[sessionIndex].vestingInfoKey = key;
  //         } else if (keyTag === 0x03) {
  //           // claimed amount key
  //           sessions[sessionIndex].claimedAmountKey = key;
  //         }
  //       }

  //       // Here we have all the sessions of the user and their datastore keys.
  //       // Now get the values from the datastore.
  //       let queryKeys = [];
  //       let newClaimAmount = [];
  //       for (let i = 0; i < sessions.length; i++) {
  //         queryKeys.push({
  //           address: sc_addr,
  //           key: Uint8Array.from(sessions[i].vestingInfoKey),
  //         });
  //         queryKeys.push({
  //           address: sc_addr,
  //           key: Uint8Array.from(sessions[i].claimedAmountKey),
  //         });
  //         if (i < claimAmount.length) {
  //           newClaimAmount.push(claimAmount[i]);
  //         } else {
  //           newClaimAmount.push(BigInt(0));
  //         }
  //       }
  //       if (newClaimAmount.length !== claimAmount.length) {
  //         setClaimAmount(newClaimAmount);
  //       }
  //       let res = await client.publicApi().getDatastoreEntries(queryKeys);

  //       if (res.length !== queryKeys.length) {
  //         throw new Error("Error: datastore entries length invalid");
  //       }

  //       let now = Date.now();
  //       for (let i = 0; i < queryKeys.length; i += 2) {
  //         let vestingInfoSerialized = res[i]!.candidate_value;
  //         let claimedAmountSerialized = res[i + 1]!.candidate_value;

  //         if (
  //           vestingInfoSerialized === null ||
  //           claimedAmountSerialized === null
  //         ) {
  //           // throw error
  //           throw new Error("Error: datastore entry not found");
  //         }

  //         if (
  //           vestingInfoSerialized?.length === 0 ||
  //           claimedAmountSerialized?.length === 0
  //         ) {
  //           // Note: sometimes we got empty Uint8Array
  //           // This prevents an error in our app
  //           continue;
  //         }

  //         // deserialize the vesting info
  //         let deser = new Args(vestingInfoSerialized);

  //         let vestingInfo = {
  //           toAddr: new Address(deser.nextString()),
  //           totalAmount: deser.nextU64(),
  //           startTimestamp: deser.nextU64(),
  //           initialReleaseAmount: deser.nextU64(),
  //           cliffDuration: deser.nextU64(),
  //           linearDuration: deser.nextU64(),
  //           tag: deser.nextString(),
  //         };

  //         // deserialize the claimed amount
  //         deser = new Args(claimedAmountSerialized);
  //         let claimedAmount = deser.nextU64();
  //         // add the values to the session
  //         sessions[i / 2].vestingInfo = vestingInfo;
  //         sessions[i / 2].claimedAmount = claimedAmount;

  //         // calculate the available amount
  //         let availableAmount = BigInt(0);
  //         if (now < vestingInfo.startTimestamp) {
  //           // before start
  //           availableAmount = BigInt(0);
  //         } else if (
  //           now <
  //           vestingInfo.startTimestamp + vestingInfo.cliffDuration
  //         ) {
  //           // cliff
  //           availableAmount = vestingInfo.initialReleaseAmount;
  //         } else if (
  //           now >
  //           vestingInfo.startTimestamp +
  //             vestingInfo.cliffDuration +
  //             vestingInfo.linearDuration
  //         ) {
  //           // after linear period
  //           availableAmount = vestingInfo.totalAmount;
  //         } else {
  //           // in the linear period
  //           let timePassed =
  //             BigInt(now) -
  //             (vestingInfo.startTimestamp + vestingInfo.cliffDuration);
  //           availableAmount =
  //             vestingInfo.initialReleaseAmount +
  //             ((vestingInfo.totalAmount - vestingInfo.initialReleaseAmount) *
  //               timePassed) /
  //               vestingInfo.linearDuration;
  //         }
  //         // update the available amount
  //         sessions[i / 2].availableAmount = availableAmount - claimedAmount;
  //       }

  //       // sort sessions by ID
  //       sessions.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  //       // set sessions
  //       setVestingSessions(sessions);
  //     }
  //   }

  //   if (client) {
  //     funcGetData();
  //   }
  // }, [client, account, claimAmount]);

  // const handleClaim = async (index: number, client: IClient) => {
  //   let serialized_arg = new Args();
  //   serialized_arg.addU64(vestingSessions[index].id);
  //   serialized_arg.addU64(claimAmount[index]);
  //   let serialized = serialized_arg.serialize();

  //   // Note: we use a fixed storage cost in order to minimize code
  //   let gas_cost = BigInt(2550000);
  //   let storage_cost_fees = fromMAS(0);
  //   let op_fee = BigInt(0);

  //   let op = await client.smartContracts().callSmartContract({
  //     targetAddress: sc_addr,
  //     functionName: "claimVestingSession",
  //     parameter: serialized,
  //     maxGas: gas_cost,
  //     coins: storage_cost_fees,
  //     fee: op_fee,
  //   });
  //   console.log("CLAIM SUCCESSFUL", op);
  // };

  // const handleDelete = async (index: number, client: IClient) => {
  //   // Placeholder function for delete logic

  //   // console.log("Deleting vesting session id:", vestingSessions[index].id);

  //   let serialized_arg = new Args();
  //   serialized_arg.addU64(vestingSessions[index].id);
  //   let serialized = serialized_arg.serialize();

  //   // Note: we use a fixed storage cost in order to minimize code
  //   let gas_cost = BigInt(2550000);
  //   let storage_cost_fees = fromMAS(0);
  //   let op_fee = BigInt(0);

  //   let op = await client.smartContracts().callSmartContract({
  //     targetAddress: sc_addr,
  //     functionName: "clearVestingSession",
  //     parameter: serialized,
  //     maxGas: gas_cost,
  //     coins: storage_cost_fees,
  //     fee: op_fee,
  //   });
  //   console.log("DELETE SUCCESSFUL", op);
  // };

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
            <button>
              <MassaWalletIcon />
              Connect MassaWallet
            </button>
            <button>
              <BearbyWalletIcon />
              Connect Bearby
            </button>
          </div>
          <button className="disconnect">disconnect</button>
        </div>
      </div>
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
            This tool allows sending and receiving vested MAS tokens securely.
            <br />
            This app requires a compatible Massa wallet. We recommend{" "}
            <a href="https://station.massa.net">Massa Station</a>.<br />
            The "Claim Received Funds" section displays the active vesting
            sessions targeting your wallet address. <br />
            For each session, the currently available amount that can be claimed
            is displayed as "Available to Claim (nMAS)".
          </h4>
        </section>

        <section style={{ marginBottom: "40px" }}>
          {vestingSessions.map((s) => (
            <VestingSessionCard key={s.id.toString()} vestingSession={s} />
          ))}
        </section>
      </div>
    </div>
  );
}

// {account === null && client === null && (
//   <p>
//     Your wallet is not connected, please go to{" "}
//     <a href="https://station.massa.net">Massa Station</a>
//   </p>
// )}

// {account !== null &&
//   client !== null &&
//   vestingSessions.length === 0 && (
//     <p>
//       There are no active vesting sessions for your address:{" "}
//       {account?.address()}
//     </p>
//   )}
