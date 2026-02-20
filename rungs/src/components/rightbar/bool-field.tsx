import { Switch } from '@/components/ui/switch';

type BoolFieldProps = {
  value: number;
  editable?: boolean;
  onChange?: (next: string) => void;
  className?: string;
};

export function BoolField({ value, editable = false, onChange, className }: BoolFieldProps) {
  const isTrue = value === 1;
  const isEditable = Boolean(editable && onChange);
  const handleChange: ((checked: boolean) => void) | undefined = isEditable
    ? (checked) => onChange!(checked ? '1' : '0')
    : undefined;

  return (
    <Switch
      checked={isTrue}
      disabled={!isEditable}
      onCheckedChange={handleChange}
      className={className}
    />
  );
}

export default BoolField;
