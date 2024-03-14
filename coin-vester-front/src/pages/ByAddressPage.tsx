import { useCallback, useState } from 'react';
import { Address } from '@massalabs/massa-web3';

import VestingSessionCard from '../components/SessionCard/SessionCard';
import { ConnectMassaWallet } from '../components/ConnectMassaWallets/ConnectMassaWallet';
import { Card } from '../components/Card';

import { useAccountStore } from '../store';
import { useReadVestingSessions } from '../utils/read-vesting-sessions';
import { Button, Input } from '@massalabs/react-ui-kit';

export default function ByAddressPage() {
  const {
    connectedAccount,
    massaClient: client,
    currentProvider,
  } = useAccountStore();
  const { vestingSessions, error, getAccountVestingSessions } =
    useReadVestingSessions(client);
  const [searchValue, setSearchValue] = useState('');
  const [searchError, setSearchError] = useState<string | undefined>();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setSearchError(undefined);
    try {
      new Address(e.target.value);
    } catch (exeption) {
      setSearchError('Invalid address');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateVestingSessions();
  };

  const updateVestingSessions = useCallback(async () => {
    if (searchError) {
      return;
    }

    if (connectedAccount && client) {
      try {
        const address = new Address(searchValue);
        await getAccountVestingSessions(address);
      } catch (exeption) {
        setSearchError('Invalid address');
      }
    }
  }, [connectedAccount, client, getAccountVestingSessions, searchValue]);

  const connected = !!connectedAccount && !!currentProvider;

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
          <p className="mas-title mb-2">Coin Vester</p>
          <h4 className="mas-body">
            This tool allows receiving vested MAS tokens securely.
            <br />
            This app requires a compatible Massa wallet. We recommend{' '}
            <a className="mas-menu-underline" href="https://station.massa.net">
              Massa Station
            </a>
            .<br />
            The section below enables you to connect your wallet and, displays
            the active vesting sessions targeting your wallet address.
          </h4>
        </section>
        <section className="mb-10">
          <Card>
            <ConnectMassaWallet />
          </Card>
        </section>
        <section className="mb-10">
          {connected && (
            <form onSubmit={handleSearchSubmit}>
              <Input
                type="text"
                value={searchValue}
                onChange={handleSearchChange}
                placeholder="Search..."
                error={searchError}
              />
              <Button type="submit">Search</Button>
            </form>
          )}
        </section>
        <section className="mb-10">
          {error && (
            <Card>
              <h3 className="mas-h3">{error}</h3>
            </Card>
          )}
          {!connected ? (
            <Card>
              <h3 className="mas-h3">
                Connect a wallet to view your vesting sessions
              </h3>
            </Card>
          ) : vestingSessions.length ? (
            vestingSessions.map((s) => (
              <VestingSessionCard
                key={s.id.toString()}
                vestingSession={s}
                onUpdate={updateVestingSessions}
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
