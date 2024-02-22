import { providers as getProviders } from '@massalabs/wallet-provider';
import { useAccountStore } from '../accountStore';

export async function updateProviders() {
  const { setProviders } = useAccountStore.getState();
  const providers = await getProviders();
  setProviders(providers);
  return providers;
}

export async function handleBearbyAccountChange(newAddress: string) {
  const { connectedAccount, currentProvider, setConnectedAccount } =
    useAccountStore.getState();

  const oldAddress = connectedAccount?.address();

  if (newAddress !== oldAddress) {
    const newAccounts = await currentProvider?.accounts();

    if (newAccounts?.length) {
      // Bearby returns only one account
      const newAccount = newAccounts[0];
      setConnectedAccount(newAccount);
    }
  }
}
