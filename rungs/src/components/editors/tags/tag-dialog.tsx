import { useState } from 'react';
import {
  ArraySizeSchema,
  TagNameSchema,
  type DataType,
  type TagUsage,
  getAvailableDataTypes,
  isDataTypeAvailableForUsage,
} from '@repo/plc-core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import TagDataTypeSelect from './tag-data-type-select';
import TagUsageSelect from './tag-usage-select';

export type TagCreatePayload = {
  name: string;
  description: string;
  usage: TagUsage;
  dataType: DataType;
  arraySize?: number;
};

type TagDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  initialName: string;
  initialDataType?: DataType;
  initialArraySize?: number;
  initialUsage?: TagUsage;
  initialDescription?: string;
  existingNames: Set<string>;
  onConfirm: (payload: TagCreatePayload) => void;
  onCancel: () => void;
};

type TagFormProps = {
  mode: 'create' | 'edit';
  initialName: string;
  initialDataType?: DataType;
  initialArraySize?: number;
  initialUsage?: TagUsage;
  initialDescription?: string;
  existingNames: Set<string>;
  onConfirm: (payload: TagCreatePayload) => void;
  onCancel: () => void;
};

function TagForm({
  mode,
  initialName,
  initialDataType,
  initialArraySize,
  initialUsage,
  initialDescription,
  existingNames,
  onConfirm,
  onCancel,
}: TagFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [usage, setUsage] = useState<TagUsage>(initialUsage ?? 'local');
  const [dataType, setDataType] = useState<DataType>(initialDataType ?? 'DINT');
  const [nameError, setNameError] = useState<string | null>(null);
  const [arraySize, setArraySize] = useState(
    initialArraySize !== undefined && initialArraySize !== null ? String(initialArraySize) : '',
  );
  const [arraySizeError, setArraySizeError] = useState<string | null>(null);

  const handleUsageChange = (next: TagUsage) => {
    setUsage(next);
    if (!isDataTypeAvailableForUsage(dataType, next)) {
      setDataType(getAvailableDataTypes(next)[0]);
    }
    if (next !== 'local' && arraySize.trim()) {
      setArraySize('');
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleConfirm = () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    const nameResult = TagNameSchema.safeParse(trimmedName);
    if (!nameResult.success) {
      setNameError(nameResult.error.issues[0]?.message ?? 'Invalid name');
      return;
    }

    if (existingNames.has(trimmedName.toLowerCase())) {
      setNameError('Name already exists');
      return;
    }

    let parsedArraySize: number | undefined;
    if (arraySize.trim()) {
      const sizeResult = ArraySizeSchema.safeParse(arraySize);
      if (!sizeResult.success) {
        setArraySizeError(sizeResult.error.issues[0]?.message ?? 'Invalid array size');
        return;
      }
      parsedArraySize = sizeResult.data ?? undefined;
    }

    setNameError(null);
    setArraySizeError(null);

    onConfirm({
      name: trimmedName,
      description: trimmedDescription,
      usage,
      dataType,
      arraySize: parsedArraySize,
    });
  };

  const isEdit = mode === 'edit';

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleConfirm();
      }}
      className="grid gap-4 py-2"
    >
      <div className="grid gap-2">
        <Label htmlFor="quick-tag-name">Name</Label>
        <Input
          id="quick-tag-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) {
              setNameError(null);
            }
          }}
          onFocus={handleFocus}
          placeholder="MyTag"
          autoFocus
        />
        {nameError ? <p className="text-sm text-red-600">{nameError}</p> : null}
      </div>
      <div className="grid gap-2">
        <Label>Data Type</Label>
        <TagDataTypeSelect
          value={dataType}
          usage={usage}
          onChange={(next) => setDataType(next)}
          className="h-9 w-full"
        />
      </div>
      <div className="grid gap-2">
        <Label>Usage</Label>
        <TagUsageSelect
          value={usage}
          dataType={dataType}
          onChange={handleUsageChange}
          className="h-9 w-full"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="quick-tag-array-size">Array Size (optional)</Label>
        <Input
          id="quick-tag-array-size"
          value={arraySize}
          onChange={(event) => {
            setArraySize(event.target.value);
            if (arraySizeError) {
              setArraySizeError(null);
            }
          }}
          placeholder="Leave blank for scalar"
          inputMode="numeric"
        />
        {arraySizeError ? <p className="text-sm text-red-600">{arraySizeError}</p> : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="quick-tag-description">Description</Label>
        <Input
          id="quick-tag-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional description"
        />
      </div>
      <DialogFooter className="mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onCancel();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {isEdit ? 'Save' : 'Create Tag'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TagDialog({
  open,
  mode,
  initialName,
  initialDataType,
  initialArraySize,
  initialUsage,
  initialDescription,
  existingNames,
  onConfirm,
  onCancel,
}: TagDialogProps) {
  const isEdit = mode === 'edit';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modify the tag properties.'
              : 'Define the tag name, description, usage, and data type.'}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TagForm
            key={`${mode}-${initialName}-${initialDataType}-${initialArraySize}-${initialUsage}-${initialDescription}`}
            mode={mode}
            initialName={initialName}
            initialDataType={initialDataType}
            initialArraySize={initialArraySize}
            initialUsage={initialUsage}
            initialDescription={initialDescription}
            existingNames={existingNames}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
