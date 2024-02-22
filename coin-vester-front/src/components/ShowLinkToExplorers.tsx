import { Button, Clipboard } from '@massalabs/react-ui-kit';
import { FiExternalLink } from 'react-icons/fi';
import Intl from '../i18n/i18n';
import { maskAddress } from '../utils';

interface ShowLinkToExplorers {
  explorerUrl: string;
  currentTxID: string | undefined;
}

export function ShowLinkToExplorers(props: ShowLinkToExplorers) {
  const { explorerUrl, currentTxID } = props;

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noreferrer');
  };

  const showLinkToExplorers = currentTxID && explorerUrl;

  return (
    showLinkToExplorers && (
      <div className="flex align-middle items-center w-full justify-center">
        <div className="flex justify-center items-center w-fit h-fit">
          {Intl.t('toast.explorer')}

          <div className="w-32">
            <Clipboard
              customClass={'bg-transparent w-20'}
              displayedContent={maskAddress(currentTxID)}
              rawContent={currentTxID}
            />
          </div>

          <Button variant="icon" onClick={() => openInNewTab(explorerUrl)}>
            <FiExternalLink size={18} />
          </Button>
        </div>
      </div>
    )
  );
}
