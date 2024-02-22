import { Tooltip } from '@massalabs/react-ui-kit';
import { FiInfo } from 'react-icons/fi';

interface MoreInfoItemProps {
  tooltip?: string;
  title: string;
  value: string;
  valueLabel?: string;
}

export function MoreInfoItem(props: MoreInfoItemProps) {
  const { tooltip, title, value, valueLabel } = props;

  return (
    <div className="flex justify-between min-h-8">
      {tooltip ? (
        <Tooltip body={tooltip}>
          <div className="flex flex-row items-center">
            <FiInfo />
            <p className="ml-2">{title}</p>
          </div>
        </Tooltip>
      ) : (
        title
      )}
      <div className="flex flex-col flex-end text-right">
        <b>{value}</b>
        <p className="mas-caption">{valueLabel}</p>
      </div>
    </div>
  );
}
