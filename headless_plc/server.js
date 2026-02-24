
import { parseRungs } from './aoi/parsers/rungs-parser.js';
import { compileLadderLogic, parseLadderLogic } from './compiler/languages/ld/index.js';
import { compileStructuredText } from './compiler/languages/st/index.js';
import { renderLadder } from './renderer/html-generator.js';
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";
import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";

const SIMULATION_INTERVAL_MS = 100;
const HISTORY_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const HISTORY_MAX_ENTRIES = HISTORY_DURATION_MS / SIMULATION_INTERVAL_MS;

// State
let isRunning = false;
let simulationInterval = null;
let cycleCount = 0;
let variables = new Map(); // Simulation variables
let runLogic = null; // Compiled function
let ladderAst = null; // AST for visualization
let aoi = null; // AOI Definition
let history = []; // Circular buffer for history
const clients = new Set(); // SSE Clients

function broadcastState() {
    if (clients.size === 0) return;
    const state = {
        status: isRunning ? "running" : "stopped",
        cycle: cycleCount,
        tags: Object.fromEntries(variables)
    };
    const data = `data: ${JSON.stringify(state)}\n\n`;
    clients.forEach(client => {
        try {
            client.enqueue(new TextEncoder().encode(data));
        } catch (e) {
            console.error("Error sending to client", e);
            clients.delete(client);
        }
    });
}

function updateHistory() {
    const entry = {
        timestamp: Date.now(),
        tags: Object.fromEntries(variables)
    };
    history.push(entry);
    if (history.length > HISTORY_MAX_ENTRIES) {
        history.shift();
    }
}

// AOI Test Kit Implementation for internal runner
class AOITestKitImpl {
    constructor(aoi, compiledLogic) {
        this.aoi = aoi;
        this.compiledLogic = compiledLogic;
        this.variables = new Map();
        // Initialize vars
        aoi.tags.forEach(tag => {
            let val = 0;
            if (tag.dataType === 'BOOL') val = 0;
            else if (tag.dataType === 'DINT') val = 0;
            if (tag.defaultValue !== undefined) val = tag.defaultValue;
            this.variables.set(tag.name, val);
        });
    }

    run(inputs = {}) {
        // Update inputs
        for (const [key, value] of Object.entries(inputs)) {
            this.variables.set(key, value);
        }

        const logs = [];
        this.compiledLogic(this.variables, logs, 0); // Single scan

        return {
            outputs: Object.fromEntries(this.variables),
            logs
        };
    }
}

