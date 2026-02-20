import { useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useOptionalEditableRow, type EditableRowContextType } from '../editable-row-context';

type EditingState = Partial<
  Pick<EditableRowContextType, 'isEditing' | 'focusField' | 'onInputKeyDown'>
>;

interface TagDescriptionCellProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClick?: () => void;
  editingState?: EditingState;
}

export function TagDescriptionCell({
  value,
  onChange,
  placeholder = 'Description',
  onClick,
  editingState,
}: TagDescriptionCellProps) {
  const editableRow = useOptionalEditableRow();
  const isEditing = editingState?.isEditing ?? editableRow?.isEditing ?? false;
  const focusField = editingState?.focusField ?? editableRow?.focusField ?? null;
  const onInputKeyDown = editingState?.onInputKeyDown ?? editableRow?.onInputKeyDown;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && focusField === 'description') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isEditing, focusField]);

  if (isEditing) {
    return (
      <Input
        className="h-8"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder={placeholder}
        ref={inputRef}
      />
    );
  }

  return (
    <div
      className="h-8 flex items-center overflow-hidden whitespace-nowrap cursor-pointer"
      onClick={onClick}
    >
      <span className={`truncate ${!value ? 'text-muted-foreground' : ''}`}>
        {value || 'No description'}
      </span>
    </div>
  );
}

export default TagDescriptionCell;
