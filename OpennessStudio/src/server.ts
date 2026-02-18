import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { walkDirectory } from "./walker.ts";
import { renderFbd, setFileMap } from "./render_fbd.ts";
import { renderDb } from "./render_db.ts";
import { isAbsolute, join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { BlockType, OpennessNode } from "./types.ts";
import { compileProgram, sanitizeIdent } from "./compiler/flow_parser.ts";
import { buildCallGraph } from "./compiler/call_graph.ts";

const app = new Application();
const router = new Router();
const PORT = 8000;

let rootPath = "";
let fileMap: Record<string, string> = {};
let symbolPathMap: Record<string, string> = {};

function buildMapsFromTree(node: OpennessNode) {
  if (node.name) {
    const key = node.name.replace(/\.(xml|scl)$/i, "");
    fileMap[key] = node.path || node.name;
  }

  if (node.type !== BlockType.Folder && node.path) {
    if (node.blockName) {
      symbolPathMap[sanitizeIdent(node.blockName)] = node.path;
    }
  }

  if (node.children) {
    node.children.forEach(buildMapsFromTree);
  }
}

function flattenTree(root: OpennessNode): OpennessNode[] {
  const out: OpennessNode[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const item = stack.pop()!;
    out.push(item);
    if (item.children) stack.push(...item.children);
  }
  return out;
}

async function loadProjectTreeAndMaps(): Promise<OpennessNode> {
  const tree = await walkDirectory(rootPath);
  fileMap = {};
  symbolPathMap = {};
  buildMapsFromTree(tree);
  setFileMap(fileMap);
  return tree;
}

router.get("/api/tree", async (ctx) => {
  try {
    if (!rootPath) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Root path not set" };
      return;
    }

    const tree = await loadProjectTreeAndMaps();
    ctx.response.body = tree;
  } catch (e) {
    console.error(e);
    ctx.response.status = 500;
    ctx.response.body = { error: String(e) };
  }
});

router.get("/api/call-graph", async (ctx) => {
  try {
    if (!rootPath) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Root path not set" };
      return;
    }

    const tree = await loadProjectTreeAndMaps();
    const nodes = flattenTree(tree);
    const program = compileProgram(nodes);
    const graph = buildCallGraph(program);

    const nodePaths: Record<string, string | null> = {};
    for (const node of graph.nodes) {
      nodePaths[node.name] = symbolPathMap[node.name] || null;
    }

    const edgePaths = graph.edges.map((edge) => ({
      ...edge,
      fromPath: symbolPathMap[edge.from] || null,
      toPath: symbolPathMap[edge.to] || null,
    }));

    ctx.response.body = {
      ...graph,
      nodePaths,
      edges: edgePaths,
    };
  } catch (e) {
    console.error(e);
    ctx.response.status = 500;
    ctx.response.body = { error: String(e) };
  }
});

router.get("/api/file", async (ctx) => {
  const path = ctx.request.url.searchParams.get("path");
  if (!path) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Missing path parameter" };
    return;
  }

  try {
    const stat = await Deno.stat(path);
    if (!stat.isFile) {
      ctx.response.status = 404;
      ctx.response.body = "File not found";
      return;
    }

    if (path.endsWith(".xml")) {
      const content = await Deno.readTextFile(path);
      if (content.includes("<SW.Blocks.GlobalDB")) {
        const html = await renderDb(path);
        ctx.response.body = { type: "db", content: html };
      } else {
        const svgHtml = await renderFbd(path);
        ctx.response.body = { type: "fbd", content: svgHtml };
      }
    } else {
      const content = await Deno.readTextFile(path);
      ctx.response.body = { type: "code", content };
    }
  } catch (e) {
    console.error(e);
    ctx.response.status = 500;
    ctx.response.body = { error: String(e) };
  }
});

app.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; worker-src * data: blob: 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval' blob:;",
  );

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
