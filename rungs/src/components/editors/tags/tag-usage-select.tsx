import { type DataType, isUsageAvailableForDataType, type TagUsage } from '@repo/plc-core';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  value: TagUsage;
  dataType: DataType;
  onChange: (next: TagUsage) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  className?: string;
};

const USAGES: TagUsage[] = ['local', 'input', 'output'];

export default function TagUsageSelect({
  value,
  dataType,
  onChange,
  onOpenChange,
  open,
  className,
}: Props) {
  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as TagUsage)}
      onOpenChange={onOpenChange}
      open={open}
    >
      <SelectTrigger tabIndex={0} className={className ?? 'h-8'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {USAGES.map((usage) => {
          const isAvailable = isUsageAvailableForDataType(usage, dataType);
          return (
            <SelectItem
              key={usage}
              value={usage}
              disabled={!isAvailable}
              className={!isAvailable ? 'text-muted-foreground' : ''}
            >
              {usage.charAt(0).toUpperCase() + usage.slice(1)}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