// Test Runner
function runTests(testCode, specificTestName = null) {
    const results = [];

    // Mock environment
    const describe = (name, fn) => {
        // We ignore describe blocks nesting for now, just run the fn
        fn();
    };

    const it = (name, fn) => {
        if (specificTestName && name !== specificTestName) return;

        try {
            // Re-instantiate test kit for isolation?
            // The tests usually instantiate a new runner or reset.
            // But the tests in .rungs use a global `AOITestKit`.
            // We need to inject a fresh `AOITestKit` for each test if possible,
            // or the test code creates one?
            // In .rungs: `const runMotor = (inputs = {}) => AOITestKit.run(inputs).outputs;`
            // So `AOITestKit` is expected to be global.

            // Create a fresh environment for each test
            const testKit = new AOITestKitImpl(aoi, runLogic);
            // We need to expose this testKit to the fn scope.
            // Since we use eval, we can set a global var or pass it.
            // But the code expects `AOITestKit` global.

            // This is tricky with `eval` in JS modules.
            // We will use a Function with `AOITestKit` as argument.
            // But the user code is a block.

            fn();
            results.push({ name, status: 'pass' });
        } catch (e) {
            results.push({ name, status: 'fail', error: e.message });
        }
    };

    const expect = (actual) => ({
        toBe: (expected) => {
            if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`);
        }
    });

    try {
        // We construct a function that takes our mocks and executes the test code
        const testKit = new AOITestKitImpl(aoi, runLogic);
        const testFunc = new Function('describe', 'it', 'expect', 'AOITestKit', testCode);
        testFunc(describe, it, expect, testKit);
    } catch (e) {
        return [{ name: 'Compilation/Execution Error', status: 'fail', error: e.message }];
    }

    return results;
}


// Load Logic Helper
async function loadLogic(content) {
    const { aoi: parsedAoi } = parseRungs(content);
    aoi = parsedAoi;

    if (!aoi.routines.Logic) {
        throw new Error("Logic routine missing");
    }

    const routine = aoi.routines.Logic;
    let code;

    if (routine.type === 'ld') {
         // Parse for Visualization
        const parseResult = parseLadderLogic(routine.content);
        if (parseResult.errors.length > 0) {
            throw new Error("Parse errors: " + JSON.stringify(parseResult.errors));
        }
        ladderAst = parseResult.ast;

        // Compile for Execution
        const compilationResult = compileLadderLogic(routine.content);
        if (!compilationResult.success) {
             throw new Error("Compilation failed: " + JSON.stringify(compilationResult.diagnostics));
        }
        code = compilationResult.code;
    } else {
        ladderAst = null; // No visualization for ST yet
        const compilationResult = compileStructuredText(routine.content);
         if (!compilationResult.success) {
             throw new Error("Compilation failed: " + JSON.stringify(compilationResult.diagnostics));
        }
        code = compilationResult.code;
    }

    // Prepare runtime function
    runLogic = new Function('vars', 'log', '__scanTime', code);

    // Reset Variables
    variables = new Map();
    aoi.tags.forEach(tag => {
        let val = 0;
        if (tag.dataType === 'BOOL') val = 0;
        else if (tag.dataType === 'DINT') val = 0;
        if (tag.defaultValue !== undefined) val = tag.defaultValue;
        variables.set(tag.name, val);
    });

    history = []; // Reset history
    cycleCount = 0;
}


// Load Initial Logic
console.log("Loading MotorControl_LD.rungs...");
try {
    const rungsPath = path.join(Deno.cwd(), "headless_plc", "examples", "MotorControl_LD.rungs");
    const rungsContent = await Deno.readTextFile(rungsPath);
    await loadLogic(rungsContent);
    console.log("Logic loaded and compiled successfully.");
} catch (e) {
    console.error("Error loading logic:", e);
    Deno.exit(1);
}

// Simulation Loop
function runCycle() {
    try {
        const logs = [];
        // Need to pass routines map if we support calls.
        // For now, we only compile one routine 'Logic'.
        // If we want multiple, we should pre-compile all and put them in a map.
        // But `loadLogic` currently compiles just `Logic`.
        // To support `JSR`, `loadLogic` needs to change to compile all routines.

        // Quick fix: Pass an empty object or a map of routines if available.
        // Since we didn't implement multi-routine compilation fully yet (loadLogic only does Logic),
        // JSR will just log warning if called. This is acceptable for this step.
        const routines = {};
        runLogic(variables, logs, SIMULATION_INTERVAL_MS, routines);

        cycleCount++;
        updateHistory();
        broadcastState();
    } catch (e) {
        console.error("Runtime Cycle Error:", e);
        isRunning = false;
        clearInterval(simulationInterval);
        broadcastState();
    }
}

// HTTP Server
Deno.serve({ port: 8000 }, async (req) => {
    const url = new URL(req.url);

    // API
    if (url.pathname === "/api/events") {
        let timer;
        const body = new ReadableStream({
            start(controller) {
                clients.add(controller);
                // Send initial state
                const state = {
                    status: isRunning ? "running" : "stopped",
                    cycle: cycleCount,
                    tags: Object.fromEntries(variables)
                };
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(state)}\n\n`));
            },
            cancel(controller) {
                clients.delete(controller);
            }
        });
        return new Response(body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        });
    }

    if (url.pathname === "/api/start" && req.method === "POST") {
        if (!isRunning) {
            isRunning = true;
            simulationInterval = setInterval(runCycle, SIMULATION_INTERVAL_MS);
            console.log("Simulation Started");
            broadcastState();
        }
        return new Response(JSON.stringify({ status: "running" }), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/stop" && req.method === "POST") {
        if (isRunning) {
            isRunning = false;
            clearInterval(simulationInterval);
            console.log("Simulation Stopped");
            broadcastState();
        }
        return new Response(JSON.stringify({ status: "stopped" }), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/state" && req.method === "GET") {
        const state = {
            status: isRunning ? "running" : "stopped",
            cycle: cycleCount,
            tags: Object.fromEntries(variables)
        };
        return new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/metadata" && req.method === "GET") {
        return new Response(JSON.stringify(aoi.tags), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/history" && req.method === "GET") {
        return new Response(JSON.stringify(history), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/tags") && req.method === "POST") {
        if (url.pathname === "/api/tags") {
             // Create new tag
             try {
                const body = await req.json();
                // Basic validation
                if (!body.name || !body.dataType) throw new Error("Missing name or dataType");

                // Add to AOI
                aoi.tags.push({
                    name: body.name,
                    dataType: body.dataType,
                    usage: body.usage || 'local',
                    defaultValue: body.defaultValue || 0,
                    description: body.description || ''
                });

                // Add to runtime variables
                variables.set(body.name, Number(body.defaultValue || 0));

                return new Response(JSON.stringify({ success: true, tags: aoi.tags }), { headers: { "Content-Type": "application/json" } });
             } catch (e) {
                 return new Response(JSON.stringify({ error: e.message }), { status: 400 });
             }
        } else {
            // Update tag value
            const tagName = url.pathname.split("/").pop();
            try {
                const body = await req.json();
                const val = Number(body.value);
                variables.set(tagName, val);
                broadcastState();
                return new Response(JSON.stringify({ success: true, value: val }), { headers: { "Content-Type": "application/json" } });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 400 });
            }
        }
    }

    if (url.pathname === "/api/logic" && req.method === "GET") {
        const html = renderLadder(ladderAst);
        return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/api/download" && req.method === "GET") {
        // Reconstruct .rungs object
        const rungsObj = {
            version: "2",
            aoi: {
                ...aoi,
                // Update tags from runtime vars? No, download definitions.
            }
        };
        // We need a YAML stringify.
        // Simple manual stringify or use library. Library `std/yaml` is available.
        // But `std/yaml` stringify might be basic.
        // Let's rely on JSON for now if YAML is hard?
        // User asked for "download as rung file", which is YAML.
        // I will use `std/yaml/mod.ts`

        // Note: The `aoi` object has been modified by `parseRungs` (flat tags array).
        // The original format has grouped tags (input, output).
        // `parseRungs` flattened them. We need to reconstruct the structure if we want exact compatibility,
        // or just dump the flat structure if valid.
        // The schema supports flattened tags in `aoi.tags`?
        // Let's check `parseRungs`: it flattened them into `tags` array.
        // We can just dump `aoi` as is, assuming the consumer can handle it?
        // Wait, `parseRungs` reads `groupedTags` and pushes to `tags`.
        // If I write it back, I should probably try to group them again for clean file.

        const outputAoi = { ...aoi };
        const grouped = { input: [], output: [], local: [] };
        outputAoi.tags.forEach(t => {
            const usage = t.usage || 'local';
            if (grouped[usage]) grouped[usage].push(t);
            else grouped.local.push(t);
        });
        outputAoi.tags = grouped;

        const yamlStr = `version: 2\naoi:\n${JSON.stringify(outputAoi, null, 2)}`;
        // Actually, JSON is valid YAML mostly. But let's try to be nicer.
        // Ideally we use a library.
        // For this demo, JSON download is safer.
        return new Response(JSON.stringify({ version: "2", aoi: outputAoi }, null, 2), {
            headers: {
                "Content-Type": "application/x-yaml", // Mimic
                "Content-Disposition": "attachment; filename=logic.rungs"
            }
        });
    }

    if (url.pathname === "/api/upload" && req.method === "POST") {
        try {
            const body = await req.json(); // Expecting JSON or text?
            // If file upload, it's multipart.
            // Simplified: Expect text content in body for now?
            // Or JSON wrapper { content: "..." }
            const content = body.content;
            if (!content) throw new Error("No content");

            await loadLogic(content);
            broadcastState(); // Broadcast new state (reset)
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 400 });
        }
    }

    if (url.pathname === "/api/logic/patch" && req.method === "POST") {
        try {
            const body = await req.json();
            const dsl = body.dsl;
            if (!dsl) throw new Error("No DSL content");

            // Very basic patch: Append to Logic routine
            // We need to parse existing logic, append text, parse again.
            // Or just string append if it's Ladder.
            if (aoi && aoi.routines && aoi.routines.Logic && aoi.routines.Logic.type === 'ld') {
                const currentContent = aoi.routines.Logic.content || "";
                const newContent = currentContent.trim() + (currentContent.trim() ? ";\n" : "") + dsl;

                // Validate
                const parseResult = parseLadderLogic(newContent);
                if (parseResult.errors.length > 0) {
                    throw new Error("Invalid Ladder Logic: " + JSON.stringify(parseResult.errors));
                }

                aoi.routines.Logic.content = newContent;

                // Recompile
                const compilationResult = compileLadderLogic(newContent);
                if (!compilationResult.success) throw new Error("Compilation failed");
                runLogic = new Function('vars', 'log', '__scanTime', '__routines', compilationResult.code);
                ladderAst = parseResult.ast;

                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
            } else {
                throw new Error("Only LD patching supported currently");
            }
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 400 });
        }
    }

    if (url.pathname === "/api/files" && req.method === "GET") {
        const files = [];
        try {
            const examplesDir = path.join(Deno.cwd(), "headless_plc", "examples");
            for await (const entry of Deno.readDir(examplesDir)) {
                if (entry.isFile && entry.name.endsWith(".rungs")) {
                    files.push({ name: entry.name, path: path.join(examplesDir, entry.name) });
                }
            }
        } catch (e) { console.error(e); }
        return new Response(JSON.stringify(files), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/files/") && url.pathname.endsWith("/load") && req.method === "POST") {
        try {
            const fileName = url.pathname.split('/')[3];
            const examplesDir = path.join(Deno.cwd(), "headless_plc", "examples");
            // Sanitize filename needed? Basic check.
            if (fileName.includes("..") || fileName.includes("/")) throw new Error("Invalid filename");

            const filePath = path.join(examplesDir, fileName);
            const content = await Deno.readTextFile(filePath);
            await loadLogic(content);
            broadcastState();
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 400 });
        }
    }

    if (url.pathname === "/api/tests") {
        if (req.method === "GET") {
            // Parse testing.content to find tests
            // Regex to find `it('name', ...)`
            const tests = [];
            const content = aoi.testing?.content || "";
            const regex = /it\s*\(\s*['"](.+?)['"]\s*,\s*\(*\s*\)*\s*=>\s*\{/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                tests.push({ name: match[1] });
            }
            return new Response(JSON.stringify(tests), { headers: { "Content-Type": "application/json" } });
        }
    }

    if (url.pathname === "/api/tests/run" && req.method === "POST") {
        try {
             const body = await req.json();
             const testName = body.testName; // Optional
             const results = runTests(aoi.testing?.content || "", testName);
             return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
             return new Response(JSON.stringify({ error: e.message }), { status: 400 });
        }
    }

    if (url.pathname === "/api/tests/save" && req.method === "POST") {
        try {
            const body = await req.json();
            if (!body.code) throw new Error("No code");
            if (!aoi.testing) aoi.testing = {};
            aoi.testing.content = body.code;
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 400 });
        }
    }

    // Static Files
    let filePath = url.pathname;
    if (filePath === "/") filePath = "/index.html";

    try {
        // Resolve path relative to this script
        const currentUrl = new URL(import.meta.url);
        const currentDir = path.dirname(path.fromFileUrl(currentUrl));
        const distDir = path.join(currentDir, "frontend", "dist");

        const requestedPath = path.join(distDir, filePath.substring(1));

        if (!requestedPath.startsWith(distDir)) {
             return new Response("Access Denied", { status: 403 });
        }

        const file = await Deno.readFile(requestedPath);

        let contentType = "text/plain";
        if (filePath.endsWith(".html")) contentType = "text/html";
        else if (filePath.endsWith(".js")) contentType = "application/javascript";
        else if (filePath.endsWith(".css")) contentType = "text/css";
        else if (filePath.endsWith(".svg")) contentType = "image/svg+xml";

        return new Response(file, { headers: { "Content-Type": contentType } });
    } catch {
        return new Response("Not Found", { status: 404 });
    }
});
