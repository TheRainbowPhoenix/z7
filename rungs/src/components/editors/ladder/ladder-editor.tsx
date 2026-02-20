import { useEffect, useState } from 'react';
import { TagDefinitionSchema, type RoutineName, type TagDefinition, type DataType } from '@repo/plc-core';
import type { TagDefinitionInfo } from '@repo/ladder-editor';
import {
  LadderEditorProvider,
  LadderDndProvider,
  LadderToolbar,
  LadderDiagram,
  useLadderEditor,
  parseLadderDsl,
  serializeLadderState,
  type LadderDiagnostic,
} from '@repo/ladder-editor';
import { useStore } from '@/store/store';
import { useSimulationState, useIsSimulationRunning } from '@/hooks/use-simulation';
import { analytics } from '@/lib/posthog-analytics';
import { setEditorHistory, clearEditorHistory } from '@/hooks/use-editor-history';
import { compileRoutineSafe } from '@/lib/st-compiler-service';
import {
  applyDslToRoutine,
  mapLadderDiagnostics,
  mapLadderParseErrors,
  resolveLadderTag,
} from './ladder-editor-utils';
import { TagDialog, type TagCreatePayload } from '../tags/tag-dialog';
import { CreateTagMenuItems } from './create-tag-menu-items';
import { EditTagMenuItems } from './edit-tag-menu-items';

interface LadderEditorProps {
  routineName: RoutineName;
}

