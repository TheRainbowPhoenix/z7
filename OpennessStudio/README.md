# TIA Portal Openness Parser

This project parses Siemens TIA Portal Openness XML and SCL files into a hierarchical tree structure, extracting metadata like Block Type (OB, FB, FC, DB, UDT), Name, Number, and network logic (LAD).

## Technologies
- Deno
- TypeScript
- fast-xml-parser

## Test it right now

Extract the Exaples/PLC_1.zip.

`deno run --allow-net --allow-read src/server.ts "Examples\PLC_1\Program blocks"`

Open http://localhost:8000 in your browser.

![alt text](image.png)

## File Structure
- `src/index.ts`: Entry point. Runs the parser on the `Examples` directory.
- `src/walker.ts`: Recursively walks directories and handles file identification.
- `src/parser.ts`: Contains logic to parse XML (using fast-xml-parser) and SCL (using regex) to extract block details.
- `src/types.ts`: TypeScript interfaces for the parsed data structure.
- `output_tree.json`: The result of the parsing process.

## How to Run

1. Ensure Deno is installed.
2. Run the parser:
   ```bash
   deno task start
   ```
3. Generate the HTML report:
   ```bash
   deno task html
   ```
4. Render an FBD block diagram:
   ```bash
   deno task render "path/to/Block.xml"
   ```
   Example:
   ```bash
   deno task render "Examples/PLC_1/Program blocks/01 Equipment/Control Panel.xml"
   ```
5. Check `output_tree.html` for the tree view or `output_fbd.html` for the diagram.
