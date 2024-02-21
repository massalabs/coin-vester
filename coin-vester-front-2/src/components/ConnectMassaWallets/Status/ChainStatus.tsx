import { Connected, Disconnected } from '.';
import { useAccountStore } from '../../../store';

export function ChainStatus() {
  const { connectedAccount, currentProvider } = useAccountStore();

  const isConnectMassa = !!connectedAccount;

  return (
    <>
      {isConnectMassa && !!currentProvider ? <Connected /> : <Disconnected />}
    </>
  );
}
