import { IconButton } from '@/components/ui/icon-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FocusEvent, useState } from 'react';
import { NoteAddOutlined } from '@mui/icons-material';
import { useStore } from '@/store/store';
import { createNewAOIWithTabs } from '../leftbar/aoi-actions';
import { NewAoiDialog, UnsavedChangesDialog } from '../leftbar/aoi-dialogs';

function NewAOI() {
  const isModified = useStore((s) => s.isAoiModified);
  const addLog = useStore((s) => s.addLog);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);

  const handleFocus = (e: FocusEvent<HTMLButtonElement, Element>) => {
    e.preventDefault();
  };

  const createAOI = (name: string, language: 'st' | 'ld') => {
    const result = createNewAOIWithTabs(name, language);
    if (!result.success) {
      addLog({
        type: 'error',
        message: result.message,
      });
    }
  };

  const handleCreate = () => {
    if (isModified) {
      setConfirmOpen(true);
      return;
    }
    setNameDialogOpen(true);
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton onClick={handleCreate} onFocus={(e) => handleFocus(e)} aria-label="Create new AOI">
              <NoteAddOutlined className="size-6" />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Create new AOI</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <UnsavedChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          setNameDialogOpen(true);
        }}
        description="You have unsaved changes in the current draft. Creating a new AOI will discard those changes."
        confirmLabel="Discard and Create"
      />
      <NewAoiDialog
        open={nameDialogOpen}
        onCancel={() => setNameDialogOpen(false)}
        onConfirm={(name, language) => {
          setNameDialogOpen(false);
          createAOI(name, language);
        }}
      />
    </>
  );
}

export default NewAOI;
