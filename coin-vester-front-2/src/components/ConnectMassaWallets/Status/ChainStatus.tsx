import { Connected, Disconnected } from '.';
import { useAccountStore } from '../../../store';

export function ChainStatus() {
  const { connectedAccount, currentProvider } = useAccountStore();

  const connected = !!connectedAccount && !!currentProvider;

  return <>{connected ? <Connected /> : <Disconnected />}</>;
}
