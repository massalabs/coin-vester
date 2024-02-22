import { useState } from 'react';
import { fromMAS } from '@massalabs/massa-web3';

import {
  AccordionCategory,
  AccordionContent,
  Button,
  Input,
  MassaWallet,
} from '@massalabs/react-ui-kit';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

import { BearbySvg } from './ConnectMassaWallets/BearbySvg';

import { Card } from './Card';
import { MoreInfoItem } from './MoreInfoItem';

import { SUPPORTED_MASSA_WALLETS } from '../const/connect-massa-wallet';
import Intl from '../i18n/i18n';
import { VestingSession } from '../types/types';
import {
  formatAddress,
  fromnMAS,
  msToDateWithTimeZone,
  msToTime,
} from '../utils';

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
    <Card customClass="pb-0">
      <div className="flex justify-between items-center mb-2">
        <div className="flex flow-row items-center w-2/3">
          {accountProvider === SUPPORTED_MASSA_WALLETS.BEARBY ? (
            <BearbySvg />
          ) : accountProvider === SUPPORTED_MASSA_WALLETS.MASSASTATION ? (
            <MassaWallet />
          ) : null}
          <h3 className="ml-2 mas-menu-active">
            {accountName ? accountName : 'Account'} -{' '}
            {formatAddress(toAddr.base58Encoded)}
          </h3>
        </div>
        <h3 className="mas-h3 overflow-auto text-right">{tag}</h3>
      </div>
      <div className="mb-4">
        <p className="mas-body">
          Total amount: {fromnMAS(vestingInfo.totalAmount)}
        </p>
        <p className="mas-subtitle">
          Available to Claim: {fromnMAS(availableAmount)}
        </p>
      </div>
      <div className="flex justify-between items-stretch mb-4">
        {claimedAmount !== vestingInfo.totalAmount && (
          <div className="flex justify-between w-full">
            <div className="flex flex-col w-2/3 mr-4">
              <Input
                type="text"
                placeholder="Amount to claim"
                value={amountToClaim}
                onChange={handleAmountChange}
                error={error ? error : undefined}
                customClass="bg-primary"
              />
            </div>
            <Button
              onClick={handleClaim}
              disabled={!!error}
              customClass="w-1/3"
            >
              Claim
            </Button>
          </div>
        )}
        {claimedAmount === vestingInfo.totalAmount && (
          <button onClick={handleDelete}>Delete</button>
        )}
      </div>
      <hr className="color-primary" />
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
