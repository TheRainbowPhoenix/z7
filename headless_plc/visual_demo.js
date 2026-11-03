import { renderLadder } from './renderer/index.js';
import { parseRungs } from './aoi/parsers/rungs-parser.js';
import { parseLadderLogic } from './compiler/languages/ld/parser/index.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const demoFile = 'Cylinder_LD.rungs';
const filePath = path.join(__dirname, 'tests/data', demoFile);

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const { aoi } = parseRungs(content);

if (!aoi.routines.Logic || aoi.routines.Logic.type !== 'ld') {
    console.error('Logic is not Ladder Diagram');
    process.exit(1);
}

const parseResult = parseLadderLogic(aoi.routines.Logic.content);

if (parseResult.errors.length > 0) {
    console.error('Parse errors:', parseResult.errors);
    process.exit(1);
}

const htmlFragment = renderLadder(parseResult.ast);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ladder Logic Visualization - ${aoi.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .bg-selected { background-color: #e0e7ff; }
        .border-selected { border-color: #6366f1; }
    </style>
</head>
<body class="bg-gray-100 h-screen w-screen flex flex-col">
    <header class="bg-white shadow p-4">
        <h1 class="text-xl font-bold">${aoi.name}</h1>
        <p class="text-gray-600">${aoi.description}</p>
    </header>
    <main class="flex-1 overflow-auto p-8">
        ${htmlFragment}
    </main>
</body>
</html>`;

const outputPath = path.resolve('cylinder_ladder.html');
fs.writeFileSync(outputPath, fullHtml);
console.log(`Visualization generated at: ${outputPath}`);