export function LadderEditor({ routineName }: LadderEditorProps) {
  const aoi = useStore((state) => state.aoi);
  const updateRoutine = useStore((state) => state.updateRoutine);
  const addTag = useStore((state) => state.addTag);
  const updateTag = useStore((state) => state.updateTag);
  const addLog = useStore((state) => state.addLog);
  const routine = aoi?.routines[routineName];
  const simState = useSimulationState();
  const isSimulationRunning = useIsSimulationRunning();

  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);
  const [pendingTagName, setPendingTagName] = useState('');
  const [pendingDataType, setPendingDataType] = useState<DataType | undefined>(undefined);

  const [editTagDialogOpen, setEditTagDialogOpen] = useState(false);
  const [pendingEditTag, setPendingEditTag] = useState<TagDefinition | null>(null);
  const [ldDiagnostics, setLdDiagnostics] = useState<LadderDiagnostic[]>([]);

  const existingTagNames = new Set(
    (aoi?.tags ?? []).map((t) => t.name.toLowerCase()),
  );

  const editExistingNames = new Set(existingTagNames);
  if (pendingEditTag) {
    editExistingNames.delete(pendingEditTag.name.toLowerCase());
  }

  const getTag = (tagPath: string) => resolveLadderTag(aoi, simState, tagPath);

  const tags: TagDefinitionInfo[] = (aoi?.tags ?? []).map((tag: TagDefinition) => ({
    name: tag.name,
    dataType: tag.dataType,
    usage: tag.usage,
  }));

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const runtimeDiagnostics = mapLadderDiagnostics(undefined, simState?.runtimeDiagnostics);

      if (!aoi || !routine?.content) {
        if (!cancelled) setLdDiagnostics(runtimeDiagnostics);
        return;
      }

      const parseResult = parseLadderDsl(routine.content);
      const parseDiagnostics = mapLadderParseErrors(parseResult.errors, parseResult.state.rungIds);

      const result = await compileRoutineSafe({
        aoi,
        routine,
        routineName,
      });

      if (cancelled) return;

      if (result.success || result.diagnostics.length > 0) {
        setLdDiagnostics([
          ...parseDiagnostics,
          ...mapLadderDiagnostics(result.diagnostics, simState?.runtimeDiagnostics),
        ]);
        return;
      }

      setLdDiagnostics([
        ...parseDiagnostics,
        ...runtimeDiagnostics,
        {
          rung: 0,
          message: result.error || 'Ladder compiler failed to parse routine content',
          severity: 'error',
          code: 'LD-APP-001',
        },
      ]);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [aoi, routine, routine?.content, routineName, simState?.runtimeDiagnostics]);

  const handleCreateTagRequest = (name: string, dataType: DataType | undefined) => {
    setPendingTagName(name);
    setPendingDataType(dataType);
    setCreateTagDialogOpen(true);
  };

  const handleCreateTagConfirm = ({ name, description, usage, dataType, arraySize }: TagCreatePayload) => {
    const parsed = TagDefinitionSchema.safeParse({
      name,
      usage,
      dataType,
      description: description || undefined,
      ...(arraySize && arraySize > 0 && { dimension: arraySize, elements: {} }),
    });
    if (!parsed.success) {
      addLog({
        type: 'error',
        message: parsed.error.issues[0]?.message ?? 'Invalid tag definition',
      });
      return;
    }
    addTag(parsed.data);
    setCreateTagDialogOpen(false);
    setPendingTagName('');
    setPendingDataType(undefined);
  };

  const handleCreateTagCancel = () => {
    setCreateTagDialogOpen(false);
    setPendingTagName('');
    setPendingDataType(undefined);
  };

  const handleEditTagRequest = (tag: TagDefinition) => {
    setPendingEditTag(tag);
    setEditTagDialogOpen(true);
  };

  const handleEditTagConfirm = ({ name, description, usage, dataType, arraySize }: TagCreatePayload) => {
    if (!pendingEditTag) return;
    const isArrayTag = Boolean(arraySize && arraySize > 0);
    const pendingArraySize = 'dimension' in pendingEditTag ? pendingEditTag.dimension : undefined;

    const preserveDefaultValue =
      !isArrayTag &&
      dataType === pendingEditTag.dataType &&
      pendingArraySize === undefined
        ? pendingEditTag.defaultValue
        : undefined;

    const preserveElements =
      isArrayTag &&
      dataType === pendingEditTag.dataType &&
      arraySize === pendingArraySize
        ? ('elements' in pendingEditTag ? pendingEditTag.elements : undefined)
        : undefined;

    const parsed = TagDefinitionSchema.safeParse({
      id: pendingEditTag.id,
      name,
      usage,
      dataType,
      description: description || undefined,
      ...(!isArrayTag && { defaultValue: preserveDefaultValue }),
      ...(arraySize && arraySize > 0 && {
        dimension: arraySize,
        elements: preserveElements ?? {},
      }),
    });
    if (!parsed.success) {
      addLog({
        type: 'error',
        message: parsed.error.issues[0]?.message ?? 'Invalid tag definition',
      });
      return;
    }
    updateTag({
      originalName: pendingEditTag.name,
      originalUsage: pendingEditTag.usage,
      tag: parsed.data,
    });
    setEditTagDialogOpen(false);
    setPendingEditTag(null);
  };

  const handleEditTagCancel = () => {
    setEditTagDialogOpen(false);
    setPendingEditTag(null);
  };

  if (!routine) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-muted-foreground text-sm">Routine not found</div>
      </div>
    );
  }

  const handleDslChange = (dsl: string) => {
    const currentDsl = routine.content ?? '';
    const nextParsed = parseLadderDsl(dsl);
    const currentParsed = parseLadderDsl(currentDsl);
    const normalizedNextDsl =
      nextParsed.errors.length === 0 ? serializeLadderState(nextParsed.state) : dsl;
    const normalizedCurrentDsl =
      currentParsed.errors.length === 0 ? serializeLadderState(currentParsed.state) : currentDsl;

    if (normalizedNextDsl === normalizedCurrentDsl) {
      return;
    }

    updateRoutine({
      routineName,
      routine: applyDslToRoutine(routine, dsl),
    });

    analytics.recordRoutineEdit(aoi, routineName, routine.type);
  };

  return (
    <LadderEditorProvider
      dslValue={routine.content ?? ''}
      dslOnChange={handleDslChange}
      tags={tags}
      getTag={getTag}
      isSimulationRunning={isSimulationRunning}
      ldDiagnostics={ldDiagnostics}
      renderInstructionMenuExtras={({ instructionData, rungData }) => (
        <>
          <CreateTagMenuItems
            instructionData={instructionData}
            rungData={rungData}
            onCreateTag={handleCreateTagRequest}
          />
          <EditTagMenuItems
            instructionData={instructionData}
            rungData={rungData}
            onEditTag={handleEditTagRequest}
          />
        </>
      )}
    >
      <LadderHistoryBridge />
      <LadderDndProvider>
        <div className="flex h-full w-full flex-col overflow-hidden">
          <LadderToolbar orientation="horizontal" />
          <div className="min-h-0 flex-1 overflow-auto p-2">
            <LadderDiagram />
          </div>
        </div>
      </LadderDndProvider>
      <TagDialog
        open={createTagDialogOpen}
        mode="create"
        initialName={pendingTagName}
        initialDataType={pendingDataType}
        existingNames={existingTagNames}
        onConfirm={handleCreateTagConfirm}
        onCancel={handleCreateTagCancel}
      />
      <TagDialog
        open={editTagDialogOpen}
        mode="edit"
        initialName={pendingEditTag?.name ?? ''}
        initialDataType={pendingEditTag?.dataType}
        initialArraySize={'dimension' in (pendingEditTag ?? {}) ? (pendingEditTag as TagDefinition & { dimension: number }).dimension : undefined}
        initialUsage={pendingEditTag?.usage}
        initialDescription={pendingEditTag?.description}
        existingNames={editExistingNames}
        onConfirm={handleEditTagConfirm}
        onCancel={handleEditTagCancel}
      />
    </LadderEditorProvider>
  );
}

function LadderHistoryBridge() {
  const { actions } = useLadderEditor();
  const undo = actions.undo;
  const redo = actions.redo;
  const canUndo = actions.canUndo;
  const canRedo = actions.canRedo;

  useEffect(() => {
    setEditorHistory({
      undo,
      redo,
      canUndo,
      canRedo,
    });
    return clearEditorHistory;
  }, [undo, redo, canUndo, canRedo]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const eventTarget = event.target as HTMLElement | null;
      if (
        eventTarget instanceof HTMLInputElement ||
        eventTarget instanceof HTMLTextAreaElement ||
        eventTarget?.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const isUndoShortcut = (event.metaKey || event.ctrlKey) && !event.shiftKey && key === 'z';
      const isRedoShortcut =
        (event.metaKey && event.shiftKey && key === 'z') ||
        (event.ctrlKey && event.shiftKey && key === 'z') ||
        (event.ctrlKey && !event.metaKey && key === 'y');

      if (isUndoShortcut && canUndo) {
        event.preventDefault();
        undo();
        return;
      }

      if (isRedoShortcut && canRedo) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  return null;
}
