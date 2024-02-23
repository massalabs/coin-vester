import { useAccountStore } from '../store';

import { Card } from '../components/Card';
import { ConnectMassaWallet } from '../components/ConnectMassaWallets/ConnectMassaWallet';

import { SendVestingCard } from '../components/SendVestingCard';

export default function HomePage() {
  const { connectedAccount, currentProvider } = useAccountStore();

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
          <p className="mas-title mb-2">Coin Vester - Send</p>
          <h4 className="mas-body">
            This part of the app allows you to create new vesting sessions.
            <br />
            This app requires a compatible Massa wallet. We recommend{' '}
            <a className="mas-menu-underline" href="https://station.massa.net">
              Massa Station
            </a>
            .<br />
          </h4>
        </section>
        <section className="mb-10">
          <Card>
            <ConnectMassaWallet />
          </Card>
        </section>
        <section className="mb-10">
          {!connected ? (
            <Card>
              <h3 className="mas-h3">
                Connect a wallet to view your vesting sessions
              </h3>
            </Card>
          ) : (
            <SendVestingCard />
          )}
        </section>
      </div>
    </div>
  );
}
