import { useState } from 'react';

import './SessionCard.css';
import { fromMAS } from '@massalabs/massa-web3';

import {
  formatAddress,
  fromnMAS,
  msToDateWithTimeZone,
  msToTime,
} from '../utils';
import { VestingSession } from '../types/types';
import {
  AccordionCategory,
  AccordionContent,
  MassaWallet,
  Tooltip,
} from '@massalabs/react-ui-kit';
import { FiChevronDown, FiChevronUp, FiInfo } from 'react-icons/fi';

import Intl from '../i18n/i18n';
import { SUPPORTED_MASSA_WALLETS } from '../const/connect-massa-wallet';

import { BearbySvg } from './ConnectMassaWallets/BearbySvg';

import { Card } from './Card';
import { MoreInfoItem } from './MoreInfoItem';

type Props = {
  vestingSession: VestingSession;
  accountName?: string;
  accountProvider?: string;
  handleClaim: (vestingID: bigint, amount: bigint) => void;
  handleDelete: (vestingID: bigint) => void;
};

function VestingSessionCard(props: Props) {
  const { vestingSession, accountName, accountProvider } = props;
  const [amountToClaim, setAmountToClaim] = useState('');
  const { vestingInfo, availableAmount, claimedAmount } = vestingSession;
  const [error, setError] = useState<string | null>(null);

  if (!vestingInfo) {
    console.error(
      'Vesting info is undefined for vesting session: ',
      vestingSession,
    );
    return (
      <div className="border-none rounded-xl">
        <h3>Error: Vesting info is undefined</h3>
      </div>
    );
  }

  const {
    toAddr,
    startTimestamp,
    linearDuration,
    cliffDuration,
    initialReleaseAmount,
    tag,
  } = vestingInfo;

  const checkValidAmount = (amount: string): string | null => {
    if (amount === '') return 'Please enter a value';
    try {
      const masAmount = fromMAS(amount);
      if (amount.includes('.') && amount.split('.')[1].length > 9) {
        return "The amount can't have a precision greater than 9";
      }
      if (masAmount < BigInt(0)) {
        return 'Please enter a positive number';
      }
      if (masAmount === BigInt(0)) {
        return 'Please enter a non-zero number';
      }
      if (masAmount > availableAmount) {
        return "You can't claim more than the available amount";
      }
      return null;
    } catch (e) {
      if (e instanceof Error) {
        console.error('Error parsing amount: ', e);
        return 'Please enter a valid MAS value';
      }
      return 'An unexpected error occurred';
    }
  };

  const handleClaim = () => {
    const error = checkValidAmount(amountToClaim);
    if (error) {
      setError(error);
      return;
    }

    try {
      const amount = fromMAS(amountToClaim);
      props.handleClaim(vestingSession.id, amount);
    } catch (e) {
      if (e instanceof Error) {
        setError(`Please enter a valid MAS value: ${e.message}`);
        return;
      }
    }
  };

  const handleDelete = () => {
    props.handleDelete(vestingSession.id);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountToClaim(e.target.value);
    const error = checkValidAmount(e.target.value);
    setError(error);
  };

  return (
    <Card>
      <div className="flex justify-between items-center">
        <div className="avatar-container">
          {accountProvider === SUPPORTED_MASSA_WALLETS.BEARBY ? (
            <BearbySvg />
          ) : accountProvider === SUPPORTED_MASSA_WALLETS.MASSASTATION ? (
            <MassaWallet />
          ) : null}
          <h3 style={{ marginLeft: '8px' }}>
            {accountName ? accountName : 'Account'} -{' '}
            {formatAddress(toAddr.base58Encoded)}
          </h3>
        </div>
        <span className="tag">{tag}</span>
      </div>
      <div className="total-amount">
        Total amount: {fromnMAS(vestingInfo.totalAmount)}
      </div>
      <div className="claimable-amount">
        Available to Claim: {fromnMAS(availableAmount)}
      </div>
      <div className="action-container">
        {claimedAmount !== vestingInfo.totalAmount && (
          <div className="input-container">
            <div className="input-claim-container">
              <input
                type="text"
                placeholder="Amount to claim"
                value={amountToClaim}
                onChange={handleAmountChange}
              />
              <button onClick={handleClaim} disabled={!!error}>
                Claim
              </button>
            </div>
            {error && (
              <div className="error-container">
                <p className="error">{error}</p>
              </div>
            )}
          </div>
        )}
        {claimedAmount === vestingInfo.totalAmount && (
          <button onClick={handleDelete}>Delete</button>
        )}
      </div>
      <hr />
      <AccordionCategory
        iconOpen={<FiChevronDown />}
        iconClose={<FiChevronUp />}
        isChild={false}
        categoryTitle={<p>{Intl.t('session-card.more-info')}</p>}
      >
        <AccordionContent>
          <MoreInfoItem
            title="Start Date"
            tooltip="The date at which the vesting starts."
            value={msToDateWithTimeZone(Number(startTimestamp))}
            valueLabel={startTimestamp.toString() + ' ms'}
          />
          <MoreInfoItem
            title="Initial Release"
            tooltip="The amount of MAS that is released at the start date."
            value={fromnMAS(initialReleaseAmount)}
          />
          <MoreInfoItem
            title="Cliff Duration"
            tooltip="The duration after which the linear release starts, starting from the start date."
            value={msToTime(Number(cliffDuration))}
            valueLabel={cliffDuration.toString() + ' ms'}
          />
          <MoreInfoItem
            title="Linear Duration"
            tooltip="The duration over which the remaining amount is linearly released."
            value={msToTime(Number(linearDuration))}
            valueLabel={linearDuration.toString() + ' ms'}
          />
          <MoreInfoItem
            title="Claimed Amount"
            tooltip="The amount of MAS that was already claimed."
            value={fromnMAS(claimedAmount)}
          />
        </AccordionContent>
      </AccordionCategory>
    </Card>
  );
}

export default VestingSessionCard;