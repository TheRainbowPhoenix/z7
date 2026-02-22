import { CstParser } from 'chevrotain';
import { allTokens, Aoi, Tags, Tag, Routine, Required, Input, Output, St, Ld, Major, Minor, Build, Author, Desc, Note, VisibleByDefault, Style, StringLiteral, NumberLiteral, BooleanLiteral, Identifier, LeftParen, RightParen, LeftBrace, RightBrace, LeftBracket, RightBracket, Comma, Semicolon, Dot, Colon, Equal, Greater, Less, GreaterEqual, LessEqual, NotEqual, Plus, Minus, Multiply, Divide, Assignment, } from './lexer.js';
export class AOIParser extends CstParser {
    constructor() {
        super(allTokens);
        this.performSelfAnalysis();
    }
    // Main rule - AOI definition
    aoiDefinition = this.RULE('aoiDefinition', () => {
        this.CONSUME(Aoi);
        this.SUBRULE(this.identifierOrKeyword, { LABEL: 'aoiName' });
        this.CONSUME(LeftParen);
        this.OPTION(() => {
            this.SUBRULE(this.parameterList);
        });
        this.CONSUME(RightParen);
        this.CONSUME(LeftBrace);
        this.SUBRULE(this.aoiBody);
        this.CONSUME(RightBrace);
    });
    // Parameter list in AOI header
    parameterList = this.RULE('parameterList', () => {
        this.SUBRULE(this.parameter);
        this.MANY(() => {
            this.CONSUME(Comma);
            this.SUBRULE2(this.parameter);
        });
        this.OPTION(() => {
            this.CONSUME2(Comma); // Allow trailing comma
        });
    });
    // Single parameter definition
    parameter = this.RULE('parameter', () => {
        this.OPTION(() => {
            this.CONSUME(Required);
        });
        this.OR([
            { ALT: () => this.CONSUME(Input) },
            { ALT: () => this.CONSUME(Output) },
        ]);
        this.SUBRULE(this.dataTypeWithArray);
        this.SUBRULE2(this.identifierOrKeyword, { LABEL: 'parameterName' });
        // Optional properties block
        this.OPTION2(() => {
            this.CONSUME(LeftBrace);
            this.SUBRULE(this.propertiesBlock);
            this.CONSUME(RightBrace);
        });
        // Optional default value (can come after properties block)
        this.OPTION3(() => {
            this.CONSUME(Assignment);
            this.SUBRULE(this.literal);
        });
    });
    // Data type with optional array dimension (supports multi-dimensional like [2,3,4])
    dataTypeWithArray = this.RULE('dataTypeWithArray', () => {
        this.CONSUME(Identifier, { LABEL: 'dataType' });
        this.OPTION(() => {
            this.CONSUME(LeftBracket);
            this.CONSUME(NumberLiteral, { LABEL: 'arraySize' });
            this.MANY(() => {
                this.CONSUME(Comma);
                this.CONSUME2(NumberLiteral, { LABEL: 'arraySize' });
            });
            this.CONSUME(RightBracket);
        });
    });
    // AOI body content
    aoiBody = this.RULE('aoiBody', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.metadataAssignment) },
                { ALT: () => this.SUBRULE(this.localTagDefinition) },
                { ALT: () => this.SUBRULE(this.routineDefinition) },
            ]);
        });
    });
    // Metadata assignments (major := 1;)
    metadataAssignment = this.RULE('metadataAssignment', () => {
        this.OR([
            { ALT: () => this.CONSUME(Major) },
            { ALT: () => this.CONSUME(Minor) },
            { ALT: () => this.CONSUME(Build) },
            { ALT: () => this.CONSUME(Author) },
            { ALT: () => this.CONSUME(Desc) },
            { ALT: () => this.CONSUME(Note) },
        ]);
        this.CONSUME(Assignment);
        this.SUBRULE(this.literal);
        this.CONSUME(Semicolon);
    });
    // Local tag definition
    localTagDefinition = this.RULE('localTagDefinition', () => {
        this.CONSUME(Tag);
        this.SUBRULE(this.dataTypeWithArray);
        this.CONSUME(Identifier, { LABEL: 'tagName' });
        // Optional properties block
        this.OPTION(() => {
            this.CONSUME(LeftBrace);
            this.SUBRULE(this.propertiesBlock);
            this.CONSUME(RightBrace);
        });
        this.CONSUME(Semicolon);
    });
    // Routine definition
    routineDefinition = this.RULE('routineDefinition', () => {
        this.CONSUME(Routine);
        this.OR([{ ALT: () => this.CONSUME(St) }, { ALT: () => this.CONSUME(Ld) }]);
        this.CONSUME(Identifier, { LABEL: 'routineName' });
        this.CONSUME(LeftParen);
        this.CONSUME(RightParen);
        this.CONSUME(LeftBrace);
        // Skip routine content entirely - we'll extract it with regex
        this.SUBRULE(this.routineContent);
        this.CONSUME(RightBrace);
        // Some sources terminate routine blocks with a trailing semicolon: "};"
        this.OPTION(() => {
            this.CONSUME(Semicolon);
        });
    });
    // Routine content - consume tokens until the matching RightBrace, supporting nesting
    routineContent = this.RULE('routineContent', () => {
        this.MANY(() => {
            this.OR([
                // Nested brace block
                {
                    ALT: () => {
                        this.CONSUME(LeftBrace);
                        this.SUBRULE(this.routineContent);
                        this.CONSUME(RightBrace);
                    },
                },
                // Common token types that may appear in routine bodies
                { ALT: () => this.CONSUME(LeftParen) },
                { ALT: () => this.CONSUME(RightParen) },
                { ALT: () => this.CONSUME(LeftBracket) },
                { ALT: () => this.CONSUME(RightBracket) },
                { ALT: () => this.CONSUME(Comma) },
                { ALT: () => this.CONSUME(Semicolon) },
                { ALT: () => this.CONSUME(Colon) },
                { ALT: () => this.CONSUME(Dot) },
                // Operators
                { ALT: () => this.CONSUME(Equal) },
                { ALT: () => this.CONSUME(Greater) },
                { ALT: () => this.CONSUME(Less) },
                { ALT: () => this.CONSUME(GreaterEqual) },
                { ALT: () => this.CONSUME(LessEqual) },
                { ALT: () => this.CONSUME(NotEqual) },
                { ALT: () => this.CONSUME(Plus) },
                { ALT: () => this.CONSUME(Minus) },
                { ALT: () => this.CONSUME(Multiply) },
                { ALT: () => this.CONSUME(Divide) },
                // Common keywords that appear inside routine bodies (treated as identifiers in this context)
                { ALT: () => this.CONSUME(Desc) },
                { ALT: () => this.CONSUME(Style) },
                { ALT: () => this.CONSUME(VisibleByDefault) },
                { ALT: () => this.CONSUME(Assignment) },
                { ALT: () => this.CONSUME(StringLiteral) },
                { ALT: () => this.CONSUME(NumberLiteral) },
                { ALT: () => this.CONSUME(BooleanLiteral) },
                { ALT: () => this.CONSUME(Identifier) },
            ]);
        });
    });
    // Properties block (inside braces)
    propertiesBlock = this.RULE('propertiesBlock', () => {
        this.MANY(() => {
            this.SUBRULE(this.propertyAssignment);
        });
    });
    // Property assignment within braces
    propertyAssignment = this.RULE('propertyAssignment', () => {
        this.OR([
            // [index] { ... } ;
            {
                GATE: () => this.LA(1).tokenType === LeftBracket &&
                    this.LA(2).tokenType === NumberLiteral &&
                    this.LA(3).tokenType === RightBracket &&
                    this.LA(4).tokenType === LeftBrace,
                ALT: () => {
                    this.CONSUME(LeftBracket);
                    this.CONSUME(NumberLiteral, { LABEL: 'elementIndex' });
                    this.CONSUME(RightBracket);
                    this.CONSUME(LeftBrace);
                    this.SUBRULE(this.propertiesBlock);
                    this.CONSUME(RightBrace);
                    this.OPTION(() => {
                        this.CONSUME(Semicolon);
                    });
                },
            },
            // [index].Path := value;
            {
                GATE: () => this.LA(1).tokenType === LeftBracket &&
                    this.LA(2).tokenType === NumberLiteral &&
                    this.LA(3).tokenType === RightBracket &&
                    this.LA(4).tokenType === Dot,
                ALT: () => {
                    this.CONSUME2(LeftBracket);
                    this.CONSUME2(NumberLiteral, { LABEL: 'arrayIndex' });
                    this.CONSUME2(RightBracket);
                    this.CONSUME(Dot);
                    this.SUBRULE(this.propertyPath);
                    this.CONSUME(Assignment);
                    this.SUBRULE(this.literal);
                    this.CONSUME2(Semicolon);
                },
            },
            // [index] := value;
            {
                GATE: () => this.LA(1).tokenType === LeftBracket &&
                    this.LA(2).tokenType === NumberLiteral &&
                    this.LA(3).tokenType === RightBracket &&
                    this.LA(4).tokenType === Assignment,
                ALT: () => {
                    this.CONSUME3(LeftBracket);
                    this.CONSUME3(NumberLiteral, { LABEL: 'arrayValueIndex' });
                    this.CONSUME3(RightBracket);
                    this.CONSUME3(Assignment);
                    this.SUBRULE3(this.literal);
                    this.CONSUME4(Semicolon);
                },
            },
            // Regular: Path := value;
            {
                ALT: () => {
                    this.SUBRULE2(this.propertyPath);
                    this.CONSUME2(Assignment);
                    this.SUBRULE2(this.literal);
                    this.CONSUME3(Semicolon);
                },
            },
        ]);
    });
    // Property path (identifier with optional dot notation)
    propertyPath = this.RULE('propertyPath', () => {
        this.OR([
            { ALT: () => this.CONSUME(Identifier) },
            { ALT: () => this.CONSUME(Desc) },
            { ALT: () => this.CONSUME(Style) },
            { ALT: () => this.CONSUME(VisibleByDefault) },
        ]);
        this.MANY(() => {
            this.CONSUME(Dot);
            this.OR2([
                { ALT: () => this.CONSUME2(Identifier) },
                { ALT: () => this.CONSUME2(Desc) },
                { ALT: () => this.CONSUME2(Style) },
                { ALT: () => this.CONSUME2(VisibleByDefault) },
            ]);
        });
    });
    // Literal values
    literal = this.RULE('literal', () => {
        this.OR([
            { ALT: () => this.CONSUME(StringLiteral) },
            { ALT: () => this.CONSUME(NumberLiteral) },
            { ALT: () => this.CONSUME(BooleanLiteral) },
            { ALT: () => this.CONSUME(Identifier) }, // For enum-like values
        ]);
    });
    // Allow keywords to be used as identifiers in certain contexts
    identifierOrKeyword = this.RULE('identifierOrKeyword', () => {
        this.OR([
            { ALT: () => this.CONSUME(Identifier) },
            { ALT: () => this.CONSUME(Tags) }, // 'tags' as AOI name
            { ALT: () => this.CONSUME(Tag) }, // 'tag' as identifier
            { ALT: () => this.CONSUME(Style) },
            { ALT: () => this.CONSUME(Desc) },
            { ALT: () => this.CONSUME(Note) },
            { ALT: () => this.CONSUME(Major) },
            { ALT: () => this.CONSUME(Minor) },
            { ALT: () => this.CONSUME(Build) },
            { ALT: () => this.CONSUME(Author) },
        ]);
    });
}
// Create singleton parser instance
export const aoiParser = new AOIParser();
