import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { walkDirectory } from "./walker.ts";
import { renderFbd, setFileMap } from "./render_fbd.ts";
import { renderDb } from "./render_db.ts";
import { isAbsolute, join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { BlockType, OpennessNode } from "./types.ts";
import { compileProgram, sanitizeIdent } from "./compiler/flow_parser.ts";
import { buildCallGraph } from "./compiler/call_graph.ts";
import type { BlockIR, ProgramIR } from "./compiler/ir.ts";

const app = new Application();
const router = new Router();
const PORT = 8000;

let rootPath = "";
let fileMap: Record<string, string> = {};
let symbolPathMap: Record<string, string> = {};
let pathSymbolMap: Record<string, string> = {};

interface TypeUsageRef {
  path: string;
  blockName: string;
  ownerType: string;
  section: string;
  member: string;
}

interface LocalTypeInfo {
  name: string;
  path: string | null;
  sizeBytes: number;
  usageCount: number;
}

function buildMapsFromTree(node: OpennessNode) {
  if (node.name) {
    const key = node.name.replace(/\.(xml|scl)$/i, "");
    fileMap[key] = node.path || node.name;
  }

  if (node.type !== BlockType.Folder && node.path) {
    if (node.blockName) {
      const symbol = sanitizeIdent(node.blockName);
      symbolPathMap[symbol] = node.path;
      pathSymbolMap[node.path] = symbol;
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
  pathSymbolMap = {};
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

function getProgram(tree: OpennessNode): ProgramIR {
  const nodes = flattenTree(tree);
  return compileProgram(nodes);
}

function findBlock(program: ProgramIR, symbol: string): BlockIR | undefined {
  return program.blocks.find((b) => b.name === symbol);
}

function normalizeSymbol(value: string): string {
  return sanitizeIdent(value);
}

router.get("/api/xref", async (ctx) => {
  try {
    if (!rootPath) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Root path not set" };
      return;
    }

    const path = ctx.request.url.searchParams.get("path");
    const symbolRaw = ctx.request.url.searchParams.get("symbol");

    const tree = await loadProjectTreeAndMaps();
    const program = getProgram(tree);
    const graph = buildCallGraph(program);

    let symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
    if (!symbol && path && pathSymbolMap[path]) {
      symbol = pathSymbolMap[path];
    }

    if (!symbol) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Missing symbol/path for xref" };
      return;
    }

    const block = findBlock(program, symbol);

    const xrefFrom = graph.edges.filter((e) => e.from === symbol).map((e) => ({
      kind: "calls",
      target: e.to,
      network: e.network,
      blockType: e.blockType,
      path: symbolPathMap[e.to] || null,
      args: e.args,
    }));

    const xrefTo = graph.edges.filter((e) => e.to === symbol).map((e) => ({
      kind: "called_by",
      source: e.from,
      network: e.network,
      blockType: e.blockType,
      path: symbolPathMap[e.from] || null,
      args: e.args,
    }));

    const sectionInputs = (block?.fields || []).filter((f) =>
      ["Input", "InOut"].includes(String(f.section))
    );
    const sectionOutputs = (block?.fields || []).filter((f) =>
      ["Output", "InOut"].includes(String(f.section))
    );

    const writtenInBlock = Array.from(
      new Set(
        (block?.networks || []).flatMap((n) => n.actions.map((a) => a.target)),
      ),
    ).sort();

    const inputRefs = xrefTo.flatMap((ref) => {
      const caller = findBlock(program, ref.source);
      if (!caller) return [];
      const network = caller.networks.find((n) => n.index === ref.network);
      if (!network) return [];
      return network.calls
        .filter((c) => c.name === symbol)
        .flatMap((c) =>
          Object.entries(c.args).map(([param, sourceExpr]) => ({
            caller: ref.source,
            callerPath: symbolPathMap[ref.source] || null,
            network: ref.network,
            parameter: param,
            sourceExpr,
          }))
        );
    });

    const outputRefs = xrefTo.flatMap((ref) => {
      const caller = findBlock(program, ref.source);
      if (!caller) return [];
      const network = caller.networks.find((n) => n.index === ref.network);
      if (!network) return [];
      return network.calls
        .filter((c) => c.name === symbol)
        .flatMap((c) =>
          Object.keys(c.args).map((param) => ({
            caller: ref.source,
            callerPath: symbolPathMap[ref.source] || null,
            network: ref.network,
            parameter: param,
          }))
        );
    });

    ctx.response.body = {
      symbol,
      path: symbolPathMap[symbol] || path || null,
      xrefFrom,
      xrefTo,
      inputs: {
        interface: sectionInputs,
        references: inputRefs,
      },
      outputs: {
        interface: sectionOutputs,
        writes: writtenInBlock,
        references: outputRefs,
      },
    };
  } catch (e) {
    console.error(e);
    ctx.response.status = 500;
    ctx.response.body = { error: String(e) };
  }
});

function extractSectionMembers(
  iface: any,
): Array<{ section: string; name: string; datatype: string }> {
  const sections = iface?.Sections?.Section || iface?.sections?.Section ||
    iface?.Sections || [];
  const sectionList = Array.isArray(sections) ? sections : [sections];
  const out: Array<{ section: string; name: string; datatype: string }> = [];

  for (const sec of sectionList) {
    const sectionName = sec?.["@_Name"] || sec?.Name || "Unknown";
    const members = sec?.Member || [];
    const memberList = Array.isArray(members) ? members : [members];
    for (const m of memberList) {
      if (!m) continue;
      const name = m?.["@_Name"] || m?.Name;
      const datatype = m?.["@_Datatype"] || m?.Datatype || "Variant";
      if (!name) continue;
      out.push({
        section: String(sectionName),
        name: String(name),
        datatype: String(datatype),
      });
    }
  }
  return out;
}

function normalizeTypeName(value: string): string {
  return sanitizeIdent(String(value || "").replace(/"/g, ""));
}

function parseStringSize(datatype: string): number | null {
  const m = datatype.match(/string\s*\[(\d+)\]/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return n + 2;
}

function isPrimitiveType(datatype: string): boolean {
  const t = datatype.trim().toLowerCase();
  if (/^string\s*\[\d+\]$/.test(t)) return true;
  const basic = new Set([
    "bool",
    "byte",
    "char",
    "word",
    "int",
    "uint",
    "dword",
    "dint",
    "udint",
    "real",
    "time",
    "lreal",
    "lint",
    "ulint",
    "date_and_time",
    "variant",
  ]);
  return basic.has(t);
}

function collectLocalTypesAndUsages(
  tree: OpennessNode,
): { types: LocalTypeInfo[]; usageMap: Record<string, TypeUsageRef[]> } {
  const nodes = flattenTree(tree);
  const typeDefs = new Map<
    string,
    { path: string | null; members: Array<{ datatype: string }> }
  >();

  for (const node of nodes) {
    if (node.type !== BlockType.UDT || !node.blockName) continue;
    const name = normalizeTypeName(node.blockName);
    const members = extractSectionMembers(node.interface).map((m) => ({
      datatype: m.datatype,
    }));
    typeDefs.set(name, { path: node.path || null, members });
  }

  // Also include discovered custom datatypes even when UDT definitions are outside current root.
  for (const node of nodes) {
    const members = extractSectionMembers(node.interface);
    for (const m of members) {
      if (isPrimitiveType(m.datatype)) continue;
      const t = normalizeTypeName(m.datatype);
      if (!t) continue;
      if (!typeDefs.has(t)) typeDefs.set(t, { path: null, members: [] });
    }
  }

  const usageMap: Record<string, TypeUsageRef[]> = {};
  for (const key of typeDefs.keys()) usageMap[key] = [];

  for (const node of nodes) {
    const ownerType = node.type === BlockType.Folder ? "Folder" : node.type;
    const blockName = node.blockName || node.name;
    const members = extractSectionMembers(node.interface);
    for (const m of members) {
      const t = normalizeTypeName(m.datatype);
      if (!(t in usageMap)) continue;
      usageMap[t].push({
        path: node.path,
        blockName,
        ownerType,
        section: m.section,
        member: m.name,
      });
    }
  }

  const memo = new Map<string, number>();
  const sizingStack = new Set<string>();

  function sizeofDatatype(datatype: string): number {
    const t = datatype.trim();
    const strSz = parseStringSize(t);
    if (strSz !== null) return strSz;

    const basic: Record<string, number> = {
      "bool": 1,
      "byte": 1,
      "char": 1,
      "word": 2,
      "int": 2,
      "uint": 2,
      "dword": 4,
      "dint": 4,
      "udint": 4,
      "real": 4,
      "time": 4,
      "lreal": 8,
      "lint": 8,
      "ulint": 8,
      "date_and_time": 8,
    };
    const k = t.toLowerCase();
    if (basic[k] !== undefined) return basic[k];

    const tn = normalizeTypeName(t);
    if (!typeDefs.has(tn)) return 4;
    return sizeofLocalType(tn);
  }

  function sizeofLocalType(typeName: string): number {
    if (memo.has(typeName)) return memo.get(typeName)!;
    if (sizingStack.has(typeName)) return 0;
    sizingStack.add(typeName);
    const def = typeDefs.get(typeName);
    if (!def) return 0;
    let total = 0;
    for (const member of def.members) total += sizeofDatatype(member.datatype);
    sizingStack.delete(typeName);
    memo.set(typeName, total);
    return total;
  }

  const types: LocalTypeInfo[] = [...typeDefs.entries()].map(([name, def]) => ({
    name,
    path: def.path,
    sizeBytes: sizeofLocalType(name),
    usageCount: usageMap[name]?.length || 0,
  })).sort((a, b) =>
    b.usageCount - a.usageCount || a.name.localeCompare(b.name)
  );

  return { types, usageMap };
}

router.get("/api/local-types", async (ctx) => {
  try {
    if (!rootPath) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Root path not set" };
      return;
    }

    const tree = await loadProjectTreeAndMaps();
    const data = collectLocalTypesAndUsages(tree);
    ctx.response.body = { types: data.types };
  } catch (e) {
    console.error(e);
    ctx.response.status = 500;
    ctx.response.body = { error: String(e) };
  }
});

router.get("/api/type-xref", async (ctx) => {
  try {
    if (!rootPath) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Root path not set" };
      return;
    }

    const typeNameRaw = ctx.request.url.searchParams.get("type");
    if (!typeNameRaw) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Missing type query parameter" };
      return;
    }

    const tree = await loadProjectTreeAndMaps();
    const { types, usageMap } = collectLocalTypesAndUsages(tree);
    const typeName = normalizeTypeName(typeNameRaw);
    const info = types.find((t) => t.name === typeName);
    if (!info) {
      ctx.response.status = 404;
      ctx.response.body = { error: `Type not found: ${typeName}` };
      return;
    }

    ctx.response.body = {
      type: info,
      usages: usageMap[typeName] || [],
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
