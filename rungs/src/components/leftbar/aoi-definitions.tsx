import React from 'react';
import { FolderOpenOutlined } from '@mui/icons-material';
import { useStore } from '@/store/store';
import type { AOIDefinition } from '@repo/plc-core';
import { openAOIWithTabs } from './aoi-actions';
import { AOIFolderSection } from './aoi-folder-section';
import { UnsavedChangesDialog } from './aoi-dialogs';
import { analytics } from '@/lib/posthog-analytics';

type ExampleCategory = 'example_aoi' | 'instruction_example';

type LibraryNavMainProps = {
  instructionExamplesTitle: string;
  exampleAoisTitle: string;
};

export default function LibraryNavMain({
  instructionExamplesTitle,
  exampleAoisTitle,
}: LibraryNavMainProps) {
  const instructionExamples = useStore((state) => state.library.instructionExamples);
  const exampleAois = useStore((state) => state.library.exampleAois);
  const isModified = useStore((s) => s.isAoiModified);
  const collapsibleSections = useStore((s) => s.editors.ui.collapsibleSections);
  const toggleCollapsibleSection = useStore((s) => s.toggleCollapsibleSection);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = React.useState(false);
  const [pendingOpen, setPendingOpen] = React.useState<{
    aoi: AOIDefinition;
    category: ExampleCategory;
  } | null>(null);

  const instructionExampleItems = instructionExamples.map((aoi) => {
    return {
      title: aoi.name,
      id: aoi.name,
      aoi,
      isCurrent: false,
      showUnsaved: false,
    };
  });

  const exampleAoiItems = exampleAois.map((aoi) => {
    return {
      title: aoi.name,
      id: aoi.name,
      aoi,
      isCurrent: false,
      showUnsaved: false,
    };
  });

  const instructionExamplesFolder = {
    title: instructionExamplesTitle,
    icon: FolderOpenOutlined,
    isActive: false,
    items: instructionExampleItems,
  } as const;

  const exampleAoisFolder = {
    title: exampleAoisTitle,
    icon: FolderOpenOutlined,
    isActive: false,
    items: exampleAoiItems,
  } as const;

  function getCollapsibleState(sectionId: string): boolean {
    return collapsibleSections[sectionId] ?? true;
  }

  function handleCollapsibleChange(sectionId: string, isOpen: boolean) {
    toggleCollapsibleSection({ sectionId, isOpen });
  }

  function performOpen(aoi: AOIDefinition, category: ExampleCategory) {
    openAOIWithTabs(aoi, { isNewAOI: false });
    analytics.trackExampleAoiOpened(aoi, category);
  }

  function openAOI(aoi: AOIDefinition, category: ExampleCategory) {
    if (isModified) {
      setPendingOpen({ aoi, category });
      setShowUnsavedConfirm(true);
      return;
    }
    performOpen(aoi, category);
  }

  return (
    <>
      <AOIFolderSection
        title={exampleAoisFolder.title}
        icon={exampleAoisFolder.icon}
        items={exampleAoisFolder.items}
        isOpen={getCollapsibleState('example-aois')}
        onOpenChange={(isOpen) => handleCollapsibleChange('example-aois', isOpen)}
        onOpenAOI={(aoi) => openAOI(aoi, 'example_aoi')}
      />
      <AOIFolderSection
        title={instructionExamplesFolder.title}
        icon={instructionExamplesFolder.icon}
        items={instructionExamplesFolder.items}
        isOpen={getCollapsibleState('instruction-examples')}
        onOpenChange={(isOpen) => handleCollapsibleChange('instruction-examples', isOpen)}
        onOpenAOI={(aoi) => openAOI(aoi, 'instruction_example')}
      />
      <UnsavedChangesDialog
        open={showUnsavedConfirm}
        onOpenChange={setShowUnsavedConfirm}
        onConfirm={() => {
          if (pendingOpen) {
            performOpen(pendingOpen.aoi, pendingOpen.category);
          }
          setPendingOpen(null);
          setShowUnsavedConfirm(false);
        }}
        onCancel={() => setPendingOpen(null)}
      />
    </>
  );
}
