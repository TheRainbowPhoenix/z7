import { useRef } from 'react';
import type * as monaco from 'monaco-editor';
import type { STCompilationDiagnostic } from '@repo/plc-compiler';
import { useDebouncedCallback } from './use-debounced-callback';
import type { AOIDefinition, RoutineDefinition } from '@repo/plc-core';
import { compileSourceSafe } from '@/lib/st-compiler-service';

interface UseSTValidationOptions {
  aoi?: AOIDefinition;
  routine?: RoutineDefinition;
  monacoRef: React.RefObject<typeof monaco | null>;
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>;
}

interface MonacoMarkerData {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

function convertToMonacoMarker(
  diagnostic: import('@repo/plc-compiler').CompilationDiagnostic,
): MonacoMarkerData | null {
  if (diagnostic.type !== 'st') return null;
  return {
    startLineNumber: diagnostic.line,
    startColumn: diagnostic.column,
    endLineNumber: diagnostic.endLine || diagnostic.line,
    endColumn: diagnostic.endColumn || diagnostic.column + 1,
    message: diagnostic.message,
    severity: diagnostic.severity,
    code: diagnostic.code,
  };
}

export function useSTValidation({ aoi, monacoRef, editorRef }: UseSTValidationOptions) {
  const stDiagnosticsRef = useRef<STCompilationDiagnostic[]>([]);

  const setDiagnosticMarkers = (
    customMarkers: MonacoMarkerData[],
    editorInstance?: monaco.editor.IStandaloneCodeEditor,
  ) => {
    const editor = editorInstance || editorRef.current;
    if (!editor || !monacoRef.current) return;

    const model = editor.getModel();
    if (!model) return;

    try {
      const monacoMarkers: monaco.editor.IMarkerData[] = customMarkers.map((marker) => ({
        startLineNumber: marker.startLineNumber,
        startColumn: marker.startColumn,
        endLineNumber: marker.endLineNumber,
        endColumn: marker.endColumn,
        message: marker.message,
        severity:
          marker.severity === 'error'
            ? monacoRef.current!.MarkerSeverity.Error
            : monacoRef.current!.MarkerSeverity.Warning,
        code: marker.code,
        source: 'ST Compiler',
      }));

      monacoRef.current.editor.setModelMarkers(model, 'st-compiler', monacoMarkers);
    } catch (error) {
      console.error('Failed to set diagnostic markers:', error);
    }
  };

  const validateSTCode = async (code: string) => {
    if (!code || code.trim() === '') {
      return {
        diagnostics: [],
        monacoMarkers: [],
        hasErrors: false,
        errorCount: 0,
        warningCount: 0,
      };
    }

    const result = await compileSourceSafe({ aoi, source: code });

    stDiagnosticsRef.current = result.diagnostics.filter(
      (d): d is STCompilationDiagnostic => d.type === 'st',
    );

    const monacoMarkers: MonacoMarkerData[] = result.diagnostics
      .map(convertToMonacoMarker)
      .filter((m): m is MonacoMarkerData => m !== null);

    const errorCount = result.diagnostics.filter((d) => d.severity === 'error').length;
    const warningCount = result.diagnostics.filter((d) => d.severity === 'warning').length;

    return {
      diagnostics: result.diagnostics,
      monacoMarkers,
      hasErrors: !result.success,
      errorCount,
      warningCount,
    };
  };

  const validationRunIdRef = useRef(0);

  const debouncedValidation = useDebouncedCallback(async (code: unknown) => {
    if (typeof code !== 'string') return;
    const runId = ++validationRunIdRef.current;
    try {
      const validationResult = await validateSTCode(code);
      if (runId !== validationRunIdRef.current) return;

      setDiagnosticMarkers(validationResult.monacoMarkers);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  }, 500);

  const performInitialValidation = async (
    content: string,
    editorInstance?: monaco.editor.IStandaloneCodeEditor,
  ) => {
    if (!content) return;

    try {
      const runId = ++validationRunIdRef.current;
      const validationResult = await validateSTCode(content);
      if (runId !== validationRunIdRef.current) return;
      setDiagnosticMarkers(validationResult.monacoMarkers, editorInstance);
    } catch (error) {
      console.error('Initial validation failed:', error);
    }
  };

  const validateForSimulation = async (code: string) => {
    try {
      const validationResult = await validateSTCode(code);
      return {
        hasErrors: validationResult.hasErrors,
        errors: validationResult.diagnostics.filter((d) => d.severity === 'error'),
        warnings: validationResult.diagnostics.filter((d) => d.severity === 'warning'),
        diagnostics: validationResult.diagnostics,
      };
    } catch (error) {
      console.error('Validation for simulation failed:', error);
      return {
        hasErrors: true,
        errors: [
          { message: 'Validation failed due to an internal error', severity: 'error' as const },
        ],
        warnings: [],
        diagnostics: [],
      };
    }
  };

  return {
    debouncedValidation,
    performInitialValidation,
    validateSTCode,
    validateForSimulation,
    setDiagnosticMarkers,
    stDiagnosticsRef,
  };
}
