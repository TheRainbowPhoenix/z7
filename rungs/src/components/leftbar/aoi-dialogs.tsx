import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AoiNameSchema } from '@repo/plc-core';
import { useState } from 'react';

type UnsavedChangesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
};

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel,
}: UnsavedChangesDialogProps) {
  const dialogTitle = title ?? 'Unsaved changes';
  const dialogDescription =
    description ??
    'You have unsaved changes in the current draft. Opening another AOI will discard those changes.';
  const dialogConfirmLabel = confirmLabel ?? 'Discard and Open';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{dialogConfirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type AoiNameDialogProps = {
  open: boolean;
  initialName: string;
  title: string;
  description: string;
  submitLabel: string;
  inputId: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

function AoiNameDialog({
  open,
  initialName,
  title,
  description,
  submitLabel,
  inputId,
  onConfirm,
  onCancel,
}: AoiNameDialogProps) {
  const [name, setName] = useState(initialName);
  const [touched, setTouched] = useState(false);

  const validateName = (value: string) => {
    const trimmed = value.trim();
    const result = AoiNameSchema.safeParse(trimmed);
    if (!result.success) {
      return result.error.issues[0]?.message ?? 'Invalid name';
    }
    return null;
  };

  const resetForm = () => {
    setName(initialName);
    setTouched(false);
  };

  const handleSubmit = () => {
    setTouched(true);
    const validationError = validateName(name);
    if (validationError) {
      return;
    }

    const trimmed = name.trim();
    setTouched(false);
    onConfirm(trimmed);
    resetForm();
  };

  const validationError = touched ? validateName(name) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetForm();
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-2"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor={inputId}>Name</Label>
            <Input
              id={inputId}
              autoFocus
              autoComplete="new-password"
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
              name="aoiTitle"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!touched) {
                  setTouched(true);
                }
              }}
              placeholder="My_AOI"
            />
            {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onCancel();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!!validateName(name)}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type NewAoiDialogProps = {
  open: boolean;
  onConfirm: (name: string, language: 'st' | 'ld') => void;
  onCancel: () => void;
};

export function NewAoiDialog({ open, onConfirm, onCancel }: NewAoiDialogProps) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<'st' | 'ld'>('ld');
  const [touched, setTouched] = useState(false);

  const validateName = (value: string) => {
    const trimmed = value.trim();
    const result = AoiNameSchema.safeParse(trimmed);
    if (!result.success) {
      return result.error.issues[0]?.message ?? 'Invalid name';
    }
    return null;
  };

  const resetForm = () => {
    setName('');
    setLanguage('ld');
    setTouched(false);
  };

  const handleSubmit = () => {
    setTouched(true);
    const validationError = validateName(name);
    if (validationError) return;
    const trimmed = name.trim();
    onConfirm(trimmed, language);
    resetForm();
  };

  const validationError = touched ? validateName(name) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetForm();
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create new AOI</DialogTitle>
          <DialogDescription>Enter a name and select a language for the new AOI draft.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-2"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="new-aoi-name">Name</Label>
            <Input
              id="new-aoi-name"
              autoFocus
              autoComplete="new-password"
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
              name="aoiTitle"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!touched) setTouched(true);
              }}
              placeholder="My_AOI"
            />
            {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-aoi-language">Language</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as 'st' | 'ld')}>
              <SelectTrigger id="new-aoi-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ld">Ladder Diagram</SelectItem>
                <SelectItem value="st">Structured Text</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onCancel();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!!validateName(name)}>
              Create AOI
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type RenameAoiDialogProps = {
  open: boolean;
  initialName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

export function RenameAoiDialog({ open, initialName, onConfirm, onCancel }: RenameAoiDialogProps) {
  return (
    <AoiNameDialog
      open={open}
      initialName={initialName}
      title="Rename draft AOI"
      description="Update the name of your current draft."
      submitLabel="Rename"
      inputId="rename-aoi-name"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
