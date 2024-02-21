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
} from '@massalabs/react-ui-kit';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import Intl from '../i18n/i18n';
import { BearbySvg } from './ConnectMassaWallets/BearbySvg';
import { SUPPORTED_MASSA_WALLETS } from '../const/connect-massa-wallet';

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
      <div className="vesting-session-card">
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
    <div className="vesting-session-card">
      <div className="header">
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
          <div className="more-info-items">
            <span title="The date at which the vesting starts.">
              <i className="fa fa-info-circle" /> Start Date
            </span>
            <div className="info-content">
              <b>{msToDateWithTimeZone(Number(startTimestamp))}</b>
              <div className="raw-value">{startTimestamp.toString()} ms</div>
            </div>
          </div>
          <div className="more-info-items">
            <span title="The amount of MAS that is released at the start date.">
              <i className="fa fa-info-circle" /> Initial Release
            </span>
            <b>{fromnMAS(initialReleaseAmount)}</b>
          </div>
          <div className="more-info-items">
            <span title="The duration after which the linear release starts, starting from the start date.">
              <i className="fa fa-info-circle" /> Cliff Duration
            </span>
            <div className="info-content">
              <b>{msToTime(Number(cliffDuration))}</b>
              <div className="raw-value">{cliffDuration.toString()} ms</div>
            </div>
          </div>
          <div className="more-info-items">
            <span title={Intl.t('session-card.linear-duration-tooltip')}>
              <i className="fa fa-info-circle" /> Linear Duration
            </span>
            <div className="info-content">
              <b>{msToTime(Number(linearDuration))}</b>
              <div className="raw-value">{linearDuration.toString()} ms</div>
            </div>
          </div>
          <div className="more-info-items">
            <span title="The amount of MAS that was already claimed.">
              <i className="fa fa-info-circle" /> Claimed Amount
            </span>
            <b>{fromnMAS(claimedAmount)}</b>
          </div>
        </AccordionContent>
      </AccordionCategory>
    </div>
  );
}

export default VestingSessionCard;
