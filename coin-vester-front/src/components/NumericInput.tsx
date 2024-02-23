import { InputMessage } from '@massalabs/react-ui-kit';
import { NumericFormat } from 'react-number-format';

type NumericInputProps = {
  value: string;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
};
export function NumericInput(props: NumericInputProps) {
  const { value, placeholder, onChange, error } = props;

  return (
    <div className="flex-row">
      <div className="grid-cols-2">
        <div className="inline h-12">
          <NumericFormat
            className={`w-full default-input h-12 pl-3 pr-10 mb-1`}
            decimalScale={0}
            allowNegative={false}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
          />
          <InputMessage error={error} />
        </div>
      </div>
    </div>
  );
}
