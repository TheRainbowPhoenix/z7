import { useEffect } from 'react';
import TagUsageSelect from '../tag-usage-select';
import { useOptionalEditableRow, type EditableRowContextType } from '../editable-row-context';
import type { DataType } from '@repo/plc-core';

type EditingState = Partial<
  Pick<EditableRowContextType, 'isEditing' | 'focusField' | 'setFocusField'>
>;

interface TagUsageCellProps {
  value: 'local' | 'input' | 'output';
  dataType: DataType;
  onChange: (value: 'local' | 'input' | 'output') => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClick?: () => void;
  editingState?: EditingState;
}

export function TagUsageCell({
  value,
  dataType,
  onChange,
  open = false,
  onOpenChange,
  onClick,
  editingState,
}: TagUsageCellProps) {
  const editableRow = useOptionalEditableRow();
  const isEditing = editingState?.isEditing ?? editableRow?.isEditing ?? false;
  const focusField = editingState?.focusField ?? editableRow?.focusField ?? null;
  const setFocusField = editingState?.setFocusField ?? editableRow?.setFocusField;

  useEffect(() => {
    if (isEditing && focusField === 'usage' && onOpenChange) {
      onOpenChange(true);
    }
  }, [isEditing, focusField, onOpenChange]);

  if (isEditing) {
    return (
      <TagUsageSelect
        value={value}
        dataType={dataType}
        open={open}
        onChange={onChange}
        onOpenChange={onOpenChange}
        className="h-8"
      />
    );
  }

  return (
    <div
      className="h-8 flex items-center overflow-hidden whitespace-nowrap cursor-pointer"
      onClick={() => {
        if (onClick) {
          onClick();
        }
        setFocusField?.('usage');
      }}
    >
      <span className="truncate">{value.charAt(0).toUpperCase() + value.slice(1)}</span>
    </div>
  );
}

export default TagUsageCell;
