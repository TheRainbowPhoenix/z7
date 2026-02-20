import { useStore } from '@/store/store';
import { useCallback, useRef } from 'react';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Editor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export default function TestEditor() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const aoi = useStore((state) => state.aoi);
  const updateTestContent = useStore((state) => state.updateTestContent);
  const testContent = aoi?.testing?.content;

  const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  }, []);

  const handleContentChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;
      updateTestContent(value);
    },
    [updateTestContent],
  );

  if (testContent === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Test file not found</p>
          <p className="text-sm">The requested test file could not be loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="mb-2 flex shrink-0 items-center gap-2 border-b border-slate-300 bg-amber-50 p-2 text-sm text-amber-900">
        <div className="flex h-5 w-6 shrink-0 items-center justify-center text-amber-900">
          <WarningAmberOutlinedIcon className="h-4 w-4" />
        </div>
        <span className="leading-relaxed">
          This feature is experimental. The interface and test format will change, so tests written
          today may not work in future versions. Follow the ongoing discussion{' '}
          <a
            className="underline"
            href="https://github.com/rungs-dev/community/discussions/1"
            rel="noreferrer"
            target="_blank"
          >
            on GitHub
          </a>
          .
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language="javascript"
          value={testContent}
          onChange={handleContentChange}
          onMount={handleEditorDidMount}
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
          }}
          theme="vs"
        />
      </div>
    </div>
  );
}
