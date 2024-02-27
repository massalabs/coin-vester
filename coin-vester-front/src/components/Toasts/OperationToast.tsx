import { generateExplorerLink } from '../../utils/massa-utils';
import Intl from '../../i18n/i18n';
import { FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi';

type OperationToastProps = {
  title: string;
  variant?: 'success' | 'error';
  operationId?: string;
};

export function OperationToast({
  title,
  operationId,
  variant,
}: OperationToastProps) {
  const iconVariants = {
    success: FiCheckCircle,
    error: FiAlertCircle,
    default: FiInfo,
  };
  const colorVariants = {
    success: 'text-s-success bg-s-success',
    error: 'text-s-error bg-s-error',
    default: '',
  };

  const Icon = iconVariants[variant ?? 'default'];
  const color = colorVariants[variant ?? 'default'];

  return (
    <div className="flex flex-row bg-primary p-2 rounded-xl text-center text-f-primary items-center">
      <div
        className={`inline-flex items-center justify-center flex-shrink-0
          w-10 h-10 mr-2 bg-opacity-25 rounded-lg ${color}`}
      >
        <Icon size={24} />
      </div>
      <div className="inline-flex mas-h2 text-center items-between justify-center">
        <p className="mas-body mr-4">{title}</p>
        {operationId && (
          <a
            href={generateExplorerLink(operationId)}
            target="_blank"
            rel="noreferrer"
            className="mas-caption-underline self-center"
          >
            {Intl.t('toast.explorer')}
          </a>
        )}
      </div>
    </div>
  );
}
