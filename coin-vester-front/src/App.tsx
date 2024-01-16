import React, { useEffect, useState } from 'react';
import {
  ClientFactory,
  Args,
  Address,
  Client,
  IClient,
  fromMAS
} from "@massalabs/massa-web3";
import { IAccount, providers } from "@massalabs/wallet-provider";

const sc_addr = "AS12qzyNBDnwqq2vYwvUMHzrtMkVp6nQGJJ3TETVKF5HCd4yymzJP";

type vestingInfoType = {
  toAddr: Address,
  totalAmount: bigint,
  startTimestamp: bigint,
  initialReleaseAmount: bigint,
  cliffDuration: bigint,
  linearDuration: bigint,
  tag: String,
};

type vestingSessionType = {
  address: Address,
  id: bigint,
  vestingInfoKey: number[],
  claimedAmountKey: number[],
  vestingInfo?: vestingInfoType,
  claimedAmount: bigint,
  availableAmount: bigint,
};

function Content() {
  const [account, setAccount] = useState<IAccount | null>(null);
  const [client, setClient] = useState<IClient | null>(null);
  const [vestingSessions, setVestingSessions] = useState<vestingSessionType[]>([]);

  // claim fields
  const [claimAmount, setClaimAmount] = useState(BigInt(0));

  // send fields
  const [sendToAddr, setSendToAddr] = useState('');
  const [sendTotalAmount, setSendTotalAmount] = useState(BigInt(0));
  const [sendInitialReleaseAmount, setSendInitialReleaseAmount] = useState(BigInt(0));
  const [sendStartTimestamp, setSendStartTimestamp] = useState(BigInt(Date.now()));
  const [sendCliffDuration, setSendCliffDuration] = useState(BigInt(0));
  const [sendLinearDuration, setSendLinearDuration] = useState(BigInt(0));
  const [sendTag, setSendTag] = useState('');

  useEffect(() => {
    async function registerAndSetProvider() {
        try {

            if (account !== null && client !== null) {
              // Only update React state (account & client) once
              return;
            }

            const allProviders = await providers(true, 10000);

            if (!allProviders || allProviders.length === 0) {
              throw new Error("No providers available");
            }

            const massastationProvider = allProviders.find(provider => provider.name() === 'MASSASTATION');
            
            if (!massastationProvider) {
                console.log("MASSASTATION provider not found");
                return;
            }

            const accounts = await massastationProvider.accounts();
            if (accounts.length === 0) {
              console.log("No accounts found");
                return;
            }

            setAccount(accounts[0]);
            if (!account || !massastationProvider) {
                return;
            }

            setClient(await ClientFactory.fromWalletProvider(massastationProvider, account));

        } catch (e) {
            console.log("Please install Massa Station and the wallet plugin of Massa Labs and refresh.");
        }
    }

    registerAndSetProvider();
}, [account]);

  /**
   * Fetch session data when web3client is set
   */
  useEffect(() => {
    /**
     * Function to get the list of sessions and their info
     */
    async function funcGetData() {
      if (client && account) {
        // get all the addresses of the user from their wallet
        // TODO, for now we support only one address
        let user_addresses = [
          new Address(account.address())
        ];

        // get all the vesting sessions of the user
        let addrInfo = await client
          .publicApi()
          .getAddresses([sc_addr]);
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
            return addr.base58Encode == keyAddress.base58Encode; });
          if (user_addresses_filter.length === 0) {
            continue;
          }

          // find the session in the list of sessions
          let sessionIndex = sessions.findIndex((s) => s.id === keySessionId);
          if(sessionIndex === -1) {
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
          queryKeys.push({ address: sc_addr, key: Uint8Array.from(sessions[i].vestingInfoKey) });
          queryKeys.push({ address: sc_addr, key: Uint8Array.from(sessions[i].claimedAmountKey) });
        }
        let res = await client
          .publicApi()
          .getDatastoreEntries(queryKeys);

        if (res.length !== queryKeys.length) {
          throw new Error("Error: datastore entries length invalid");
        }

        let now = Date.now();
        for (let i = 0; i < queryKeys.length; i+=2) {
          let vestingInfoSerialized = res[i]!.candidate_value;
          let claimedAmountSerialized = res[i+1]!.candidate_value;

          if(vestingInfoSerialized === null || claimedAmountSerialized === null) {
            // throw error
            throw new Error("Error: datastore entry not found");
          }

          if (vestingInfoSerialized?.length == 0 || claimedAmountSerialized?.length === 0)
          {
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
          sessions[i/2].vestingInfo = vestingInfo;
          sessions[i/2].claimedAmount = claimedAmount;

          // calculate the available amount
          let availableAmount = BigInt(0);
          if (now < vestingInfo.startTimestamp) {
            // before start
            availableAmount = BigInt(0);
          } else if (now < vestingInfo.startTimestamp + vestingInfo.cliffDuration) {
            // cliff
            availableAmount = vestingInfo.initialReleaseAmount;
          } else if (now > vestingInfo.startTimestamp + vestingInfo.cliffDuration + vestingInfo.linearDuration) {
            // after linear period
            availableAmount = vestingInfo.totalAmount;
          } else {
            let timePassed = BigInt(now) - (vestingInfo.startTimestamp + vestingInfo.cliffDuration);
            availableAmount = vestingInfo.initialReleaseAmount + (((vestingInfo.totalAmount - vestingInfo.initialReleaseAmount) * timePassed) / vestingInfo.linearDuration);
          }
          // update the available amount
          sessions[i/2].availableAmount = availableAmount - claimedAmount;
        }

        // sort sessions by ID
        sessions.sort((a, b) => ((a.id < b.id) ? -1 : ((a.id > b.id) ? 1 : 0)));

        // set sessions
        setVestingSessions(sessions);
      }
    }

    if (client) {
      funcGetData();
    }
  }, [client, account]);

  const buttonStyle = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    outline: 'none',
    margin: '5px',
  };

  const deleteButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'red',
    color: 'white',
    marginTop: '10px',
    width: '10rem',
    padding: '10px 20px',
  };

  const handleClaim = async (index: number, client: IClient) => {
    let serialized_arg = new Args();
    serialized_arg.addU64(vestingSessions[index].id);
    serialized_arg.addU64(claimAmount);
    let serialized = serialized_arg.serialize();

    // Note: we use a fixed storage cost in order to minimize code
    let gas_cost = BigInt(2550000);
    let storage_cost_fees = fromMAS(0);
    let op_fee = BigInt(0);

    let op = await client.smartContracts().callSmartContract({
        targetAddress: sc_addr,
        functionName: "claimVestingSession",
        parameter: serialized,
        maxGas: gas_cost,
        coins: storage_cost_fees,
        fee: op_fee
    });
    console.log("CLAIM SUCCESSFUL", op);
  };

  const handleDelete = async (index: number, client: IClient) => {
    // Placeholder function for delete logic

    // console.log("Deleting vesting session id:", vestingSessions[index].id);

    let serialized_arg = new Args();
    serialized_arg.addU64(vestingSessions[index].id);
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
        fee: op_fee
    });
    console.log("DELETE SUCCESSFUL", op);
  };

  const handleSend = async (client: IClient) => {
    // Placeholder function for send logic
    let serialized_arg = new Args();
    serialized_arg.addString(sendToAddr);
    serialized_arg.addU64(sendTotalAmount);
    serialized_arg.addU64(sendStartTimestamp);
    serialized_arg.addU64(sendInitialReleaseAmount);
    serialized_arg.addU64(sendCliffDuration);
    serialized_arg.addU64(sendLinearDuration);
    serialized_arg.addString(sendTag);
    let serialized = serialized_arg.serialize();

    // Note: we use a fixed storage cost in order to minimize code
    let gas_cost = BigInt(2550000);
    let storage_cost_fees = fromMAS(2);
    let op_fee = BigInt(0);

    let op = await client.smartContracts().callSmartContract({
        targetAddress: sc_addr,
        functionName: "createVestingSession",
        parameter: serialized,
        maxGas: gas_cost,
        coins: sendTotalAmount + BigInt(storage_cost_fees),
        fee: op_fee
    });
    console.log("SEND SUCCESSFUL", op);
  }


  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      margin: '0 auto',
      padding: '20px',
      maxWidth: '800px',
      backgroundColor: '#f7f7f7',
      boxShadow: '0 4px 8px 0 rgba(0,0,0,0.2)',
      borderRadius: '10px',
    }}>
      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>Coin Vester</h1>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#555', marginBottom: '20px' }}>Claim Received Funds</h2>
        {vestingSessions.map((s, index) => (
          <div key={s.id.toString()} style={{
            border: '1px solid #ddd',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '10px',
            backgroundColor: 'white',
            transition: 'box-shadow 0.3s',
            display: 'flex',
            flexDirection: 'column',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <span><strong>Tag:</strong> {s.vestingInfo!.tag}</span>
            <span><strong>Total Amount (nMAS):</strong> {s.vestingInfo!.totalAmount.toString()}</span>
            <span><strong>Start Date (unix timestamp in ms):</strong> {s.vestingInfo!.startTimestamp.toString()}</span>
            <span><strong>Initial Release (nMAS):</strong> {s.vestingInfo!.initialReleaseAmount.toString()}</span>
            <span><strong>Cliff Duration (ms):</strong> {s.vestingInfo!.cliffDuration.toString()}</span>
            <span><strong>Linear Duration (ms):</strong> {s.vestingInfo!.linearDuration.toString()}</span>
            <span><strong>Claimed (nMAS):</strong> {s.claimedAmount.toString()}</span>
            <span><strong>Available to Claim (nMAS):</strong> {s.availableAmount.toString()}</span>
            {s.availableAmount.valueOf() > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
                <input
                  type="number"
                  style={{ 
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid #ddd',
                    marginRight: '5px',
                    WebkitAppearance: 'none', // Remove the slider for Webkit browsers
                    MozAppearance: 'textfield', // Remove the slider for Firefox
                  }}
                  value={claimAmount.toString()}
                  onChange={(e) => setClaimAmount(BigInt(e.target.value))}
                />
                <button 
                  style={{ ...buttonStyle, backgroundColor: '#4CAF50', color: 'white' }}
                  onClick={() => handleClaim(index, client!)}
                >
                  Claim
                </button>
              </div>
            )}
            {s.claimedAmount === s.vestingInfo!.totalAmount && (
              <button
                style={deleteButtonStyle}
                onClick={() => handleDelete(index, client!)}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2 style={{ color: '#555' }}>Send Vested Funds</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <label style={{ marginBottom: '5px' }}>Tag:</label>
          <input type="text" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} value={sendTag} onChange={(e) => setSendTag(e.target.value)} />
          <label style={{ marginBottom: '5px' }}>Recipient Address:</label>
          <input type="text" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} value={sendToAddr} onChange={(e) => setSendToAddr(e.target.value)} />
          <label style={{ marginBottom: '5px' }}>Total Amount (nano-MAS):</label>
          <input type="number" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            value={sendTotalAmount.toString()} onChange={(e) => setSendTotalAmount(BigInt(e.target.value))} />
          <label style={{ marginBottom: '5px' }}>Start Time (millisecond unix timestamp):</label>
          <input type="number" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            value={sendStartTimestamp.toString()} onChange={(e) => setSendStartTimestamp(BigInt(e.target.value))} />
          <label style={{ marginBottom: '5px' }}>Cliff Release (nano-MAS):</label>
          <input type="number" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            value={sendInitialReleaseAmount.toString()} onChange={(e) => setSendInitialReleaseAmount(BigInt(e.target.value))} />
          <label style={{ marginBottom: '5px' }}>Cliff Duration (milliseconds):</label>
          <input type="number" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            value={sendCliffDuration.toString()} onChange={(e) => setSendCliffDuration(BigInt(e.target.value))} />
          <label style={{ marginBottom: '5px' }}>Linear release duration (milliseconds):</label>
          <input type="number" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            value={sendLinearDuration.toString()} onChange={(e) => setSendLinearDuration(BigInt(e.target.value))} />
          <button
            style={{ ...buttonStyle, backgroundColor: '#008CBA', color: 'white', width: '100%' }}
            onClick={() => handleSend(client!)}
          >
            Send
          </button>
        </div>
      </section>
    </div>
  );
}

export default Content;
