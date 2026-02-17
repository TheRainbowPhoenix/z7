# Design for SCL STRUCT/UDT Parsing and Transpilation

## Overview
Current support for SCL transpilation to Python handles `FUNCTION` blocks reasonably well but lacks support for user-defined types (UDTs) via `TYPE` declarations and persistent state management needed for `FUNCTION_BLOCK` (FB) constructs. This document outlines the design to address these gaps.

## 1. Type Declarations (`TYPE ... END_TYPE`)

### Parsing Strategy
- Implement a `TypeDecl` AST node.
- Enhance the parser to consume `TYPE` blocks instead of skipping them.
- Parse `STRUCT` definitions recursively to build a schema of fields and their types.
- Store these type definitions in a global `SymbolTable` or `Program` object accessible during transpilation.

**Example SCL:**
```scl
TYPE "Stack_Int.Commands"
   STRUCT
      initialize : Bool;
      pop : Bool;
   END_STRUCT;
END_TYPE
```

**Proposed AST Structure:**
```python
class TypeDecl(AST):
    name: str
    structure: StructType # List of (name, type)
```

### Transpilation Strategy
- Generate Python `class` definitions for each SCL `TYPE`.
- Use `__init__` to initialize fields with default values (e.g., `False` for `Bool`, `0` for `Int`).
- Alternatively, use `dataclasses` or `TypedDict` for lightweight structures.
- Ensure generated classes support dot notation (via `__getattr__` or standard attribute access).

**Generated Python:**
```python
class Stack_Int_Commands:
    def __init__(self):
        self.initialize = False
        self.pop = False
```

## 2. Function Blocks (`FUNCTION_BLOCK`)

### Parsing Strategy
- Treat `FUNCTION_BLOCK` distinct from `FUNCTION`.
- Identify `VAR` sections as persistent state (instance variables).
- Identify `VAR_INPUT`/`VAR_OUTPUT` as interface variables.

### Transpilation Strategy
- Transpile `FUNCTION_BLOCK` into a Python `class`.
- The class will have:
    - `__init__`: Initializes `VAR` (state) variables.
    - `__call__`: The main logic body. Accepts `VAR_INPUT` and `VAR_IN_OUT` as arguments.
- Instantiation: When a `FUNCTION_BLOCK` is declared in another POU's `VAR`, instantiate the Python class.

**Generated Python:**
```python
class Stack:
    def __init__(self):
        # Persistent state (VAR)
        self.depth = 0
        self.stack = [0] * 5
        self.old = Stack_Int_Commands()

    def __call__(self, commands, input_data, settings):
        # Inputs mapped to local context or accessed directly
        # Logic implementation...
        pass
```

## 3. STRUCT and Array Initialization

- **Arrays**: SCL arrays are static-sized. Python lists are dynamic.
- **Transpilation**: Initialize Python lists with default values based on SCL size.
  - `Array[0..5] of Int` -> `[0] * 6`
  - Ensure index bounds checking or rely on Python's exceptions (mocking `IndexError` to return 0 or log error).

## 4. Control Flow: GOTO Support

- SCL uses `GOTO` (e.g., `GOTO RTRN`). Python lacks `goto`.
- **Strategy**:
  - **Forward Jumps to End**: If `GOTO` targets a label at the end of the block (common for cleanup/return), replace with `return` or `break` logic if inside loop, or structure as `try-except` block where `GOTO` raises a custom exception caught at the label.
  - **Loop Simulation**: If `GOTO` creates a loop, wrap the section in `while True:` loop.
  - **Proposed Solution**: Use exception handling for jumps.
    ```python
    class GotoLabelException(Exception): pass

    try:
        # Code block
        if condition: raise GotoLabelException()
    except GotoLabelException:
        pass # Label location
    ```

## 5. Next Steps

1.  **Parser Update**: Implement `TypeDecl` parsing.
2.  **Transpiler Update**: Generate classes for `TYPE` and `FUNCTION_BLOCK`.
3.  **Runtime Support**: Update `Runtime` to handle class instantiation and state preservation.
4.  **Testing**: Verify against `Stack.scl` and other struct-heavy examples.
