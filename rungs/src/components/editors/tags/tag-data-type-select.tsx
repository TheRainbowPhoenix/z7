import { useRef } from 'react';
import { type DataType, type TagUsage, isDataTypeAvailableForUsage } from '@repo/plc-core';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  value: DataType;
  usage: TagUsage;
  onChange: (next: DataType) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  className?: string;
};

const ALL_TYPES: DataType[] = ['BOOL', 'DINT', 'REAL', 'TIMER', 'COUNTER', 'FBD_TIMER', 'FBD_COUNTER'];

export default function TagDataTypeSelect({
  value,
  usage,
  onChange,
  onOpenChange,
  open,
  className,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange?.(isOpen);
    if (!isOpen) {
      setTimeout(() => triggerRef.current?.focus(), 0);
    }
  };

  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as DataType)}
      onOpenChange={handleOpenChange}
      open={open}
    >
      <SelectTrigger ref={triggerRef} tabIndex={0} className={className ?? 'h-8'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALL_TYPES.map((type: DataType) => {
          const isAvailable = isDataTypeAvailableForUsage(type, usage);
          return (
            <SelectItem
              key={type}
              value={type}
              disabled={!isAvailable}
              className={!isAvailable ? 'text-muted-foreground' : ''}
            >
              {type}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
