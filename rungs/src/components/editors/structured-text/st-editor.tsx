import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { setEditorHistory, clearEditorHistory } from '@/hooks/use-editor-history';
import {
  TagDefinitionSchema,
  type DataType,
  type RoutineName,
  type TagDefinition,
} from '@repo/plc-core';
import { useStore } from '@/store/store';
import { useSTValidation } from '../../../hooks/use-st-validation';
import { useIsSimulationRunning, useSimulationActions } from '@/hooks/use-simulation';
import { registerSTAutocomplete } from './st-autocomplete';
import { TagDialog, type TagCreatePayload } from '../tags/tag-dialog';
import {
  stLanguageConfiguration,
  stLanguageTokensProvider,
} from '../../../lib/st-language-definition';
import { analytics } from '@/lib/posthog-analytics';

interface STEditorProps {
  routineName: RoutineName;
}

const ST_THEME_NAME = 'studio-st';

type DialogContext = {
  tagName: string;
  dataTypeHint?: DataType;
  arraySizeHint?: number;
};

function normalizeBaseTagName(raw: string): string {
  const cleaned = raw.replace(/['"`]/g, '').trim();
  if (!cleaned) return '';
  const dotIndex = cleaned.indexOf('.');
  const bracketIndex = cleaned.indexOf('[');
  let end = cleaned.length;
  if (dotIndex !== -1) {
    end = Math.min(end, dotIndex);
  }
  if (bracketIndex !== -1) {
    end = Math.min(end, bracketIndex);
  }
  const base = cleaned.slice(0, end);
  return base.replace(/[^A-Za-z0-9_]/g, '');
}

function parseArraySizeHint(raw: string): number | undefined {
  const match = raw.match(/\[(\d+)\]/);
  if (!match) return undefined;
  const parsed = parseInt(match[1], 10);
  if (Number.isNaN(parsed)) return undefined;
  return Math.max(parsed + 1, 1);
}

function deriveDialogContext({
  model,
  marker,
  fallbackName,
  expectedDataType,
}: {
  model: monaco.editor.ITextModel;
  marker: monaco.editor.IMarkerData;
  fallbackName: string;
  expectedDataType?: string;
}): DialogContext {
  const rawToken = model
    .getValueInRange({
      startLineNumber: marker.startLineNumber,
      startColumn: marker.startColumn,
      endLineNumber: marker.endLineNumber,
      endColumn: marker.endColumn,
    })
    .trim();

  const candidateName = normalizeBaseTagName(rawToken || fallbackName);
  const tagName = candidateName || fallbackName;

  const arraySizeHint = parseArraySizeHint(rawToken || fallbackName);

  return {
    tagName,
    dataTypeHint: expectedDataType as DataType | undefined,
    arraySizeHint,
  };
}

export function STEditor({ routineName }: STEditorProps) {
  const aoi = useStore((state) => state.aoi);
  const updateRoutine = useStore((state) => state.updateRoutine);
  const addTag = useStore((state) => state.addTag);
  const updateTag = useStore((state) => state.updateTag);
  const addLog = useStore((state) => state.addLog);
  const routine = aoi?.routines[routineName];
  const isSimulationRunning = useIsSimulationRunning();
  const { stop: stopSimulation } = useSimulationActions();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const completionProviderRef = useRef<monaco.IDisposable | null>(null);
  const latestTagsRef = useRef<TagDefinition[]>([]);
  const createTagActionRef = useRef<monaco.IDisposable | null>(null);
  const editTagActionRef = useRef<monaco.IDisposable | null>(null);
  const markerListenerRef = useRef<monaco.IDisposable | null>(null);
  const cursorListenerRef = useRef<monaco.IDisposable | null>(null);
  const missingTagContextKeyRef = useRef<monaco.editor.IContextKey<boolean> | null>(null);
  const existingTagContextKeyRef = useRef<monaco.editor.IContextKey<boolean> | null>(null);
  const [quickCreateDialogOpen, setQuickCreateDialogOpen] = useState(false);
  const [pendingTagName, setPendingTagName] = useState('');
  const [pendingDataType, setPendingDataType] = useState<DataType | undefined>(undefined);
  const [pendingArraySize, setPendingArraySize] = useState<number | undefined>(undefined);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [pendingEditTag, setPendingEditTag] = useState<TagDefinition | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<typeof monaco | null>(null);

  const { debouncedValidation, performInitialValidation, stDiagnosticsRef } = useSTValidation({
    aoi: aoi || undefined,
    routine,
    monacoRef,
    editorRef,
  });

  useEffect(() => {
    latestTagsRef.current = aoi?.tags ?? [];
  }, [aoi]);

  const existingTagNames = useMemo(() => {
    const names = new Set<string>();
    (aoi?.tags ?? []).forEach((tag) => names.add(tag.name.toLowerCase()));
    return names;
  }, [aoi?.tags]);

  const editExistingNames = useMemo(() => {
    const names = new Set(existingTagNames);
    if (pendingEditTag) {
      names.delete(pendingEditTag.name.toLowerCase());
    }
    return names;
  }, [existingTagNames, pendingEditTag]);

  useEffect(() => {
    if (!monacoInstance) return;

    completionProviderRef.current?.dispose();
    completionProviderRef.current = registerSTAutocomplete({
      monaco: monacoInstance,
      getContext: () => ({
        tags: latestTagsRef.current,
      }),
    });

    return () => {
      completionProviderRef.current?.dispose();
      completionProviderRef.current = null;
    };
  }, [monacoInstance]);

  const handleEditorChange = (value: string | undefined) => {
    if (!aoi || !routine || value === undefined) return;

    if (routineName === 'Logic' && isSimulationRunning) {
      stopSimulation();
      addLog({
        type: 'info',
        message: 'Simulation stopped - Logic routine is being edited',
      });
    }

    const updatedRoutine = {
      ...routine,
      content: value,
    };

    updateRoutine({
      routineName,
      routine: updatedRoutine,
    });

    debouncedValidation(value);
    analytics.recordRoutineEdit(aoi, routineName, routine.type);
  };

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof monaco,
  ) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    setMonacoInstance(monacoInstance);

    if (routine?.content) {
      performInitialValidation(routine.content, editor);
    }
  };

  const triggerUndo = useCallback(() => {
    editorRef.current?.trigger('toolbar', 'undo', null);
  }, []);

  const triggerRedo = useCallback(() => {
    editorRef.current?.trigger('toolbar', 'redo', null);
  }, []);

  const publishHistoryState = useCallback(() => {
    const model = editorRef.current?.getModel();
    setEditorHistory({
      undo: triggerUndo,
      redo: triggerRedo,
      canUndo: model?.canUndo() ?? false,
      canRedo: model?.canRedo() ?? false,
    });
  }, [triggerUndo, triggerRedo]);

  useEffect(() => {
    if (!monacoInstance) return;
    const editorInstance = editorRef.current;
    if (!editorInstance) return;
    publishHistoryState();
    const modelChangeDisposable = editorInstance.onDidChangeModel(publishHistoryState);
    const contentChangeDisposable = editorInstance.onDidChangeModelContent(publishHistoryState);
    return () => {
      modelChangeDisposable.dispose();
      contentChangeDisposable.dispose();
      clearEditorHistory();
    };
  }, [monacoInstance, publishHistoryState]);

  useEffect(() => {
    const editorInstance = editorRef.current;
    if (!monacoInstance || !editorInstance) {
      return;
    }

    const missingTagKey =
      missingTagContextKeyRef.current ??
      editorInstance.createContextKey('studioMissingTagDiagnostic', false);
    missingTagContextKeyRef.current = missingTagKey;

    const existingTagKey =
      existingTagContextKeyRef.current ??
      editorInstance.createContextKey('studioExistingTagAtCursor', false);
    existingTagContextKeyRef.current = existingTagKey;

    const getRelevantMarkers = () => {
      const model = editorInstance.getModel();
      if (!model) {
        return [];
      }
      return monacoInstance.editor.getModelMarkers({ resource: model.uri, owner: 'st-compiler' });
    };

    const positionWithinMarker = (
      position: monaco.Position,
      marker: monaco.editor.IMarkerData,
    ): boolean => {
      if (
        position.lineNumber < marker.startLineNumber ||
        position.lineNumber > marker.endLineNumber
      ) {
        return false;
      }
      if (position.lineNumber === marker.startLineNumber && position.column < marker.startColumn) {
        return false;
      }
      if (position.lineNumber === marker.endLineNumber && position.column > marker.endColumn) {
        return false;
      }
      return true;
    };

    const extractTagName = (message: string): string | null => {
      const match = message.match(/Tag ['"]([^'"`]+)['"]/);
      return match ? match[1] : null;
    };

    const findExpectedDataType = (marker: monaco.editor.IMarkerData): string | undefined => {
      const diagnostics = stDiagnosticsRef.current;
      const match = diagnostics.find(
        (d) =>
          d.code === marker.code &&
          d.line === marker.startLineNumber &&
          d.column === marker.startColumn,
      );
      return match?.expectedDataType;
    };

    let currentActionTagName: string | null = null;
    let currentEditTagName: string | null = null;

    const findMissingTagMarker = () => {
      const position = editorInstance.getPosition();
      if (!position) return null;
      const markers = getRelevantMarkers();
      return markers.find(
        (m) => m.code === 'ST-SEM-001' && positionWithinMarker(position, m),
      ) ?? null;
    };

    const findExistingTagAtCursor = (): TagDefinition | null => {
      const position = editorInstance.getPosition();
      const model = editorInstance.getModel();
      if (!position || !model) return null;
      const wordAtPosition = model.getWordAtPosition(position);
      if (!wordAtPosition) return null;
      const word = wordAtPosition.word.toLowerCase();
      return latestTagsRef.current.find((t) => t.name.toLowerCase() === word) ?? null;
    };

    const resolveTagNameFromMarker = (marker: monaco.editor.IMarkerData): string | null => {
      const model = editorInstance.getModel();
      if (!model) return null;
      const dialogContext = deriveDialogContext({
        model,
        marker,
        fallbackName: extractTagName(marker.message) ?? '',
        expectedDataType: findExpectedDataType(marker),
      });
      return dialogContext.tagName || null;
    };

    const registerCreateTagAction = (tagName: string | null) => {
      createTagActionRef.current?.dispose();
      createTagActionRef.current = null;
      currentActionTagName = tagName;
      if (!tagName) return;
      createTagActionRef.current = editorInstance.addAction({
        id: 'studio.createTagFromUsage',
        label: `Create Tag '${tagName}'...`,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.2,
        precondition: 'studioMissingTagDiagnostic',
        run: () => {
          const marker = findMissingTagMarker();
          if (!marker) {
            missingTagKey.set(false);
            return;
          }
          const rawTagName = extractTagName(marker.message);
          if (!rawTagName) {
            missingTagKey.set(false);
            return;
          }
          const model = editorInstance.getModel();
          if (!model) {
            missingTagKey.set(false);
            return;
          }
          const dialogContext = deriveDialogContext({
            model,
            marker,
            fallbackName: rawTagName,
            expectedDataType: findExpectedDataType(marker),
          });
          const normalizedName = dialogContext.tagName;
          const alreadyExists = latestTagsRef.current.some(
            (tag) => tag.name.toLowerCase() === normalizedName.toLowerCase(),
          );
          if (alreadyExists) {
            missingTagKey.set(false);
            return;
          }
          setPendingTagName(normalizedName);
          setPendingDataType(dialogContext.dataTypeHint ?? 'DINT');
          setPendingArraySize(dialogContext.arraySizeHint);
          setQuickCreateDialogOpen(true);
          missingTagKey.set(false);
        },
      });
    };

    const registerEditTagAction = (tagName: string | null) => {
      editTagActionRef.current?.dispose();
      editTagActionRef.current = null;
      currentEditTagName = tagName;
      if (!tagName) return;
      editTagActionRef.current = editorInstance.addAction({
        id: 'studio.editTag',
        label: `Edit Tag '${tagName}'...`,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.3,
        precondition: 'studioExistingTagAtCursor',
        run: () => {
          const tag = findExistingTagAtCursor();
          if (!tag) {
            existingTagKey.set(false);
            return;
          }
          setPendingEditTag(tag);
          setEditDialogOpen(true);
        },
      });
    };

    const updateContextKey = () => {
      const marker = findMissingTagMarker();
      const hasMissing = Boolean(marker);
      missingTagKey.set(hasMissing);
      const resolvedName = marker ? resolveTagNameFromMarker(marker) : null;
      if (resolvedName !== currentActionTagName) {
        registerCreateTagAction(resolvedName);
      }

      const existingTag = findExistingTagAtCursor();
      const existingName = existingTag?.name ?? null;
      existingTagKey.set(Boolean(existingTag));
      if (existingName !== currentEditTagName) {
        registerEditTagAction(existingName);
      }
    };

    cursorListenerRef.current?.dispose();
    cursorListenerRef.current = editorInstance.onDidChangeCursorPosition(() => {
      updateContextKey();
    });

    markerListenerRef.current?.dispose();
    markerListenerRef.current = monacoInstance.editor.onDidChangeMarkers((resources) => {
      const model = editorInstance.getModel();
      if (!model) return;
      if (resources.some((uri) => uri.toString() === model.uri.toString())) {
        updateContextKey();
      }
    });

    registerCreateTagAction(null);
    registerEditTagAction(null);
    updateContextKey();

    return () => {
      createTagActionRef.current?.dispose();
      createTagActionRef.current = null;
      editTagActionRef.current?.dispose();
      editTagActionRef.current = null;
      cursorListenerRef.current?.dispose();
      cursorListenerRef.current = null;
      markerListenerRef.current?.dispose();
      markerListenerRef.current = null;
      missingTagKey.reset();
      missingTagContextKeyRef.current = null;
      existingTagKey.reset();
      existingTagContextKeyRef.current = null;
    };
  }, [monacoInstance, stDiagnosticsRef]);

  const handleQuickCreateConfirm = ({
    name,
    description,
    usage,
    dataType,
    arraySize,
  }: TagCreatePayload) => {
    const parsedTag = TagDefinitionSchema.safeParse({
      name,
      usage,
      dataType,
      description: description || undefined,
      ...(arraySize &&
        arraySize > 0 && {
          dimension: arraySize,
          elements: {},
        }),
    });
    if (!parsedTag.success) {
      addLog({
        type: 'error',
        message: parsedTag.error.issues[0]?.message ?? 'Invalid tag definition',
      });
      return;
    }
    const runtimeTag = parsedTag.data;

    latestTagsRef.current = [...latestTagsRef.current, runtimeTag];
    addTag(runtimeTag);

    setQuickCreateDialogOpen(false);
    missingTagContextKeyRef.current?.set(false);
    setPendingTagName('');
    setPendingDataType(undefined);
    setPendingArraySize(undefined);
  };

  const handleQuickCreateCancel = () => {
    setQuickCreateDialogOpen(false);
    missingTagContextKeyRef.current?.set(false);
    setPendingTagName('');
    setPendingDataType(undefined);
    setPendingArraySize(undefined);
  };

  const handleEditTagConfirm = ({
    name,
    description,
    usage,
    dataType,
    arraySize,
  }: TagCreatePayload) => {
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

    latestTagsRef.current = latestTagsRef.current.map((t) =>
      t.name.toLowerCase() === pendingEditTag.name.toLowerCase() &&
      t.usage === pendingEditTag.usage
        ? parsed.data
        : t,
    );
    updateTag({
      originalName: pendingEditTag.name,
      originalUsage: pendingEditTag.usage,
      tag: parsed.data,
    });

    setEditDialogOpen(false);
    setPendingEditTag(null);
  };

  const handleEditTagCancel = () => {
    setEditDialogOpen(false);
    setPendingEditTag(null);
  };

  useEffect(() => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;
    const model = editorInstance.getModel();
    if (!model) return;
    performInitialValidation(model.getValue(), editorInstance);
  }, [aoi?.tags, performInitialValidation]);

  const handleEditorWillMount = (monacoInstance: typeof monaco) => {
    monacoInstance.languages.setLanguageConfiguration('st', stLanguageConfiguration);
    monacoInstance.languages.setMonarchTokensProvider('st', stLanguageTokensProvider);

    monacoInstance.editor.defineTheme(ST_THEME_NAME, {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'number', foreground: '1F7AD8' },
        { token: 'number.float', foreground: '1F7AD8' },
        { token: 'number.hex', foreground: '1F7AD8' },
      ],
      colors: {},
    });
  };

  if (!aoi || !routine) {
    return null;
  }

  const routinePath = `aoi-${aoi?.name || 'current'}-${routineName}.st`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden pt-2">
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language="st"
          path={routinePath}
          defaultValue={routine.content || ''}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          beforeMount={handleEditorWillMount}
          options={{
            minimap: { enabled: false },
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 13,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            contextmenu: true,
            selectOnLineNumbers: true,
            glyphMargin: true,
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            renderValidationDecorations: 'on',
            renderLineHighlight: 'all',
            overviewRulerBorder: true,
            overviewRulerLanes: 3,
            hover: { enabled: true },
            fixedOverflowWidgets: true,
          }}
          theme={ST_THEME_NAME}
        />
      </div>
      <TagDialog
        open={quickCreateDialogOpen}
        mode="create"
        initialName={pendingTagName}
        initialDataType={pendingDataType}
        initialArraySize={pendingArraySize}
        existingNames={existingTagNames}
        onConfirm={handleQuickCreateConfirm}
        onCancel={handleQuickCreateCancel}
      />
      <TagDialog
        open={editDialogOpen}
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
    </div>
  );
}
