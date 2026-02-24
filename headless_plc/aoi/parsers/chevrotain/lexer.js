import { createToken, Lexer } from 'chevrotain';
export const Aoi = createToken({ name: 'Aoi', pattern: /aoi/ });
export const Tags = createToken({ name: 'Tags', pattern: /tags/ });
export const Tag = createToken({ name: 'Tag', pattern: /tag/ });
export const Routine = createToken({ name: 'Routine', pattern: /routine/ });
export const Required = createToken({ name: 'Required', pattern: /required/ });
export const Input = createToken({ name: 'Input', pattern: /input/ });
export const Output = createToken({ name: 'Output', pattern: /output/ });
export const St = createToken({ name: 'St', pattern: /\bst\b/ });
export const Ld = createToken({ name: 'Ld', pattern: /\bld\b/ });
export const Major = createToken({ name: 'Major', pattern: /major/ });
export const Minor = createToken({ name: 'Minor', pattern: /minor/ });
export const Build = createToken({ name: 'Build', pattern: /build/ });
export const Author = createToken({ name: 'Author', pattern: /author/ });
export const Desc = createToken({ name: 'Desc', pattern: /desc/ });
export const Note = createToken({ name: 'Note', pattern: /note/ });
export const VisibleByDefault = createToken({
    name: 'VisibleByDefault',
    pattern: /visibleByDefault/,
});
export const Style = createToken({ name: 'Style', pattern: /style/ });
export const StringLiteral = createToken({
    name: 'StringLiteral',
    pattern: /(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
});
export const NumberLiteral = createToken({
    name: 'NumberLiteral',
    pattern: /-?\d+(?:\.\d+)?/,
});
export const BooleanLiteral = createToken({
    name: 'BooleanLiteral',
    pattern: /true|false|1|0/,
});
// Identifiers
export const Identifier = createToken({
    name: 'Identifier',
    pattern: /[A-Za-z_][A-Za-z0-9_]*/,
});
export const LeftParen = createToken({ name: 'LeftParen', pattern: /\(/ });
export const RightParen = createToken({ name: 'RightParen', pattern: /\)/ });
export const LeftBrace = createToken({ name: 'LeftBrace', pattern: /{/ });
export const RightBrace = createToken({ name: 'RightBrace', pattern: /}/ });
export const LeftBracket = createToken({ name: 'LeftBracket', pattern: /\[/ });
export const RightBracket = createToken({ name: 'RightBracket', pattern: /]/ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });
export const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
export const Colon = createToken({ name: 'Colon', pattern: /:/ });
export const Dot = createToken({ name: 'Dot', pattern: /\./ });
export const Assignment = createToken({ name: 'Assignment', pattern: /:=/ });
export const GreaterEqual = createToken({ name: 'GreaterEqual', pattern: />=/ });
export const LessEqual = createToken({ name: 'LessEqual', pattern: /<=/ });
export const NotEqual = createToken({ name: 'NotEqual', pattern: /<>/ });
export const Equal = createToken({ name: 'Equal', pattern: /=/ });
export const Greater = createToken({ name: 'Greater', pattern: />/ });
export const Less = createToken({ name: 'Less', pattern: /</ });
export const Plus = createToken({ name: 'Plus', pattern: /\+/ });
export const Minus = createToken({ name: 'Minus', pattern: /-/ });
export const Multiply = createToken({ name: 'Multiply', pattern: /\*/ });
export const Divide = createToken({ name: 'Divide', pattern: /\// });
export const WhiteSpace = createToken({
    name: 'WhiteSpace',
    pattern: /\s+/,
    group: Lexer.SKIPPED,
});
export const LineComment = createToken({
    name: 'LineComment',
    pattern: /\/\/[^\r\n]*/,
    group: Lexer.SKIPPED,
});
export const BlockComment = createToken({
    name: 'BlockComment',
    pattern: /\/\*[\s\S]*?\*\//,
    group: Lexer.SKIPPED,
});
export const allTokens = [
    WhiteSpace,
    LineComment,
    BlockComment,
    VisibleByDefault,
    Required,
    Routine,
    Output,
    Input,
    Style,
    Tags,
    Major,
    Minor,
    Build,
    Author,
    Note,
    Desc,
    Aoi,
    Tag,
    St,
    Ld,
    StringLiteral,
    NumberLiteral,
    BooleanLiteral,
    Assignment,
    GreaterEqual,
    LessEqual,
    NotEqual,
    Identifier,
    LeftParen,
    RightParen,
    LeftBrace,
    RightBrace,
    LeftBracket,
    RightBracket,
    Comma,
    Semicolon,
    Colon,
    Dot,
    Equal,
    Greater,
    Less,
    Plus,
    Minus,
    Multiply,
    Divide,
];
export const AOILexer = new Lexer(allTokens);
