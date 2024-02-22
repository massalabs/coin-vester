import { Client, ClientFactory } from '@massalabs/massa-web3';
import { IAccount, IProvider } from '@massalabs/wallet-provider';
import { _getFromStorage, _setInStorage } from '../utils/storage';
import { create } from 'zustand';
import { handleBearbyAccountChange } from './helpers/massaProviders';
import { LAST_USED_ACCOUNT } from '../const/const';
import { SUPPORTED_MASSA_WALLETS } from '../const/connect-massa-wallet';

export interface AccountStoreState {
  connectedAccount?: IAccount;
  massaClient?: Client;
  accounts?: IAccount[];
  currentProvider?: IProvider;
  providers: IProvider[];
  isFetching: boolean;
  accountObserver?: {
    unsubscribe: () => void;
  };
  networkObserver?: {
    unsubscribe: () => void;
  };
  connectedNetwork?: string;

  setCurrentProvider: (provider?: IProvider) => void;
  setProviders: (providers: IProvider[]) => void;

  setConnectedAccount: (account?: IAccount) => void;
  refreshMassaClient: () => void;
}

export const useAccountStore = create<AccountStoreState>((set, get) => ({
  accounts: undefined,
  connectedAccount: undefined,
  accountObserver: undefined,
  networkObserver: undefined,
  massaClient: undefined,
  currentProvider: undefined,
  providers: [],
  isFetching: false,
  connectedNetwork: undefined,

  setCurrentProvider: (currentProvider?: IProvider) => {
    try {
      set({ isFetching: true });

      const previousProvider = get().currentProvider;

      if (previousProvider?.name() !== currentProvider?.name()) {
        get().accountObserver?.unsubscribe();
        get().networkObserver?.unsubscribe();
        set({ accountObserver: undefined, networkObserver: undefined });
      }
      if (!currentProvider) {
        set({
          currentProvider,
          connectedAccount: undefined,
          accounts: undefined,
        });
        return;
      }

      let lastUsedAccount = '';
      const storedAccount = _getFromStorage(LAST_USED_ACCOUNT);
      if (storedAccount) {
        const { provider, address } = JSON.parse(storedAccount);
        if (provider === currentProvider?.name()) {
          lastUsedAccount = address;
        }
      }

      if (!get().networkObserver) {
        const networkObserver = currentProvider.listenNetworkChanges(
          (newNetwork: string) => {
            get().refreshMassaClient();
            set({ connectedNetwork: newNetwork });
          },
        );
        set({ networkObserver });
      }

      if (currentProvider?.name() === SUPPORTED_MASSA_WALLETS.BEARBY) {
        currentProvider
          .connect()
          .then(() => {
            // get current network
            currentProvider
              .getNetwork()
              .then((network) => {
                set({ connectedNetwork: network });
              })
              .catch((error) => {
                console.warn('error getting network from bearby', error);
              });
            // subscribe to network events
            const observer = currentProvider.listenAccountChanges(
              (newAddress: string) => {
                handleBearbyAccountChange(newAddress);
              },
            );
            set({ currentProvider, accountObserver: observer });

            // get connected account
            currentProvider
              .accounts()
              .then((accounts) => {
                // bearby expose only 1 account
                get().setConnectedAccount(accounts[0]);
                set({ accounts });
              })
              .catch((error) => {
                console.warn('error getting accounts from bearby', error);
              });
          })
          .catch((error) => {
            console.warn('error connecting to bearby', error);
          });
        return;
      }

      set({ currentProvider });

      currentProvider
        .accounts()
        .then((accounts) => {
          set({ accounts });

          const selectedAccount =
            accounts.find((account) => account.address() === lastUsedAccount) ||
            accounts[0];
          get().setConnectedAccount(selectedAccount);
        })
        .catch((error) => {
          console.warn('error getting accounts from provider', error);
        });
    } finally {
      set({ isFetching: false });
    }
  },

  setProviders: (providers: IProvider[]) => {
    set({ providers });

    // if current provider is not in the new list of providers, unset it
    if (!providers.some((p) => p.name() === get().currentProvider?.name())) {
      set({
        massaClient: undefined,
        currentProvider: undefined,
        connectedAccount: undefined,
        accounts: undefined,
      });
    }
  },

  // set the connected account, and update the massa client
  setConnectedAccount: async (connectedAccount?: IAccount) => {
    set({ connectedAccount });
    if (connectedAccount) {
      const currentProvider = get().currentProvider;
      if (!currentProvider) throw new Error('No provider found');
      const provider = currentProvider;
      _setInStorage(
        LAST_USED_ACCOUNT,
        JSON.stringify({
          provider: provider?.name(),
          address: connectedAccount.address(),
        }),
      );
      // update the massa client with the new account
      set({
        massaClient: await ClientFactory.fromWalletProvider(
          provider,
          connectedAccount,
        ),
      });
    }
  },

  refreshMassaClient: async () => {
    const provider = get().currentProvider;
    if (!provider) return;

    const connectedAccount = get().connectedAccount;
    if (!connectedAccount) return;
    set({
      massaClient: await ClientFactory.fromWalletProvider(
        provider,
        connectedAccount,
      ),
    });
  },
}));
