import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';

type RealFieldProps = {
  value: number;
  editable?: boolean;
  onChange?: (next: string) => void;
};

export function RealField({ value, editable = false, onChange }: RealFieldProps) {
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const isCancelingRef = useRef(false);

  const isEditable = Boolean(editable && onChange);
  const isNaNValue = Number.isNaN(value);
  const safeValue = isNaNValue ? 0 : value;

  // Format display value to always show proper decimals
  const formatDisplayValue = (val: number) => {
    const str = val.toString();
    // If it's a whole number, add .0
    if (!str.includes('.')) {
      return str + '.0';
    }
    // If it starts with ., add 0
    if (str.startsWith('.')) {
      return '0' + str;
    }
    return str;
  };

  const displayValue = formatDisplayValue(safeValue);

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
    setInputValue(safeValue.toString()); // Show raw value for editing
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (isCancelingRef.current) {
      isCancelingRef.current = false;
      return; // Don't save if we're canceling
    }
    if (onChange) {
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue)) {
        // Save the user's input as-is (preserve their precision)
        onChange(inputValue);
        // Display will be updated by effectiveInputValue with formatted value
      } else {
        // Restore original value if invalid
        setInputValue(displayValue);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      // Restore original formatted value and blur
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
      step={0.1}
      disabled={!isEditable}
    />
  );
}

export default RealField;
