import { useState } from 'react';
import {
  Args,
  BASE_ACCOUNT_CREATION_COST,
  fromMAS,
} from '@massalabs/massa-web3';
import { Button, Input, Money } from '@massalabs/react-ui-kit';

import { Card } from './Card';
import { NumericInput } from './NumericInput';
import { SendVestingConfirmationModal } from './SendVestingConfirmationModal';

import { useAccountStore } from '../store';

import Intl from '../i18n/i18n';

import { DEFAULT_OP_FEES, VESTING_SESSION_STORAGE_COST } from '../const/sc';
import { fromnMAS, msToDateTimeWithTimeZone, msToTime } from '../utils';
import { useWriteVestingSession } from '../utils/write-vesting-session';
import {
  validateAmount,
  validateAddress,
  validateStartTime,
  validateTag,
  validateDuration,
} from '../utils/validation';

export interface InputsErrors {
  tag?: string;
  recipientAddress?: string;
  totalAmount?: string;
  startTimestamp?: string;
  initialReleaseAmount?: string;
  cliffDuration?: string;
  linearDuration?: string;
  globalError?: string;
}

export function SendVestingCard() {
  const { connectedAccount, massaClient: client } = useAccountStore();
  const { createVestingSession } = useWriteVestingSession(client);
  const [totalAmount, setTotalAmount] = useState<string>('0');
  const [startTimestamp, setStartTimestamp] = useState<string>(
    Date.now().toString(),
  );
  const [initialReleaseAmount, setInitialReleaseAmount] = useState<string>('0');
  const [cliffDuration, setCliffDuration] = useState<string>('0');
  const [linearDuration, setLinearDuration] = useState<string>('0');
  const [tag, setTag] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [error, setError] = useState<InputsErrors | null>(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const connected = !!connectedAccount && !!client;

  const handleSubmit = async () => {
    if (!(await validateForm())) {
      return;
    }

    setConfirmModalOpen(true);
  };

  const handleSend = async () => {
    if (!client) {
      console.error('Massa client not found');
      return;
    }

    // Check if target addr has enough balance for the claim
    let addrInfo = await client.publicApi().getAddresses([recipient]);
    if (
      fromMAS(addrInfo[0].candidate_balance) === fromMAS('0') &&
      addrInfo[0].candidate_roll_count === 0
    ) {
      // TODO: Replace with a toast or a modal
      window.alert('The target address does not exist. Initializing it first.');
      // needs to send some funds to the target address
      // TODO: Move to the useWriteVestingSession hook
      await client.wallet().sendTransaction({
        recipientAddress: recipient,
        // amount chosen to make sure the address exists and that we can detect it:
        amount: BASE_ACCOUNT_CREATION_COST + DEFAULT_OP_FEES,
        fee: fromMAS('0'),
      });
      // TODO: Replace with a toast or a modal
      window.alert(
        'The initialization transaction has been sent. Please wait a few seconds and try again.',
      );
    }

    const totalAmountInMAS = fromMAS(totalAmount);
    const initialReleaseAmountInMAS = fromMAS(initialReleaseAmount);
    const startTimeBigInt = BigInt(startTimestamp);
    const cliffDurationBigInt = BigInt(cliffDuration);
    const linearDurationBigInt = BigInt(linearDuration);

    let serializedArg = new Args();
    serializedArg.addString(recipient);
    serializedArg.addU64(totalAmountInMAS);
    serializedArg.addU64(startTimeBigInt);
    serializedArg.addU64(initialReleaseAmountInMAS);
    serializedArg.addU64(cliffDurationBigInt);
    serializedArg.addU64(linearDurationBigInt);
    serializedArg.addString(tag);

    createVestingSession(serializedArg.serialize(), totalAmountInMAS);
  };

  const validateAmountAndCheckBalance = async (
    amount: string,
    allowZero: boolean = false,
  ) => {
    const error = validateAmount(amount, allowZero);
    if (error) {
      return error;
    }

    try {
      const amountInMAS = fromMAS(amount);
      const balance = await connectedAccount?.balance();
      const totalCost = amountInMAS + VESTING_SESSION_STORAGE_COST;
      const finalBalance = fromMAS(balance?.finalBalance || 0);

      if (connectedAccount && totalCost > finalBalance) {
        return `You don't have enough balance to create this vesting session (total amount + ${fromnMAS(
          VESTING_SESSION_STORAGE_COST,
        )} of storage cost)`;
      }
    } catch (e) {
      // Should never happen. If it does, it's because the balance is corrupted
      return 'Unknown error';
    }
    return undefined;
  };

  const validateInitialReleaseAmount = async (
    amount: string,
    total: string,
  ) => {
    let error = await validateAmountAndCheckBalance(amount, true);
    if (error) {
      return error;
    }
    error = validateAmount(total, true);
    if (error) {
      return error;
    }

    if (fromMAS(amount) > fromMAS(total)) {
      return 'Initial release amount must be less than total amount';
    }
    return undefined;
  };

  const validateForm = async () => {
    const totalAmountError = await validateAmountAndCheckBalance(totalAmount);
    const initialReleaseAmountError = await validateInitialReleaseAmount(
      initialReleaseAmount,
      totalAmount,
    );
    const recipientAddressError = validateAddress(recipient);
    const startTimestampError = validateStartTime(startTimestamp);
    const tagError = validateTag(tag);

    const newError = {
      totalAmount: totalAmountError,
      initialReleaseAmount: initialReleaseAmountError,
      recipientAddress: recipientAddressError,
      startTimestamp: startTimestampError,
      tag: tagError,
    };

    if (Object.values(newError).every((v) => v === undefined)) {
      setError(null);
      return true;
    }

    setError(newError);
    return false;
  };

  const updateError = (key: keyof InputsErrors, value: string | undefined) => {
    setError((prevError) => {
      const newError = { ...prevError, [key]: value };
      if (Object.values(newError).every((v) => v === undefined)) {
        return null;
      }

      return newError;
    });
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTag(e.target.value);
    const error = validateTag(e.target.value);
    updateError('tag', error);
  };

  const handleRecipientAddressChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRecipient(e.target.value);
    const error = validateAddress(e.target.value);
    updateError('recipientAddress', error);
  };

  const validateAmounts = async (total: string, initial: string) => {
    const totalAmountError = await validateAmountAndCheckBalance(total);
    updateError('totalAmount', totalAmountError);
    const initialReleaseAmountError = await validateInitialReleaseAmount(
      initial,
      total,
    );
    updateError('initialReleaseAmount', initialReleaseAmountError);
  };

  const handleTotalAmountChange = async (value: string) => {
    setTotalAmount(value);
    await validateAmounts(value, initialReleaseAmount);
  };

  const handleInitialReleaseAmountChange = async (value: string) => {
    setInitialReleaseAmount(value);
    await validateAmounts(totalAmount, value);
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartTimestamp(e.target.value);
    const error = validateStartTime(e.target.value);
    updateError('startTimestamp', error);
  };

  const handleCliffDurationChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setCliffDuration(e.target.value);
    const error = validateDuration(e.target.value);
    updateError('cliffDuration', error);
  };

  const handleLinearDurationChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setLinearDuration(e.target.value);
    const error = validateDuration(e.target.value);
    updateError('linearDuration', error);
  };

  return (
    <>
      <Card>
        {!connected ? (
          <h3 className="mas-h3">
            Connect a wallet to be able to create vesting sessions
          </h3>
        ) : (
          <div className="flex flex-col">
            <p className="pb-3.5 mas-body2">{Intl.t('send-vesting.tag')}</p>
            <div className="pb-3.5">
              <Input
                placeholder={Intl.t('send-vesting.tag')}
                value={tag}
                onChange={handleTagChange}
                error={error?.tag}
              />
            </div>
            <p className="pb-3.5 mas-body2">
              {Intl.t('send-vesting.recipient')}
            </p>
            <div className="pb-3.5">
              <Input
                placeholder={Intl.t('send-vesting.recipient')}
                value={recipient}
                onChange={handleRecipientAddressChange}
                error={error?.recipientAddress}
              />
            </div>
            <p className="pb-3.5 mas-body2">
              {Intl.t('send-vesting.total-amount')}
            </p>
            <div className="pb-3.5">
              <Money
                placeholder={Intl.t('send-vesting.amount-to-send')}
                value={totalAmount.toString()}
                onValueChange={(event) => handleTotalAmountChange(event.value)}
                error={error?.totalAmount}
              />
            </div>
            <p className="pb-3.5 mas-body2">
              {Intl.t('send-vesting.start-timestamp')}
            </p>
            <div className="w-full flex flex-row justify-between items-center pb-3.5">
              <div className="w-1/2 mr-4">
                <NumericInput
                  value={startTimestamp}
                  placeholder={Intl.t('send-vesting.start-timestamp')}
                  onChange={handleStartTimeChange}
                  error={error?.startTimestamp}
                />
              </div>
              <div className="flex-end text-right">
                <b>{msToDateTimeWithTimeZone(Number(startTimestamp))}</b>
              </div>
            </div>
            <p className="pb-3.5 mas-body2">
              {Intl.t('send-vesting.initial-release-amount')}
            </p>
            <div className="pb-3.5">
              <Money
                placeholder={Intl.t('send-vesting.initial-release-amount')}
                value={initialReleaseAmount.toString()}
                onValueChange={(event) =>
                  handleInitialReleaseAmountChange(event.value)
                }
                error={error?.initialReleaseAmount}
              />
            </div>
            <p className="pb-3.5 mas-body2">
              {Intl.t('send-vesting.cliff-duration')}
            </p>
            <div className="w-full flex flex-row justify-between items-center pb-3.5">
              <div className="flex flex-col w-1/2 mr-4">
                <NumericInput
                  placeholder={Intl.t('send-vesting.cliff-duration')}
                  value={cliffDuration.toString()}
                  onChange={handleCliffDurationChange}
                  error={error?.cliffDuration}
                />
              </div>
              <div className="flex-end text-right">
                <b>{msToTime(Number(cliffDuration))}</b>
              </div>
            </div>
            <p className="pb-3.5 mas-body2">
              {Intl.t('send-vesting.linear-duration')}
            </p>
            <div className="w-full flex flex-row justify-between items-center pb-3.5">
              <div className="flex flex-col w-1/2 mr-4">
                <NumericInput
                  placeholder={Intl.t('send-vesting.linear-duration')}
                  value={linearDuration.toString()}
                  onChange={handleLinearDurationChange}
                  error={error?.linearDuration}
                />
              </div>
              <div className="flex-end text-right">
                <b>{msToTime(Number(linearDuration))}</b>
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={!!error}>
              {Intl.t('send-vesting.send')}
            </Button>
          </div>
        )}
      </Card>
      {confirmModalOpen && (
        <SendVestingConfirmationModal
          onClose={() => setConfirmModalOpen(false)}
          tag={tag}
          recipient={recipient}
          totalAmount={totalAmount}
          startTimestamp={startTimestamp}
          initialReleaseAmount={initialReleaseAmount}
          cliffDuration={cliffDuration}
          linearDuration={linearDuration}
          handleSend={handleSend}
        />
      )}
    </>
  );
}
