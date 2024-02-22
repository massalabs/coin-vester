import { Tag } from '@massalabs/react-ui-kit';
import Intl from '../../../../i18n/i18n';
import { tagTypes } from '../../../../const/connect-massa-wallet';

export function Disconnected() {
  return (
    <Tag type={tagTypes.error}>
      {Intl.t('connect-wallet.tag.not-connected')}
    </Tag>
  );
}
