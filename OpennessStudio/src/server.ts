import { Application, Router, Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { walkDirectory } from "./walker.ts";
import { renderFbd, buildFileMap, setFileMap } from "./render_fbd.ts";
import { renderDb } from "./render_db.ts";
import { join, isAbsolute } from "https://deno.land/std@0.208.0/path/mod.ts";
import { BlockType, OpennessNode } from "./types.ts";

const app = new Application();
const router = new Router();
const PORT = 8000;

// Root folder storage
let rootPath = "";
let fileMap: Record<string, string> = {};

// Helper to build file map from tree
function buildFileMapFromTree(node: OpennessNode) {
    if (node.name) {
        // Map Name without extension -> File Path
        const key = node.name.replace(/\.(xml|scl)$/i, "");
        fileMap[key] = node.path || node.name; // Use full path if available
    }
    if (node.children) {
        node.children.forEach(buildFileMapFromTree);
    }
}

// 1. Get Project Tree
router.get("/api/tree", async (ctx) => {
    try {
        if (!rootPath) {
            ctx.response.status = 400;
            ctx.response.body = { error: "Root path not set" };
            return;
        }
        const tree = await walkDirectory(rootPath);

        // Update file map for FBD linking
        fileMap = {};
        buildFileMapFromTree(tree);
        // We also need to populate the map in render_fbd.ts
        // But since we are importing setFileMap, we can do:
        // Actually, we need to map "Name" -> "Relative Path or Absolute Path" that the frontend can use or the renderer uses?
        // The render_fbd uses the map to generate links.
        // It uses Name -> Path.
        // And the frontend will use that path to call /api/file?path=...
        // So we should map Name -> Absolute Path.
        // walker.ts sets 'path' as absolute path.

        // Pass map to renderer
        setFileMap(fileMap);

        ctx.response.body = tree;
    } catch (e) {
        console.error(e);
        ctx.response.status = 500;
        ctx.response.body = { error: String(e) };
    }
});

// 2. Get File Content (SCL or Rendered FBD or DB)
router.get("/api/file", async (ctx) => {
    const path = ctx.request.url.searchParams.get("path");
    if (!path) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Missing path parameter" };
        return;
    }

    try {
        let cleanPath = path;
        // If path is relative or just a name from the map linkage, we might need to resolve it?
        // The frontend will receive full paths from the tree.
        // But FBD links might be using whatever was in the map.
        // If map has absolute paths, we are good.

        // Security check? For a local tool, we assume trust but technically...
        // Just checking existence.

        const stat = await Deno.stat(cleanPath);
        if (!stat.isFile) {
            ctx.response.status = 404;
            ctx.response.body = "File not found";
            return;
        }

        if (cleanPath.endsWith(".xml")) {
            // Check Content Type
            const content = await Deno.readTextFile(cleanPath);
            if (content.includes("<SW.Blocks.GlobalDB")) {
                // DB
                // We need to parse and render table
                // I will create a temporary parser tool here or use the newly created one
                // I imported renderDb above.
                const html = await renderDb(cleanPath); // Pass path
                ctx.response.body = { type: "db", content: html };
            } else {
                // Render FBD
                // We pass the full path.
                const svgHtml = await renderFbd(cleanPath);
                ctx.response.body = { type: "fbd", content: svgHtml };
            }
        } else {
            // Return raw text (SCL or others)
            const content = await Deno.readTextFile(cleanPath);
            ctx.response.body = { type: "code", content: content };
        }
    } catch (e) {
        console.error(e);
        ctx.response.status = 500;
        ctx.response.body = { error: String(e) };
    }
});

// Serve Frontend
app.use(async (ctx, next) => {
    ctx.response.headers.set("Access-Control-Allow-Origin", "*");
    // Allow everything for local dev to unblock Monaco workers
    ctx.response.headers.set("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; worker-src * data: blob: 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval' blob:;");

    try {
        await ctx.send({
            root: `${Deno.cwd()}/public`,
            index: "index.html",
        });
    } catch {
        await next();
    }
});

app.use(router.routes());
app.use(router.allowedMethods());

// Start
if (import.meta.main) {
    const args = Deno.args;
    if (args.length > 0) {
        rootPath = args[0];
        if (!isAbsolute(rootPath)) {
            rootPath = join(Deno.cwd(), rootPath);
        }
    } else {
        console.error("Please provide a root folder path.");
        Deno.exit(1);
    }

    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Analyzing: ${rootPath}`);
    await app.listen({ port: PORT });
}
