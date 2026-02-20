import { useEffect } from 'react';
import TagDataTypeSelect from '../tag-data-type-select';
import { useOptionalEditableRow, type EditableRowContextType } from '../editable-row-context';
import type { DataType } from '@repo/plc-core';

type EditingState = Partial<
  Pick<EditableRowContextType, 'isEditing' | 'focusField' | 'setFocusField'>
>;

interface TagDataTypeCellProps {
  value: DataType;
  usage: 'local' | 'input' | 'output';
  onChange: (value: DataType) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tagData?: { dataType: DataType; dimension?: number };
  onClick?: () => void;
  editingState?: EditingState;
}

export function TagDataTypeCell({
  value,
  usage,
  onChange,
  open = false,
  onOpenChange,
  tagData,
  onClick,
  editingState,
}: TagDataTypeCellProps) {
  const editableRow = useOptionalEditableRow();
  const isEditing = editingState?.isEditing ?? editableRow?.isEditing ?? false;
  const focusField = editingState?.focusField ?? editableRow?.focusField ?? null;
  const setFocusField = editingState?.setFocusField ?? editableRow?.setFocusField;

  useEffect(() => {
    if (isEditing && focusField === 'type' && onOpenChange) {
      onOpenChange(true);
    }
  }, [isEditing, focusField, onOpenChange]);

  if (isEditing) {
    return (
      <TagDataTypeSelect
        value={value}
        usage={usage}
        open={open}
        onChange={onChange}
        onOpenChange={onOpenChange}
        className="h-8"
      />
    );
  }

  const displayValue =
    tagData && 'dimension' in tagData && tagData.dimension !== undefined
      ? `${tagData.dataType}[${tagData.dimension}]`
      : value;

  return (
    <div
      className="h-8 flex items-center cursor-pointer"
      onClick={() => {
        if (onClick) {
          onClick();
        }
        setFocusField?.('type');
      }}
    >
      <span>{displayValue}</span>
    </div>
  );
}

export default TagDataTypeCell;
