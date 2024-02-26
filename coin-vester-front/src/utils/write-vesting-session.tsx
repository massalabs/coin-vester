import { Client } from '@massalabs/massa-web3';
import { useState } from 'react';
import { waitIncludedOperation } from './massa-utils';
import { toast } from '@massalabs/react-ui-kit';
import Intl from '../i18n/i18n';
import { SC_ADDRESS } from '../const/sc';
import { OperationToast } from '../components/Toasts/OperationToast';

interface ToasterMessage {
  pending: string;
  success: string;
  error: string;
}

export function useWriteVestingSession(client?: Client) {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [opId, setOpId] = useState<string | undefined>(undefined);

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
    let operationId: string | undefined;

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
        operationId = opId;
        setOpId(opId);
        setIsPending(true);
        return waitIncludedOperation(opId);
      })
      .then(() => {
        setIsSuccess(true);
        setIsPending(false);
        toast.custom(
          <OperationToast
            title={messages.success}
            operationId={operationId}
            variant="success"
          />,
        );
      })
      .catch(() => {
        setIsError(true);
        setIsPending(false);
        toast.custom(
          <OperationToast
            title={messages.error}
            operationId={operationId}
            variant="error"
          />,
        );
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
    isPending,
    isSuccess,
    isError,
    claimVestingSession,
    deleteVestingSession,
  };
}
