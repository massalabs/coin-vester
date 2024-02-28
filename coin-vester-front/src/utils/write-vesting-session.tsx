import { useState } from 'react';
import { Client } from '@massalabs/massa-web3';
import { waitIncludedOperation } from './massa-utils';
import { toast } from '@massalabs/react-ui-kit';
import Intl from '../i18n/i18n';

import { OperationToast } from '../components/Toasts/OperationToast';

import {
  DEFAULT_OP_FEES,
  SC_ADDRESS,
  VESTING_SESSION_STORAGE_COST,
} from '../const/sc';

interface ToasterMessage {
  pending: string;
  success: string;
  error: string;
}

type callSmartContractOptions = {
  coins?: bigint;
  fee?: bigint;
  showInProgressToast?: boolean;
};

let defaultOpFees: bigint;

try {
  defaultOpFees = BigInt(DEFAULT_OP_FEES);
} catch (error) {
  defaultOpFees = BigInt(0);
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
    {
      coins = BigInt(0),
      fee = defaultOpFees,
      showInProgressToast: pendingToast = false,
    }: callSmartContractOptions = {},
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
        coins,
        fee,
      })
      .then((opId) => {
        operationId = opId;
        setOpId(opId);
        setIsPending(true);
        // TODO: Toasts should not be handled in hooks.
        if (pendingToast) {
          toast.custom(
            <OperationToast
              title={messages.pending}
              operationId={operationId}
            />,
          );
        }
        return waitIncludedOperation(opId);
      })
      .then(() => {
        setIsSuccess(true);
        setIsPending(false);
        // TODO: Toasts should not be handled in hooks.
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
        // TODO: Toasts should not be handled in hooks.
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
    callSmartContract(
      'clearVestingSession',
      parameter,
      {
        pending: Intl.t('steps.deleting'),
        success: Intl.t('steps.delete-success'),
        error: Intl.t('steps.delete-failed'),
      },
      {
        showInProgressToast: true,
      },
    );
  }

  function createVestingSession(parameter: number[], sendTotalAmount: bigint) {
    callSmartContract(
      'createVestingSession',
      parameter,
      {
        pending: Intl.t('steps.creating'),
        success: Intl.t('steps.create-success'),
        error: Intl.t('steps.create-failed'),
      },
      {
        coins: sendTotalAmount + VESTING_SESSION_STORAGE_COST,
        showInProgressToast: true,
      },
    );
  }

  return {
    opId,
    isPending,
    isSuccess,
    isError,
    claimVestingSession,
    deleteVestingSession,
    createVestingSession,
  };
}
