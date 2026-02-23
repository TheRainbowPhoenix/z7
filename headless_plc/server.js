
import { parseRungs } from './aoi/parsers/rungs-parser.js';
import { compileLadderLogic, parseLadderLogic } from './compiler/languages/ld/index.js';
import { renderLadder } from './renderer/html-generator.js';
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";

const SIMULATION_INTERVAL_MS = 100;

// State
let isRunning = false;
let simulationInterval = null;
let cycleCount = 0;
let variables = new Map(); // Simulation variables
let runLogic = null; // Compiled function
let ladderAst = null; // AST for visualization

// Load Logic
console.log("Loading MotorControl_LD.rungs...");
try {
    const rungsPath = path.join(Deno.cwd(), "examples", "MotorControl_LD.rungs");
    const rungsContent = await Deno.readTextFile(rungsPath);
    const { aoi } = parseRungs(rungsContent);

    if (!aoi.routines.Logic || aoi.routines.Logic.type !== 'ld') {
        throw new Error("Logic routine missing or not Ladder Diagram");
    }

    const ldContent = aoi.routines.Logic.content;

    // Parse for Visualization
    const parseResult = parseLadderLogic(ldContent);
    if (parseResult.errors.length > 0) {
        console.error("Parse errors:", parseResult.errors);
        Deno.exit(1);
    }
    ladderAst = parseResult.ast;

    // Compile for Execution
    const compilationResult = compileLadderLogic(ldContent);
    if (!compilationResult.success) {
        console.error("Compilation failed:", compilationResult.diagnostics);
        Deno.exit(1);
    }

    // Prepare runtime function
    // The generated code expects: function(vars, log, __scanTime) { ... }
    runLogic = new Function('vars', 'log', '__scanTime', compilationResult.code);

    // Initialize Variables
    aoi.tags.forEach(tag => {
        // Flatten structure for simulation (simplified) or support dot notation?
        // The runtime supports DotDict access on `vars`.
        // But here we are using a Map. The generated code does `context.get('TagName').Member`.
        // So `vars` should contain objects for structured tags.
        // For simple BOOLs, it's just values.
        let val = 0;
        if (tag.dataType === 'BOOL') val = 0;
        else if (tag.dataType === 'DINT') val = 0;
        if (tag.defaultValue !== undefined) val = tag.defaultValue;
        variables.set(tag.name, val);
    });

    console.log("Logic loaded and compiled successfully.");

} catch (e) {
    console.error("Error loading logic:", e);
    Deno.exit(1);
}

// Simulation Loop
function runCycle() {
    try {
        const logs = [];
        // The generated code: context.get(...)
        // 'vars' passed to function is 'context'.
        // It needs a .get() method.
        // And .set() method? Or direct assignment?
        // Let's check generated code behavior.
        // CodeGenerator generates: `context.get("TagName")` and assignment `context.get("TagName").Member = ...` if struct, or `context.set("TagName", ...)`?
        // LDCodeGenerator uses `LDCodeGenerator.emitTagAccess`.
        // Let's assume we pass the Map as 'vars'. Map has .get() and .set() but .set returns Map, generated code might expect different behavior if it tries to assign to properties of the returned value.
        // Actually, for BOOL output: `vars.set('Out', ...)` or `vars.get('Out').Val = ...`?
        // Checking LDCodeGenerator... it generates `context.set('TagName', value)`.
        // So Map is compatible.

        runLogic(variables, logs, SIMULATION_INTERVAL_MS);
        cycleCount++;
    } catch (e) {
        console.error("Runtime Cycle Error:", e);
        isRunning = false;
        clearInterval(simulationInterval);
    }
}

// HTTP Server
Deno.serve({ port: 8000 }, async (req) => {
    const url = new URL(req.url);

    // API
    if (url.pathname === "/api/start" && req.method === "POST") {
        if (!isRunning) {
            isRunning = true;
            simulationInterval = setInterval(runCycle, SIMULATION_INTERVAL_MS);
            console.log("Simulation Started");
        }
        return new Response(JSON.stringify({ status: "running" }), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/stop" && req.method === "POST") {
        if (isRunning) {
            isRunning = false;
            clearInterval(simulationInterval);
            console.log("Simulation Stopped");
        }
        return new Response(JSON.stringify({ status: "stopped" }), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/state" && req.method === "GET") {
        const state = {
            status: isRunning ? "running" : "stopped",
            cycle: cycleCount,
            tags: Object.fromEntries(variables) // Convert Map to Object
        };
        return new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/tags/") && req.method === "POST") {
        const tagName = url.pathname.split("/").pop();
        try {
            const body = await req.json();
            const val = Number(body.value); // Convert to number (0/1)
            variables.set(tagName, val);
            return new Response(JSON.stringify({ success: true, value: val }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 400 });
        }
    }

    if (url.pathname === "/api/logic" && req.method === "GET") {
        const html = renderLadder(ladderAst);
        return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    // Static Files
    if (url.pathname === "/" || url.pathname === "/index.html") {
        try {
            const file = await Deno.readTextFile("public/index.html");
            return new Response(file, { headers: { "Content-Type": "text/html" } });
        } catch { return new Response("Not Found", { status: 404 }); }
    }
    if (url.pathname === "/client.js") {
        try {
            const file = await Deno.readTextFile("public/client.js");
            return new Response(file, { headers: { "Content-Type": "application/javascript" } });
        } catch { return new Response("Not Found", { status: 404 }); }
    }

    return new Response("Not Found", { status: 404 });
});
