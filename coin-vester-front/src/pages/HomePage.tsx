import { useCallback, useEffect } from 'react';
import VestingSessionCard from '../components/SessionCard/SessionCard';
import { ConnectMassaWallet } from '../components/ConnectMassaWallets/ConnectMassaWallet';
import { useAccountStore } from '../store';
import { Card } from '../components/Card';
import { useReadVestingSessions } from '../utils/read-vesting-sessions';

export default function HomePage() {
  const {
    connectedAccount,
    massaClient: client,
    currentProvider,
  } = useAccountStore();
  const { vestingSessions, error, getAccountVestingSessions } =
    useReadVestingSessions(client);

  const updateVestingSessions = useCallback(async () => {
    if (connectedAccount && client) {
      await getAccountVestingSessions(connectedAccount);
    }
  }, [connectedAccount, client, getAccountVestingSessions]);

  useEffect(() => {
    updateVestingSessions();
  }, [connectedAccount, updateVestingSessions]);

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
