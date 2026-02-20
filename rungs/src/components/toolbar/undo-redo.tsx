import { UndoOutlined, RedoOutlined } from '@mui/icons-material';
import { useStore } from '@/store/store';
import { selectActiveTab } from '@/store/selectors';
import { RoutineType } from '@/lib/enums';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEditorHistory } from '@/hooks/use-editor-history';

const isMac =
  typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);
const modKey = isMac ? '\u2318' : 'Ctrl+';

export default function UndoRedo() {
  const activeTab = useStore(selectActiveTab);
  const isEditorTab =
    activeTab?.fileType === RoutineType.LD || activeTab?.fileType === RoutineType.ST;
  const { undo, redo, canUndo, canRedo } = useEditorHistory();

  if (!isEditorTab) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="Undo"
            onMouseDown={(event) => event.preventDefault()}
            onClick={undo}
            disabled={!canUndo}
          >
            <UndoOutlined className="size-5" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>
          <p>Undo ({modKey}Z)</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="Redo"
            onMouseDown={(event) => event.preventDefault()}
            onClick={redo}
            disabled={!canRedo}
          >
            <RedoOutlined className="size-5" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>
          <p>Redo ({isMac ? '\u2318Shift+Z' : 'Ctrl+Y'})</p>
        </TooltipContent>
      </Tooltip>
    </>
  );
}
