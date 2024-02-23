import { fromMAS } from '@massalabs/massa-web3';
import {
  Button,
  PopupModal,
  PopupModalContent,
  PopupModalFooter,
  PopupModalHeader,
} from '@massalabs/react-ui-kit';

import Intl from '../i18n/i18n';
import { fromnMAS, msToDateTimeWithTimeZone, msToTime } from '../utils';

import { MoreInfoItem } from './SessionCard/MoreInfoItem';

type SendVestingConfirmationModalProps = {
  onClose: () => void;
  tag: string;
  recipient: string;
  totalAmount: string;
  startTimestamp: string;
  initialReleaseAmount: string;
  cliffDuration: string;
  linearDuration: string;
  handleSend: () => Promise<void>;
};
export function SendVestingConfirmationModal(
  props: SendVestingConfirmationModalProps,
) {
  const {
    onClose,
    tag,
    recipient,
    totalAmount,
    startTimestamp,
    initialReleaseAmount,
    cliffDuration,
    linearDuration,
    handleSend,
  } = props;

  return (
    <PopupModal fullMode={true} onClose={onClose}>
      <PopupModalHeader customClassHeader="items-center pt-5">
        <h3 className="mas-subtitle">
          {Intl.t('send-vesting.confirm-modal.title')}
        </h3>
      </PopupModalHeader>
      <PopupModalContent customClassContent="pb-5">
        <MoreInfoItem title="Tag" value={tag} />
        <MoreInfoItem title="Recipient" value={recipient} />
        <MoreInfoItem
          title="Total Amount"
          value={fromnMAS(fromMAS(totalAmount))}
          valueLabel={totalAmount}
        />
        <MoreInfoItem
          title="Start Timestamp"
          value={msToDateTimeWithTimeZone(Number(startTimestamp))}
          valueLabel={startTimestamp.toString() + ' ms'}
        />
        <MoreInfoItem
          title="Initial Release Amount"
          value={fromnMAS(fromMAS(initialReleaseAmount))}
          valueLabel={initialReleaseAmount}
        />
        <MoreInfoItem
          title="Cliff Duration"
          value={msToTime(Number(cliffDuration))}
          valueLabel={cliffDuration.toString() + ' ms'}
        />
        <MoreInfoItem
          title="Linear Duration"
          value={msToTime(Number(linearDuration))}
          valueLabel={linearDuration.toString() + ' ms'}
        />
      </PopupModalContent>
      <PopupModalFooter customClassFooter="items-center justify-between border-none pb-5">
        <Button onClick={onClose}>
          {Intl.t('send-vesting.confirm-modal.cancel')}
        </Button>
        <Button onClick={handleSend}>
          {Intl.t('send-vesting.confirm-modal.confirm-send')}
        </Button>
      </PopupModalFooter>
    </PopupModal>
  );
}
