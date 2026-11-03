# Headless PLC - Quick Start

A standalone, headless implementation of a PLC Ladder Logic and Structured Text compiler/runner, extracted from the `rungs` project.

## Prerequisites

- **Node.js** (for running the visual demo and managing dependencies)
- **Deno** (for running the test suite)

## Installation

1. Navigate to the `headless_plc` directory:
   ```bash
   cd headless_plc
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running Tests

Execute the comprehensive test suite using Deno:

```bash
deno run -A tests/runner.js
```
Or via the npm script:
```bash
npm test
```

This runs unit tests for the compiler and runtime, as well as integration tests for all provided `.rungs` logic files.

## Visualization Demo

To generate a visual representation of Ladder Logic (e.g., `Cylinder_LD.rungs`):

1. Run the demo script:
   ```bash
   node visual_demo.js
   ```

2. This will create a file named `cylinder_ladder.html` in the current directory.

3. Open `cylinder_ladder.html` in your web browser to view the rendered logic diagram.

## Project Structure

- `compiler/`: Logic for compiling Ladder (LD) and Structured Text (ST).
- `core/`: Runtime execution engine.
- `renderer/`: Logic for generating HTML from ASTs.
- `tests/`: Test suite and example `.rungs` data files.
- `visual_demo.js`: Script demonstrating how to parse and render a `.rungs` file.
