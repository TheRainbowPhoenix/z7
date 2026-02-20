import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { formatValue, parseParameterValue } from '../tag-field-utils';
import type { DataType } from '@repo/plc-core';

interface ScalarValueInputProps {
  value: number | string | undefined | null;
  dataType: DataType;
  onChange: (value: number | null) => void;
  isEditing: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onEditingChange?: (editing: boolean) => void;
  className?: string;
}

function EditingInput({
  displayValue,
  dataType,
  onChange,
  placeholder,
  autoFocus,
  onKeyDown,
  onEditingChange,
  className,
}: {
  displayValue: string;
  dataType: DataType;
  onChange: (value: number | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onEditingChange?: (editing: boolean) => void;
  className: string;
}) {
  const [inputValue, setInputValue] = useState(displayValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [autoFocus]);

  const commitValue = (val: string) => {
    const parsed = parseParameterValue(val, dataType);
    const trimmedInput = val.trim();
    if (parsed === null && trimmedInput !== '') {
      setError('Invalid value');
      setInputValue(displayValue);
      return;
    }
    const numericValue = typeof parsed === 'number' ? parsed : null;
    onChange(numericValue);
    setError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setError(null);
    const parsed = parseParameterValue(e.target.value, dataType);
    const trimmedInput = e.target.value.trim();
    if (parsed !== null || trimmedInput === '') {
      const numericValue = typeof parsed === 'number' ? parsed : null;
      onChange(numericValue);
    }
  };

  const handleBlur = () => {
    commitValue(inputValue);
    onEditingChange?.(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue(inputValue);
      onEditingChange?.(false);
      onKeyDown?.(e);
    } else if (e.key === 'Escape') {
      setInputValue(displayValue);
      setError(null);
      onEditingChange?.(false);
      onKeyDown?.(e);
    } else {
      onKeyDown?.(e);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Input
        ref={inputRef}
        className={className}
        type="number"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

export function ScalarValueInput({
  value,
  dataType,
  onChange,
  isEditing,
  placeholder,
  autoFocus,
  onKeyDown,
  onEditingChange,
  className = 'h-8',
}: ScalarValueInputProps) {
  const displayValue = formatValue(value as number | string | undefined | null, dataType);

  const isEmpty = value === undefined || value === null || value === '';
  const emptyDisplay = placeholder ?? 'Set default';

  if (isEditing) {
    return (
      <EditingInput
        displayValue={displayValue}
        dataType={dataType}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        onEditingChange={onEditingChange}
        className={className}
      />
    );
  }

  return (
    <div className={`flex ${className} cursor-pointer items-center`}>
      <span className={`tabular-nums ${isEmpty ? 'text-muted-foreground' : ''}`}>
        {isEmpty ? emptyDisplay : displayValue}
      </span>
    </div>
  );
}

export default ScalarValueInput;
