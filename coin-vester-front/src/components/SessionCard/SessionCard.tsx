import { useEffect, useState } from 'react';

import { Args, fromMAS } from '@massalabs/massa-web3';

import {
  AccordionCategory,
  AccordionContent,
  Button,
  MassaWallet,
  Money,
  Spinner,
  Tooltip,
} from '@massalabs/react-ui-kit';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

import { Card } from '../Card';
import { MoreInfoItem } from './MoreInfoItem';

import { VestingSession } from '../../types/types';
import {
  formatAddress,
  fromnMAS,
  msToDateWithTimeZone,
  msToTime,
} from '../../utils';
import { useWriteVestingSession } from '../../utils/write-vesting-session';
import { useAccountStore } from '@massalabs/react-ui-kit/src/lib/ConnectMassaWallets/store';
import { BearbySvg } from '@massalabs/react-ui-kit/src/lib/ConnectMassaWallets/components/BearbySvg';
import { SUPPORTED_MASSA_WALLETS } from '@massalabs/react-ui-kit/src/lib/massa-react/const';
import { generateExplorerLink } from '@massalabs/react-ui-kit/src/lib/massa-react/utils';
import Intl from '../../i18n/i18n';

type Props = {
  vestingSession: VestingSession;
  onUpdate: () => void;
};

function VestingSessionCard(props: Props) {
  const { vestingSession, onUpdate } = props;
  const [amountToClaim, setAmountToClaim] = useState('');
  const { vestingInfo, availableAmount, claimedAmount } = vestingSession;
  const [error, setError] = useState<string | null>(null);
  const { currentProvider, connectedAccount, massaClient } = useAccountStore();
  const {
    opId,
    claimVestingSession,
    deleteVestingSession,
    isSuccess,
    isError,
    isPending,
  } = useWriteVestingSession(massaClient);

  useEffect(() => {
    if (isSuccess) {
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  useEffect(() => {
    if (isSuccess || isError) {
      setAmountToClaim('');
    }
  }, [isSuccess, isError]);

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
        return 'Please enter a valid MAS value';
      }
      return 'An unexpected error occurred';
    }
  };

  const handleClaim = async () => {
    const error = checkValidAmount(amountToClaim);
    setError(error);
    if (error) {
      return;
    }

    const amount = fromMAS(amountToClaim);
    let serializedArg = new Args();
    serializedArg.addU64(vestingSession.id);
    serializedArg.addU64(amount);
    let serialized = serializedArg.serialize();
    claimVestingSession(serialized);
  };

  const handleDelete = () => {
    let serializedArg = new Args();
    serializedArg.addU64(vestingSession.id);
    let serialized = serializedArg.serialize();
    deleteVestingSession(serialized);
  };

  const accountProvider = currentProvider?.name();
  const accountName = connectedAccount?.name();

  return (
    <Card customClass="pb-0 mb-4">
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
              {isPending && opId ? (
                <div className="flex flex-row justify-between h-full items-center rounded-lg bg-secondary px-4">
                  <div className="flex flex-row items-center">
                    <Spinner customClass="mr-4" />
                    <p className="mas-body">{Intl.t('steps.claiming')}</p>
                  </div>
                  <a
                    href={generateExplorerLink(opId)}
                    target="_blank"
                    rel="noreferrer"
                    className="mas-menu-underline"
                  >
                    {Intl.t('toast.explorer')}
                  </a>
                </div>
              ) : (
                <Money
                  placeholder="Amount to claim"
                  value={amountToClaim.toString()}
                  onValueChange={(event) => setAmountToClaim(event.value)}
                  error={error ? error : undefined}
                />
              )}
            </div>
            <Button
              onClick={handleClaim}
              customClass="w-1/3"
              disabled={isPending && !!opId}
            >
              Claim
            </Button>
          </div>
        )}
        {claimedAmount === vestingInfo.totalAmount && (
          <div className="flex flex-col w-full">
            <Button variant="danger" onClick={handleDelete}>
              {Intl.t('claim.delete.button')}
            </Button>
            <div className="flex items-center flew-col mt-1">
              <p>{Intl.t('claim.delete.text')}</p>
              <Tooltip
                customClass="ml-4"
                body={Intl.t('claim.delete.tooltip')}
              ></Tooltip>
            </div>
          </div>
        )}
      </div>
      <hr className="color-primary" />
      <AccordionCategory
        iconOpen={<FiChevronDown />}
        iconClose={<FiChevronUp />}
        isChild={false}
        categoryTitle={<p>{Intl.t('session-card.more-info')}</p>}
      >
        <AccordionContent customClass="pt-0">
          <MoreInfoItem
            title="Start Date"
            tooltip="The date at which the vesting starts."
            value={msToDateWithTimeZone(Number(startTimestamp))}
            valueLabel={startTimestamp.toString() + ' ms'}
          />
          <MoreInfoItem
            title="Initial Release"
            tooltip="The amount of MAS released on the start date."
            value={fromnMAS(initialReleaseAmount)}
          />
          <MoreInfoItem
            title="Cliff Duration"
            tooltip="The duration during which your tokens are locked before being vested."
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
