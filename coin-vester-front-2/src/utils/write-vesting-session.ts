import { Client } from '@massalabs/massa-web3';
import { useState } from 'react';
import { waitIncludedOperation } from './massa-utils';
import { toast } from '@massalabs/react-ui-kit';
import Intl from '../i18n/i18n';
import { SC_ADDRESS } from '../const/sc';

interface ToasterMessage {
  pending: string;
  success: string;
  error: string;
}

export function useWriteVestingSession(client?: Client) {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [opId, setOpId] = useState<string | null>(null);

  function callSmartContract(
    targetFunction: string,
    parameter: number[],
    messages: ToasterMessage,
  ) {
    if (!client) {
      throw new Error('Massa client not found');
    }
    if (isPending) {
      return;
    }
    setIsSuccess(false);
    setIsError(false);
    setIsPending(false);
    client
      .smartContracts()
      .callSmartContract({
        targetAddress: SC_ADDRESS,
        targetFunction,
        parameter,
        maxGas: BigInt(2550000),
        coins: BigInt(0),
        fee: BigInt(0),
      })
      .then((opId) => {
        setOpId(opId);
        setIsPending(true);
        toast.loading(messages.pending);
        return waitIncludedOperation(opId);
      })
      .then(() => {
        setIsSuccess(true);
        setIsPending(false);
        toast.success(messages.success);
      })
      .catch(() => {
        setIsError(true);
        setIsPending(false);
        toast.error(messages.error);
      });
  }

  function claimVestingSession(parameter: number[]) {
    callSmartContract('claimVestingSession', parameter, {
      pending: Intl.t('steps.claiming'),
      success: Intl.t('steps.claim-success'),
      error: Intl.t('steps.claim-failed'),
    });
  }

  function deleteVestingSession(parameter: number[]) {
    callSmartContract('clearVestingSession', parameter, {
      pending: Intl.t('steps.deleting'),
      success: Intl.t('steps.delete-success'),
      error: Intl.t('steps.delete-failed'),
    });
  }

  return {
    opId,
    isSuccess,
    isError,
    claimVestingSession,
    deleteVestingSession,
  };
}
