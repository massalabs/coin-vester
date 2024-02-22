import { useEffect, useState } from 'react';
import {
  ClientFactory,
  Args,
  Address,
  IClient,
  fromMAS,
} from '@massalabs/massa-web3';
import { IAccount, providers } from '@massalabs/wallet-provider';

import { scAddr } from '../const/sc';
import { AccordionCategory, AccordionContent } from '@massalabs/react-ui-kit';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

type vestingInfoType = {
  toAddr: Address;
  totalAmount: bigint;
  startTimestamp: bigint;
  initialReleaseAmount: bigint;
  cliffDuration: bigint;
  linearDuration: bigint;
  tag: string;
};

type vestingSessionType = {
  address: Address;
  id: bigint;
  vestingInfoKey: number[];
  claimedAmountKey: number[];
  vestingInfo?: vestingInfoType;
  claimedAmount: bigint;
  availableAmount: bigint;
};

function LegacyPage() {
  const [account, setAccount] = useState<IAccount | null>(null);
  const [client, setClient] = useState<IClient | null>(null);
  const [vestingSessions, setVestingSessions] = useState<vestingSessionType[]>(
    [],
  );

  // claim fields
  const [claimAmount, setClaimAmount] = useState<bigint[]>([]);

  // send fields
  const [sendToAddr, setSendToAddr] = useState('');
  const [sendTotalAmount, setSendTotalAmount] = useState(BigInt(0));
  const [sendInitialReleaseAmount, setSendInitialReleaseAmount] = useState(
    BigInt(0),
  );
  const [sendStartTimestamp, setSendStartTimestamp] = useState(
    BigInt(Date.now()),
  );
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

        const allProviders = await providers();

        if (!allProviders || allProviders.length === 0) {
          throw new Error('No providers available');
        }

        const massastationProvider = allProviders.find(
          (provider) => provider.name() === 'MASSASTATION',
        );

        if (!massastationProvider) {
          console.log('MASSASTATION provider not found');
          return;
        }

        const accounts = await massastationProvider.accounts();
        if (accounts.length === 0) {
          console.log('No accounts found');
          return;
        }

        setAccount(accounts[0]);
        if (!account || !massastationProvider) {
          return;
        }

        setClient(
          await ClientFactory.fromWalletProvider(massastationProvider, account),
        );
      } catch (e) {
        console.log(
          'Please install Massa Station and the wallet plugin of Massa Labs and refresh.',
        );
      }
    }

    registerAndSetProvider();
  }, [account, client]);

  useEffect(() => {
    document.title = 'Massa Coin Vester - Send';
  }, []);

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
        let userAddresses = [new Address(account.address())];

        // get all the vesting sessions of the user
        let addrInfo = await client.publicApi().getAddresses([scAddr]);
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

          // check that the address is in userAddresses, otherwise skip
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
        let newClaimAmount = [];
        for (let i = 0; i < sessions.length; i++) {
          queryKeys.push({
            address: scAddr,
            key: Uint8Array.from(sessions[i].vestingInfoKey),
          });
          queryKeys.push({
            address: scAddr,
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
      }
    }

    if (client) {
      funcGetData();
    }
  }, [client, account, claimAmount]);

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
    let serializedArg = new Args();
    serializedArg.addU64(vestingSessions[index].id);
    serializedArg.addU64(claimAmount[index]);
    let serialized = serializedArg.serialize();

    // Note: we use a fixed storage cost in order to minimize code
    let gasCost = BigInt(2550000);
    let storageCostFees = fromMAS(0);
    let opFee = BigInt(0);

    let op = await client.smartContracts().callSmartContract({
      targetAddress: scAddr,
      targetFunction: 'claimVestingSession',
      parameter: serialized,
      maxGas: gasCost,
      coins: storageCostFees,
      fee: opFee,
    });
    console.log('CLAIM SUCCESSFUL', op);
  };

  const handleDelete = async (index: number, client: IClient) => {
    // Placeholder function for delete logic

    // console.log("Deleting vesting session id:", vestingSessions[index].id);

    let serializedArg = new Args();
    serializedArg.addU64(vestingSessions[index].id);
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
    console.log('DELETE SUCCESSFUL', op);
  };

  const handleSend = async (client: IClient) => {
    // Check if target addr has enough balance for the claim
    let addrInfo = await client.publicApi().getAddresses([sendToAddr]);
    if (
      fromMAS(addrInfo[0].candidate_balance) === fromMAS('0') &&
      addrInfo[0].candidate_roll_count === 0
    ) {
      window.alert('The target address does not exist. Initializing it first.');
      // needs to send some funds to the target address
      await client.wallet().sendTransaction({
        recipientAddress: sendToAddr,
        amount: fromMAS('0.001000001'), // amount chosen to make sure the address exists and that we can detect it
        fee: fromMAS('0'),
      });
      window.alert(
        'The initialization transaction has been sent. Please wait a few seconds and try again.',
      );
      return;
    }

    // Placeholder function for send logic
    let serializedArg = new Args();
    serializedArg.addString(sendToAddr);
    serializedArg.addU64(sendTotalAmount);
    serializedArg.addU64(sendStartTimestamp);
    serializedArg.addU64(sendInitialReleaseAmount);
    serializedArg.addU64(sendCliffDuration);
    serializedArg.addU64(sendLinearDuration);
    serializedArg.addString(sendTag);
    let gasCost = BigInt(2550000);
    let storageCostFees = fromMAS(2);
    let opFee = BigInt(0);

    let op = await client.smartContracts().callSmartContract({
      targetAddress: scAddr,
      targetFunction: 'createVestingSession',
      parameter: serializedArg.serialize(),
      maxGas: gasCost,
      coins: sendTotalAmount + BigInt(storageCostFees),
      fee: opFee,
    });
    console.log('SEND SUCCESSFUL', op);
  };

  const noVestingSession =
    account !== null && client !== null && vestingSessions.length === 0;

  const noVestingSessionMessage = (
    <p>
      There are no active vesting sessions for your address:{' '}
      {account?.address()}{' '}
    </p>
  );

  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        margin: '0 auto',
        padding: '20px',
        maxWidth: '800px',
        backgroundColor: '#f7f7f7',
        boxShadow: '0 4px 8px 0 rgba(0,0,0,0.2)',
        borderRadius: '10px',
      }}
    >
      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>
        Coin Vester
      </h1>

      <h4 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>
        <p>
          This tool allows sending and receiving vested MAS tokens securely.
        </p>
        <p>
          This app requires a compatible Massa wallet. We recommend{' '}
          <a href="https://station.massa.net">Massa Station</a>
        </p>
        <p>
          The "Claim Received Funds" section displays the active vesting
          sessions targeting your wallet address.
        </p>
        <p>
          For each session, the currently available amount that can be claimed
          is displayed as "Available to Claim (nMAS)".
        </p>
        <p>
          In order to claim a certain amount from the available amount of a
          session, simply enter the amount you want to claim and press the green
          "Claim" button.
        </p>
        <p>
          Note that in order to preserve precision and remove any ambiguity, all
          displayed amounts, as well as the amounts you are expected to input
          are in nano-MAS (nMAS).
        </p>
        <p>
          This means for example that in order to claim 123.456 MAS you should
          input 123456000000.
        </p>
      </h4>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#555', marginBottom: '20px' }}>
          Claim Received Funds
        </h2>
        {vestingSessions.map((s, index) => (
          <div
            key={s.id.toString()}
            style={{
              border: '1px solid #ddd',
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '10px',
              backgroundColor: 'white',
              transition: 'box-shadow 0.3s',
              display: 'flex',
              flexDirection: 'column',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
          >
            <span>
              <strong>Tag:</strong> {s.vestingInfo!.tag}
            </span>
            <span>
              <strong>Total Amount (nMAS):</strong>{' '}
              {s.vestingInfo!.totalAmount.toString()}
            </span>
            <span>
              <strong>Start Date (unix timestamp in ms):</strong>{' '}
              {s.vestingInfo!.startTimestamp.toString()}
            </span>
            <span>
              <strong>Initial Release (nMAS):</strong>{' '}
              {s.vestingInfo!.initialReleaseAmount.toString()}
            </span>
            <span>
              <strong>Cliff Duration (ms):</strong>{' '}
              {s.vestingInfo!.cliffDuration.toString()}
            </span>
            <span>
              <strong>Linear Duration (ms):</strong>{' '}
              {s.vestingInfo!.linearDuration.toString()}
            </span>
            <span>
              <strong>Claimed (nMAS):</strong> {s.claimedAmount.toString()}
            </span>
            <span>
              <strong>Available to Claim (nMAS):</strong>{' '}
              {s.availableAmount.toString()}
            </span>
            {s.availableAmount.valueOf() > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginTop: '10px',
                }}
              >
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
                  value={claimAmount[index].toString()}
                  onChange={(e) => {
                    let newClaimAmount = [...claimAmount];
                    newClaimAmount[index] = BigInt(e.target.value);
                    setClaimAmount(newClaimAmount);
                  }}
                />
                <button
                  style={{
                    ...buttonStyle,
                    backgroundColor: '#4CAF50',
                    color: 'white',
                  }}
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

        {account === null && client === null && (
          <p>
            Your wallet is not connected, please go to{' '}
            <a href="https://station.massa.net">Massa Station</a>
          </p>
        )}

        {noVestingSession && noVestingSessionMessage}
      </section>

      <AccordionCategory
        iconOpen={<FiChevronDown />}
        iconClose={<FiChevronUp />}
        isChild={false}
        categoryTitle={<p className="mas-h2">Send Vested Funds</p>}
      >
        <AccordionContent>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '100%',
            }}
          >
            <label style={{ marginBottom: '5px' }}>Tag:</label>
            <input
              type="text"
              style={{
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
              }}
              value={sendTag}
              onChange={(e) => setSendTag(e.target.value)}
            />
            <label style={{ marginBottom: '5px' }}>Recipient Address:</label>
            <input
              type="text"
              style={{
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
              }}
              value={sendToAddr}
              onChange={(e) => setSendToAddr(e.target.value)}
            />
            <label style={{ marginBottom: '5px' }}>
              Total Amount (nano-MAS):
            </label>
            <input
              type="number"
              style={{
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                WebkitAppearance: 'none',
                MozAppearance: 'textfield',
              }}
              value={sendTotalAmount.toString()}
              onChange={(e) => setSendTotalAmount(BigInt(e.target.value))}
            />
            <label style={{ marginBottom: '5px' }}>
              Start Time (millisecond unix timestamp):
            </label>
            <input
              type="number"
              style={{
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                WebkitAppearance: 'none',
                MozAppearance: 'textfield',
              }}
              value={sendStartTimestamp.toString()}
              onChange={(e) => setSendStartTimestamp(BigInt(e.target.value))}
            />
            <label style={{ marginBottom: '5px' }}>
              Cliff Release (nano-MAS):
            </label>
            <input
              type="number"
              style={{
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                WebkitAppearance: 'none',
                MozAppearance: 'textfield',
              }}
              value={sendInitialReleaseAmount.toString()}
              onChange={(e) =>
                setSendInitialReleaseAmount(BigInt(e.target.value))
              }
            />
            <label style={{ marginBottom: '5px' }}>
              Cliff Duration (milliseconds):
            </label>
            <input
              type="number"
              style={{
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                WebkitAppearance: 'none',
                MozAppearance: 'textfield',
              }}
              value={sendCliffDuration.toString()}
              onChange={(e) => setSendCliffDuration(BigInt(e.target.value))}
            />
            <label style={{ marginBottom: '5px' }}>
              Linear release duration (milliseconds):
            </label>
            <input
              type="number"
              style={{
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                WebkitAppearance: 'none',
                MozAppearance: 'textfield',
              }}
              value={sendLinearDuration.toString()}
              onChange={(e) => setSendLinearDuration(BigInt(e.target.value))}
            />
            <button
              style={{
                ...buttonStyle,
                backgroundColor: '#008CBA',
                color: 'white',
                width: '100%',
              }}
              onClick={() => handleSend(client!)}
            >
              Send
            </button>
          </div>
        </AccordionContent>
      </AccordionCategory>
    </div>
  );
}

export default LegacyPage;
