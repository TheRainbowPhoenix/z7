import { createContext, useContext, ReactNode } from 'react';

export type FocusField = null | 'name' | 'value' | 'description' | 'type' | 'usage' | 'arraySize';

export interface EditableRowContextType {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  focusField: FocusField;
  setFocusField: (field: FocusField) => void;
  saveIfValid: () => boolean;
  handleCancel: () => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const EditableRowContext = createContext<EditableRowContextType | null>(null);

export function useEditableRow(): EditableRowContextType {
  const context = useContext(EditableRowContext);
  if (!context) {
    throw new Error('useEditableRow must be used within an EditableRowProvider');
  }
  return context;
}

export function useOptionalEditableRow(): EditableRowContextType | null {
  return useContext(EditableRowContext);
}

interface EditableRowProviderProps {
  children: ReactNode;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  focusField: FocusField;
  setFocusField: (field: FocusField) => void;
  saveIfValid: () => boolean;
  handleCancel: () => void;
}

export function EditableRowProvider({
  children,
  isEditing,
  setIsEditing,
  focusField,
  setFocusField,
  saveIfValid,
  handleCancel,
}: EditableRowProviderProps) {
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveIfValid();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const contextValue: EditableRowContextType = {
    isEditing,
    setIsEditing,
    focusField,
    setFocusField,
    saveIfValid,
    handleCancel,
    onInputKeyDown,
  };

  return (
    <EditableRowContext.Provider value={contextValue}>
      {children}
    </EditableRowContext.Provider>
  );
}
