/**
 * Custom Structured Text language definition for Monaco Editor (Logix 5000)
 * - Removes 'return' (not valid in Logix 5000)
 * - Adds 'until' (REPEAT…UNTIL)
 * - Drops unsupported double-quoted strings and C-style escapes
 * - Implements single-quoted strings with $-style escapes
 * - Supports integer literal suffixes U/L/UL
 */
import type * as monaco from 'monaco-editor';

export const stLanguageConfiguration: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['(*', '*)'],
  },
  // Logix ST does not use curly braces, so omit them from pairs/brackets
  brackets: [
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '/*', close: '*/' },
    { open: "'", close: "'", notIn: ['string_sq'] },
  ],
  surroundingPairs: [
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: "'", close: "'" },
  ],
};

export const stLanguageTokensProvider: monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.st',
  ignoreCase: true,

  brackets: [
    { token: 'delimiter.parenthesis', open: '(', close: ')' },
    { token: 'delimiter.square', open: '[', close: ']' },
  ],

  // NOTE: 'return' is intentionally removed (not valid in Logix 5000)
  // Use 'exit' instead
  keywords: [
    'if',
    'end_if',
    'elsif',
    'else',
    'case',
    'of',
    'to',
    'do',
    'by',
    'while',
    'repeat',
    'until',
    'end_while',
    'end_repeat',
    'end_case',
    'for',
    'end_for',
    'then',
    'exit', // Correct Logix 5000 instruction
  ],

  // Common primitive and aggregate type keywords (case-insensitive)
  typeKeywords: [
    'int',
    'sint',
    'dint',
    'lint',
    'usint',
    'uint',
    'udint',
    'ulint',
    'real',
    'lreal',
    'time',
    'date',
    'string',
    'bool',
    'byte',
    'word',
    'dword',
    'lword',
    'array',
  ],

  // Boolean literals
  constant: ['true', 'false'],

  operators: [
    '=',
    '>',
    '<',
    ':',
    ':=',
    '<=',
    '>=',
    '<>',
    '&',
    '+',
    '-',
    '*',
    '**',
    'MOD',
    'or',
    'and',
    'not',
    'xor',
  ],

  // $-style escapes used by Logix ST inside single-quoted strings
  // $$ -> '$', $' -> single quote, $R/$r, $L/$l, $N/$n, $P/$p, $T/$t, $hh (hex)
  escapes: /\$(?:\$|'|[RrLlNnPpTt]|[0-9A-Fa-f]{2})/,

  // The main tokenizer
  tokenizer: {
    root: [
      // Base-prefixed integers (allow underscores)
      [/\b(16#[0-9A-Fa-f_]+)\b/, 'number.hex'],
      [/\b(2#[01_]+)\b/, 'number.binary'],
      [/\b(8#[0-7_]+)\b/, 'number.octal'],

      // Floats (no suffixes)
      [/\b\d+\.\d+(?:[eE][+-]?\d+)?\b/, 'number.float'],

      // Integers with optional U/L/UL suffixes (case-insensitive)
      [/\b\d+(?:[uU](?:[lL])?|[lL](?:[uU])?)?\b/, 'number'],

      [/;/, 'delimiter'],
      [/\./, 'delimiter'],

      // identifiers and keywords
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'type',
            '@constant': 'constant',
            '@default': 'identifier',
          },
        },
      ],

      { include: '@whitespace' },
      [/[[\]()]/, '@brackets'],

      // Single-quoted strings only (Logix ST)
      [/'$/, 'string.invalid'],
      [/'/, { token: 'string.quote', bracket: '@open', next: '@string_sq' }],
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/\(\*/, 'comment', '@comment2'],
    ],

    comment: [
      [/[^/*]+/, 'comment'],
      [/\/\*/, 'comment', '@push'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],

    comment2: [
      [/[^(*]+/, 'comment'],
      [/\(\*/, 'comment', '@push'],
      [/\*\)/, 'comment', '@pop'],
      [/[(*]/, 'comment'],
    ],

    // Single-quoted string state with $-escapes
    string_sq: [
      [/[^$']+/, 'string'], // text run without $ or '
      [/''/, 'string'], // doubled single-quote inside string
      [/@escapes/, 'string.escape'],
      [/\$./, 'string.invalid'], // any other $X not matched by @escapes
      [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],
  },
};
