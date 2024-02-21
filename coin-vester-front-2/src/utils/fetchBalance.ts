import { toast } from '@massalabs/react-ui-kit';
import { IAccount, IAccountBalanceResponse } from '@massalabs/wallet-provider';
import Intl from '../i18n/i18n';

export async function fetchMASBalance(
  account: IAccount,
): Promise<IAccountBalanceResponse> {
  try {
    return account.balance();
  } catch (error) {
    console.error('Error while retrieving balance: ', error);
    toast.error(Intl.t('index.balance.error'));
    return { finalBalance: '0', candidateBalance: '0' };
  }
}
