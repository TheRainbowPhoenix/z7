import type * as monaco from 'monaco-editor';
import {
  getMemberCompletionsForDataType,
  parseTagMemberAccessBase,
  type TagDefinition,
} from '@repo/plc-core';

type CompletionContext = {
  tags: TagDefinition[];
};

type StatementSnippet = {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
};

type InstructionSnippet = {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
};

const STATEMENT_SNIPPETS: StatementSnippet[] = [
  {
    label: 'IF',
    detail: 'Conditional block',
    documentation:
      'Structured Text conditional block.\n\nInserts IF/THEN/END_IF with an editable condition and body.',
    insertText: 'IF ${1:condition} THEN\n\t$0\nEND_IF;',
  },
  {
    label: 'ELSIF',
    detail: 'Conditional branch',
    documentation: 'Adds an ELSIF branch to an IF statement.',
    insertText: 'ELSIF ${1:condition} THEN',
  },
  {
    label: 'ELSE',
    detail: 'Conditional fallback',
    documentation: 'Adds an ELSE branch to an IF statement.',
    insertText: 'ELSE',
  },
  {
    label: 'FOR',
    detail: 'Counted loop',
    documentation: 'Structured Text FOR loop with editable range and body.',
    insertText: 'FOR ${1:index} := ${2:start} TO ${3:end} DO\n\t$0\nEND_FOR;',
  },
  {
    label: 'WHILE',
    detail: 'Conditional loop',
    documentation: 'Structured Text WHILE loop with editable condition and body.',
    insertText: 'WHILE ${1:condition} DO\n\t$0\nEND_WHILE;',
  },
  {
    label: 'REPEAT',
    detail: 'Post-test loop',
    documentation: 'Structured Text REPEAT loop that executes until the condition is true.',
    insertText: 'REPEAT\n\t$0\nUNTIL ${1:condition};\nEND_REPEAT;',
  },
  {
    label: 'CASE',
    detail: 'Multi-branch control',
    documentation: 'Structured Text CASE statement with editable selector and cases.',
    insertText:
      'CASE ${1:selector} OF\n\t${2:value_1}:\n\t\t$0\n\t${3:value_2}:\n\t\t\nEND_CASE;',
  },
  {
    label: 'EXIT',
    detail: 'Exit loop',
    documentation: 'Terminates the closest enclosing loop.',
    insertText: 'EXIT;',
  },
];

const INSTRUCTION_SNIPPETS: InstructionSnippet[] = [
  {
    label: 'TONR',
    detail: 'Timer On Delay (FBD_TIMER)',
    documentation:
      'Timer-on delay instruction.\n\nParameters:\n- timerTag: FBD_TIMER tag or indexed array element',
    insertText: 'TONR(${1:timerTag});',
  },
  {
    label: 'TOFR',
    detail: 'Timer Off Delay (FBD_TIMER)',
    documentation:
      'Timer-off delay instruction.\n\nParameters:\n- timerTag: FBD_TIMER tag or indexed array element',
    insertText: 'TOFR(${1:timerTag});',
  },
  {
    label: 'RTOR',
    detail: 'Retentive Timer (FBD_TIMER)',
    documentation:
      'Retentive timer instruction.\n\nParameters:\n- timerTag: FBD_TIMER tag or indexed array element',
    insertText: 'RTOR(${1:timerTag});',
  },
  {
    label: 'CTUD',
    detail: 'Up/Down Counter (FBD_COUNTER)',
    documentation:
      'Up/down counter instruction.\n\nParameters:\n- counterTag: FBD_COUNTER tag or indexed array element',
    insertText: 'CTUD(${1:counterTag});',
  },
  {
    label: 'SIZE',
    detail: 'SIZE function',
    documentation:
      'Returns the size of an array dimension.\n\nParameters:\n- arrayTag: source array tag\n- destinationTag: DINT tag that receives the result\n\nNote: current compiler only supports dimension 0 and enforces it as a literal.',
    insertText: 'SIZE(${1:arrayTag}, 0, ${2:destinationTag});',
  },
];

