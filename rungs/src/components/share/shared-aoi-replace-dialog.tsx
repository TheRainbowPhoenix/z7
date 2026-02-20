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
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

type SharedAoiReplaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SharedAoiReplaceDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: SharedAoiReplaceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg space-y-2 p-6 shadow-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Open shared AOI</AlertDialogTitle>
          <AlertDialogDescription asChild className="text-amber-900">
            <div className="mt-1 flex items-center justify-center gap-2 rounded-md border border-amber-800 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="flex h-5 w-6 shrink-0 items-center justify-center text-amber-900">
                <WarningAmberOutlinedIcon className="h-4 w-4" />
              </span>
              <span>Opening this shared AOI will replace your current project.</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-black text-white hover:bg-black/90 focus-visible:ring-black/25"
          >
            Open
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
