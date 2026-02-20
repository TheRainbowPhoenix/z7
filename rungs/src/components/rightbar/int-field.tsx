import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

type IntFieldProps = {
  value: number;
  editable?: boolean;
  onChange?: (next: string) => void;
};

export function IntField({ value, editable = false, onChange }: IntFieldProps) {
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const isCancelingRef = useRef(false);

  const isEditable = Boolean(editable && onChange);
  const isNaNValue = Number.isNaN(value);
  const safeValue = isNaNValue ? 0 : value | 0;
  const displayValue = safeValue.toString();

  // Derive input value from display value when not editing
  const effectiveInputValue = isEditing ? inputValue : displayValue;

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    if (isEditable) {
      e.currentTarget.select();
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
    isCancelingRef.current = false;
    setInputValue(displayValue);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (isCancelingRef.current) {
      isCancelingRef.current = false;
      return;
    }
    if (onChange) {
      const numValue = parseInt(inputValue, 10);
      if (!isNaN(numValue)) {
        onChange(inputValue);
      } else {
        setInputValue(displayValue);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      isCancelingRef.current = true;
      setInputValue(displayValue);
      setIsEditing(false);
      e.currentTarget.blur();
    }
  };

  return (
    <Input
      type="number"
      value={effectiveInputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      className={`h-5 border-0 bg-transparent p-0 text-right font-mono shadow-none file:text-xs md:text-xs`}
      step={1}
      disabled={!isEditable}
    />
  );
}

export default IntField;
