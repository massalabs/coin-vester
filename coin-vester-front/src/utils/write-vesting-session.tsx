import { useState } from 'react';
import {
  Client,
  EOperationStatus,
  ICallData,
  MAX_GAS_CALL,
} from '@massalabs/massa-web3';
import { toast } from '@massalabs/react-ui-kit';
import Intl from '../i18n/i18n';

import { OperationToast } from '../components/Toasts/OperationToast';

import {
  DEFAULT_OP_FEES,
  SC_ADDRESS,
  VESTING_SESSION_STORAGE_COST,
} from '../const/sc';
import { logSmartContractEvents } from './massa-utils';

interface ToasterMessage {
  pending: string;
  success: string;
  error: string;
  timeout?: string;
}

type callSmartContractOptions = {
  coins?: bigint;
  fee?: bigint;
  showInProgressToast?: boolean;
};

function minBigInt(a: bigint, b: bigint) {
  return a < b ? a : b;
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
      fee = DEFAULT_OP_FEES,
      showInProgressToast = false,
    }: callSmartContractOptions = {},
  ) {
    if (!client) {
      throw new Error('Massa client not found');
    }
    if (isPending) {
      throw new Error('Operation is already pending');
    }
    setIsSuccess(false);
    setIsError(false);
    setIsPending(false);
    let operationId: string | undefined;
    let toastId: string | undefined;

    const callData = {
      targetAddress: SC_ADDRESS,
      targetFunction,
      parameter,
      coins,
      fee,
    } as ICallData;

    client
      .smartContracts()
      .readSmartContract(callData)
      .then((response) => {
        const gasCost = BigInt(response.info.gas_cost);
        return minBigInt(gasCost + (gasCost * 20n) / 100n, MAX_GAS_CALL);
      })
      .then((maxGas: bigint) => {
        callData.maxGas = maxGas;
        return client.smartContracts().callSmartContract(callData);
      })
      .then((opId) => {
        operationId = opId;
        setOpId(opId);
        setIsPending(true);
        if (showInProgressToast) {
          toastId = toast.custom(
            <OperationToast
              title={messages.pending}
              operationId={operationId}
            />,
            {
              duration: Infinity,
            },
          );
        }
        return client
          .smartContracts()
          .awaitMultipleRequiredOperationStatus(opId, [
            EOperationStatus.SPECULATIVE_ERROR,
            EOperationStatus.FINAL_ERROR,
            EOperationStatus.FINAL_SUCCESS,
          ]);
      })
      .then((status: EOperationStatus) => {
        if (status !== EOperationStatus.FINAL_SUCCESS) {
          throw new Error('Operation failed', { cause: { status } });
        }
        setIsSuccess(true);
        setIsPending(false);
        toast.dismiss(toastId);
        toast.custom(
          <OperationToast
            title={messages.success}
            operationId={operationId}
            variant="success"
          />,
        );
      })
      .catch((error) => {
        console.error(error);
        toast.dismiss(toastId);
        setIsError(true);
        setIsPending(false);

        if (!operationId) {
          console.error('Operation ID not found');
          toast.custom(
            <OperationToast title={messages.error} variant="error" />,
          );
          return;
        }

        if (
          [
            EOperationStatus.FINAL_ERROR,
            EOperationStatus.SPECULATIVE_ERROR,
          ].includes(error.cause?.status)
        ) {
          toast.custom(
            <OperationToast
              title={messages.error}
              operationId={operationId}
              variant="error"
            />,
          );
          logSmartContractEvents(client, operationId);
        } else {
          toast.custom(
            <OperationToast
              title={messages.timeout || Intl.t('steps.failed-timeout')}
              operationId={operationId}
              variant="error"
            />,
          );
        }
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