const TRIGGER_CHARACTERS = ['.', '(', ',', '[', ':', '='];

const EXPRESSION_CONTEXT_REGEX = /(?::=|=>|\(|,|\+|-|\*|\/|\bTHEN\b|\bDO\b|\bELSIF\b|\bELSE\b|\bUNTIL\b|\bOF\b)\s*$/i;

export function parseMemberAccessBaseFromLine(lineContent: string, startColumn: number) {
  const dotIndex = startColumn - 2;
  if (dotIndex < 0 || lineContent[dotIndex] !== '.') return null;
  const beforeDot = lineContent.slice(0, dotIndex);
  const baseMatch = beforeDot.match(/([a-zA-Z_]\w*(?:\[\d+\])?)$/);
  if (!baseMatch) return null;
  return parseTagMemberAccessBase(baseMatch[1]);
}

export const registerSTAutocomplete = ({
  monaco: monacoInstance,
  getContext,
}: {
  monaco: typeof monaco;
  getContext: () => CompletionContext;
}): monaco.IDisposable => {
  return monacoInstance.languages.registerCompletionItemProvider('st', {
    triggerCharacters: TRIGGER_CHARACTERS,
    provideCompletionItems(model, position, completionContext) {
      const context = getContext();
      const suggestions = buildSuggestions({
        monaco: monacoInstance,
        model,
        position,
        tags: context.tags,
        trigger: completionContext,
      });

      return { suggestions };
    },
  });
};

const buildSuggestions = ({
  monaco: monacoInstance,
  model,
  position,
  tags,
  trigger,
}: {
  monaco: typeof monaco;
  model: monaco.editor.ITextModel;
  position: monaco.Position;
  tags: TagDefinition[];
  trigger?: monaco.languages.CompletionContext;
}): monaco.languages.CompletionItem[] => {
  if (isCommentContext(model, position)) {
    return [];
  }

  const { word, startColumn } = model.getWordUntilPosition(position);
  const range: monaco.IRange = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn,
    endColumn: position.column,
  };

  const lineContent = model.getLineContent(position.lineNumber);

  const charBeforeWord = lineContent[startColumn - 2];
  if (charBeforeWord === '.') {
    const base = parseMemberAccessBaseFromLine(lineContent, startColumn);
    if (!base) return [];
    const tag = tags.find((t) => (t.name ?? '').toUpperCase() === base.tagName.toUpperCase());
    if (tag) {
      const uppercaseMemberPrefix = word.toUpperCase();
      const members = getMemberCompletionsForDataType(tag.dataType);
      return members
        .filter((m) => !uppercaseMemberPrefix || m.key.toUpperCase().startsWith(uppercaseMemberPrefix))
        .map((m, index) => ({
          label: m.key,
          kind: monacoInstance.languages.CompletionItemKind.Field,
          insertText: m.key,
          detail: m.type,
          range,
          sortText: index.toString().padStart(3, '0'),
        }));
    }
    return [];
  }

  const linePrefix = lineContent.slice(0, Math.max(0, position.column - 1));
  const statementPrefix = lineContent.slice(0, Math.max(0, startColumn - 1));
  const trimmedPrefix = linePrefix.trimStart();

  const uppercaseWord = word.toUpperCase();
  const isManualInvoke =
    trigger?.triggerKind === monacoInstance.languages.CompletionTriggerKind.Invoke;
  const isBlankLine = linePrefix.trim().length === 0;

  if (!isManualInvoke && isBlankLine && uppercaseWord.length === 0) {
    return [];
  }

  const isStatementStart = determineStatementBoundary(statementPrefix);
  const allowStatements = shouldSuggestStatements(isStatementStart);
  const allowInstructions = shouldSuggestInstructions(trimmedPrefix, isStatementStart);
  const allowTags = shouldSuggestTags(trimmedPrefix, isStatementStart);

  const suggestions: monaco.languages.CompletionItem[] = [];

  if (allowStatements) {
    STATEMENT_SNIPPETS.forEach((snippet, index) => {
      if (uppercaseWord && !snippet.label.startsWith(uppercaseWord)) {
        return;
      }

      suggestions.push({
        label: snippet.label,
        kind: monacoInstance.languages.CompletionItemKind.Snippet,
        insertText: snippet.insertText,
        insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: snippet.detail,
        documentation: {
          value: snippet.documentation,
        },
        range,
        sortText: `0-${index.toString().padStart(2, '0')}-${snippet.label}`,
      });
    });
  }

  if (allowInstructions) {
    INSTRUCTION_SNIPPETS.forEach((snippet, index) => {
      if (uppercaseWord && !snippet.label.startsWith(uppercaseWord)) {
        return;
      }

      suggestions.push({
        label: snippet.label,
        kind: monacoInstance.languages.CompletionItemKind.Function,
        insertText: snippet.insertText,
        insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: snippet.detail,
        documentation: {
          value: snippet.documentation,
        },
        range,
        sortText: `1-${index.toString().padStart(2, '0')}-${snippet.label}`,
      });
    });
  }

  if (allowTags) {
    const seen = new Set<string>();
    tags.forEach((tag) => {
      const tagName = tag.name ?? '';
      const normalized = tagName.toUpperCase();
      if (seen.has(normalized)) {
        return;
      }

      if (uppercaseWord && !normalized.startsWith(uppercaseWord)) {
        return;
      }

      seen.add(normalized);
      suggestions.push({
        label: tagName,
        kind: monacoInstance.languages.CompletionItemKind.Variable,
        insertText: tagName,
        detail: `${tag.dataType}${tag.usage ? ` • ${tag.usage}` : ''}`,
        documentation: tag.description
          ? { value: tag.description }
          : undefined,
        range,
        sortText: `2-${tagName}`,
      });
    });
  }

  return suggestions;
};

