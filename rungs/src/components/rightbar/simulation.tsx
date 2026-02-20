import { useState } from 'react';
import { useStore } from '@/store/store';
import { useSimulationState, useSimulationActions } from '@/hooks/use-simulation';
import type { DataType } from '@repo/plc-core';
import { parseParameterValue } from '@/components/editors/tags/tag-field-utils';
import {
  DualSidebar,
  SidebarContent,
  DualSidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/dual-sidebar';
import { TagsGrid } from './tags-grid';
import { TagViewTabs } from './tag-view-tabs';
export default function Simulation() {
  const [activeParameterView, setActiveParameterView] = useState<
    'all' | 'inputs' | 'outputs' | 'local'
  >('all');

  const currentAOI = useStore((state) => state.aoi);
  const simulationState = useSimulationState();
  const { updateParameter } = useSimulationActions();

  const isRunning = simulationState?.isRunning ?? false;

  const handleParameterChange = (parameterName: string, value: string, dataType: DataType) => {
    const parsedValue = parseParameterValue(value, dataType);
    if (parsedValue !== null) {
      updateParameter(parameterName, parsedValue);
    }
  };

  return (
    <DualSidebar side="right" collapsible="offcanvas">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Simulation Status</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="mt-1 ml-2 flex items-center space-x-2">
              <div
                className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className={isRunning ? 'text-green-600' : 'text-red-600'}>
                {isRunning ? 'RUNNING' : 'STOPPED'}
              </span>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
        {currentAOI && simulationState && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Tags View</SidebarGroupLabel>
              <SidebarGroupContent>
                <TagViewTabs
                  activeView={activeParameterView}
                  onViewChange={setActiveParameterView}
                />
              </SidebarGroupContent>
            </SidebarGroup>

            <TagsGrid
              aoi={currentAOI}
              tagView={activeParameterView}
              parameters={simulationState.parameters || {}}
              localTags={simulationState.localTags || {}}
              onParameterChange={handleParameterChange}
            />
          </>
        )}
      </SidebarContent>
      <DualSidebarRail side="right" />
    </DualSidebar>
  );
}
