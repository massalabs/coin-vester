import { ProvidersListener } from '@massalabs/wallet-provider';
import { useAccountStore } from './accountStore';
// import { updateProviders } from './helpers/massaProviders';
import { _getFromStorage } from '../utils/storage';
// import { LAST_USED_ACCOUNT } from '../const/const';
export { useAccountStore } from './accountStore';

async function initAccountStore() {
  // For now, don't load the last used account.

  // const providers = await updateProviders();

  // const storedAccount = _getFromStorage(LAST_USED_ACCOUNT);
  // if (storedAccount) {
  //   const { provider: lastUsedProvider } = JSON.parse(storedAccount);
  //   const provider = providers.find((p) => p.name() === lastUsedProvider);
  //   if (provider) {
  //     useAccountStore.getState().setCurrentProvider(provider);
  //   }
  // }

  new ProvidersListener().subscribe((providers) => {
    useAccountStore.getState().setProviders(providers);
  });
}

async function initializeStores() {
  await initAccountStore();
}

initializeStores();