const isCommentContext = (model: monaco.editor.ITextModel, position: monaco.Position): boolean => {
  const lineContent = model.getLineContent(position.lineNumber);
  const prefix = lineContent.slice(0, position.column - 1);

  const inlineCommentIndex = prefix.indexOf('//');
  if (inlineCommentIndex !== -1) {
    return true;
  }

  const textUntilPosition = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  });

  const blockCommentOpens = (textUntilPosition.match(/\(\*/g) ?? []).length;
  const blockCommentCloses = (textUntilPosition.match(/\*\)/g) ?? []).length;

  return blockCommentOpens > blockCommentCloses;
};

const determineStatementBoundary = (statementPrefix: string): boolean => {
  if (!statementPrefix) {
    return true;
  }

  const trimmedStart = statementPrefix.trimStart();
  if (!trimmedStart) {
    return true;
  }

  const trimmedEnd = statementPrefix.trimEnd();
  if (!trimmedEnd) {
    return true;
  }

  if (trimmedEnd.endsWith(';')) {
    return true;
  }

  if (trimmedEnd.endsWith(':')) {
    return true;
  }

  return false;
};

const shouldSuggestStatements = (isStatementStart: boolean): boolean => isStatementStart;

const shouldSuggestInstructions = (trimmedPrefix: string, isStatementStart: boolean): boolean => {
  if (isStatementStart) {
    return true;
  }

  return EXPRESSION_CONTEXT_REGEX.test(trimmedPrefix);
};

const shouldSuggestTags = (trimmedPrefix: string, isStatementStart: boolean): boolean => {
  if (!trimmedPrefix) {
    return false;
  }

  if (EXPRESSION_CONTEXT_REGEX.test(trimmedPrefix)) {
    return true;
  }

  if (isStatementStart) {
    return true;
  }

  return /\b[A-Z0-9_]+\s*$/i.test(trimmedPrefix);
};
