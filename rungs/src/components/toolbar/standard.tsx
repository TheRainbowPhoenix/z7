import { ViewSidebarOutlined } from '@mui/icons-material';
import { useDualSidebar } from '@/components/ui/dual-sidebar';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import NewAOI from './new-aoi';
import RunTests from './run-tests';
import SaveAOI from './save-aoi';
import OpenAOI from './open-aoi';
import ShareAOI from './share-aoi';
import UndoRedo from './undo-redo';
import SimulationControls from './simulation-controls';

function Standard() {
  const { toggleLeftSidebar, toggleRightSidebar } = useDualSidebar();
  return (
    <div className="sticky top-0 z-40 flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton onClick={toggleLeftSidebar}>
              <ViewSidebarOutlined className="size-6 scale-x-[-1]" />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Toggle left sidebar</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="mx-1 h-6 w-px bg-gray-200" />

      <div className="flex items-center gap-1">
        <NewAOI />
        <OpenAOI />
        <SaveAOI />
        <ShareAOI />
      </div>

      <div className="mx-1 h-6 w-px bg-gray-200" />

      <UndoRedo />

      <div className="mx-1 h-6 w-px bg-gray-200" />

      <RunTests />

      <div className="mx-1 h-6 w-px bg-gray-200" />

      <SimulationControls />

      <div className="flex-1" />


      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton onClick={toggleRightSidebar}>
              <ViewSidebarOutlined className="size-6" />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Toggle right sidebar</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default Standard;
