
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
        runLogic(variables, logs, SIMULATION_INTERVAL_MS);
        cycleCount++;
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
            broadcastState(); // Broadcast change immediately
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
    let filePath = url.pathname;
    if (filePath === "/") filePath = "/index.html";

    // Try to serve from frontend/dist
    try {
        const fullPath = path.join(Deno.cwd(), "frontend", "dist", filePath.substring(1));
        const file = await Deno.readFile(fullPath);

        let contentType = "text/plain";
        if (filePath.endsWith(".html")) contentType = "text/html";
        else if (filePath.endsWith(".js")) contentType = "application/javascript";
        else if (filePath.endsWith(".css")) contentType = "text/css";
        else if (filePath.endsWith(".svg")) contentType = "image/svg+xml";

        return new Response(file, { headers: { "Content-Type": contentType } });
    } catch {
        // Fallback or 404
        return new Response("Not Found", { status: 404 });
    }
});
