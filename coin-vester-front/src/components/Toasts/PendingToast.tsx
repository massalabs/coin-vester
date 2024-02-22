import {
  MASSA_EXPLORER_URL,
  MASSA_EXPLO_EXTENSION,
  MASSA_EXPLO_URL,
} from '../../const/const';
import { ShowLinkToExplorers } from '../ShowLinkToExplorers';

interface PendingToastProps {
  message: string;
  opId?: string;
}

export function PendingToast(props: PendingToastProps) {
  const { message, opId } = props;
  const isMainnet = import.meta.env.VITE_IS_MAINNET === 'true';

  const buildnetExplorerUrl = `${MASSA_EXPLO_URL}${opId}${MASSA_EXPLO_EXTENSION}`;
  const mainnetExplorerUrl = `${MASSA_EXPLORER_URL}${opId}`;
  const explorerUrl = isMainnet ? mainnetExplorerUrl : buildnetExplorerUrl;

  return (
    <div className="bg-primary p-4 rounded-lg text-center mas-body text-f-primary">
      <p>{message}</p>
      <ShowLinkToExplorers explorerUrl={explorerUrl} currentTxID={opId} />
    </div>
  );
}
