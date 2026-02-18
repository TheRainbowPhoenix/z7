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
const DEFAULT_FLOW_MAX_DEPTH = 20;

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

    const incomingCount = new Map<string, number>();
    const outgoingCount = new Map<string, number>();
    for (const edge of graph.edges) {
      incomingCount.set(edge.to, (incomingCount.get(edge.to) || 0) + 1);
      outgoingCount.set(edge.from, (outgoingCount.get(edge.from) || 0) + 1);
    }

    const projectObjects = nodes
      .filter((n) => n.type !== BlockType.Folder && n.blockName)
      .map((n) => {
        const symbol = normalizeSymbol(n.blockName || "");
        return {
          name: symbol,
          blockName: n.blockName || symbol,
          type: n.type,
          path: n.path || symbolPathMap[symbol] || null,
          usageCount: incomingCount.get(symbol) || 0,
          outgoingCount: outgoingCount.get(symbol) || 0,
        };
      })
      .sort((a, b) =>
        b.usageCount - a.usageCount || b.outgoingCount - a.outgoingCount ||
        a.blockName.localeCompare(b.blockName)
      );

    const nodePaths: Record<string, string | null> = {};
    for (const node of graph.nodes) {
      nodePaths[node.name] = symbolPathMap[node.name] || null;
    }

    const edgePaths = graph.edges.map((edge) => ({
      ...edge,
      fromPath: symbolPathMap[edge.from] || null,
      toPath: symbolPathMap[edge.to] || null,
    }));

    const graphNodes = graph.nodes.map((node) => ({
      ...node,
      usageCount: incomingCount.get(node.name) || 0,
      outgoingCount: outgoingCount.get(node.name) || 0,
    })).sort((a, b) =>
      b.usageCount - a.usageCount || b.outgoingCount - a.outgoingCount ||
      a.name.localeCompare(b.name)
    );

    ctx.response.body = {
      ...graph,
      nodes: graphNodes,
      nodePaths,
      edges: edgePaths,
      objects: projectObjects,
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

interface FlowNode {
  id: string;
  path: string | null;
  depth: number;
}

interface FlowEdge {
  from: string;
  to: string;
  network: number;
  blockType: string;
  args: string[];
  cycle: boolean;
}

type FlowDirection = "in" | "out";

function resolveTargetSymbol(
  path: string | null,
  symbolRaw: string | null,
): string {
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (symbol) return symbol;
  if (path && pathSymbolMap[path]) return pathSymbolMap[path];
  return "";
}

function buildFlowGraph(
  program: ProgramIR,
  rootSymbol: string,
  direction: FlowDirection,
  maxDepth: number,
): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  truncated: boolean;
} {
  const graph = buildCallGraph(program);
  const outgoing = new Map<string, typeof graph.edges>();
  const incoming = new Map<string, typeof graph.edges>();

  for (const edge of graph.edges) {
    const outgoingList = outgoing.get(edge.from) ?? [];
    outgoingList.push(edge);
    outgoing.set(edge.from, outgoingList);

    const incomingList = incoming.get(edge.to) ?? [];
    incomingList.push(edge);
    incoming.set(edge.to, incomingList);
  }

  const nodeDepth = new Map<string, number>();
  const resultEdges = new Map<string, FlowEdge>();
  nodeDepth.set(rootSymbol, 0);

  let truncated = false;
  const queue: Array<{ symbol: string; depth: number; trail: string[] }> = [
    { symbol: rootSymbol, depth: 0, trail: [rootSymbol] },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;

    const candidates = direction === "out"
      ? (outgoing.get(cur.symbol) ?? [])
      : (incoming.get(cur.symbol) ?? []);

    if (cur.depth >= maxDepth) {
      if (candidates.length > 0) truncated = true;
      continue;
    }

    for (const edge of candidates) {
      const nextSymbol = direction === "out" ? edge.to : edge.from;
      const isCycle = cur.trail.includes(nextSymbol);

      const key = `${edge.from}|${edge.to}|${edge.network}|${direction}`;
      const existingEdge = resultEdges.get(key);
      if (!existingEdge) {
        resultEdges.set(key, {
          from: edge.from,
          to: edge.to,
          network: edge.network,
          blockType: edge.blockType,
          args: edge.args,
          cycle: isCycle,
        });
      } else if (isCycle && !existingEdge.cycle) {
        existingEdge.cycle = true;
      }

      const nextDepth = cur.depth + 1;
      const prevDepth = nodeDepth.get(nextSymbol);
      if (prevDepth === undefined || nextDepth < prevDepth) {
        nodeDepth.set(nextSymbol, nextDepth);
      }

      if (
        !isCycle && (prevDepth === undefined || nextDepth < prevDepth) &&
        nextDepth <= maxDepth
      ) {
        queue.push({
          symbol: nextSymbol,
          depth: nextDepth,
          trail: [...cur.trail, nextSymbol],
        });
      }
    }
  }

  const nodes: FlowNode[] = [...nodeDepth.entries()].map(([id, depth]) => ({
    id,
    depth,
    path: symbolPathMap[id] || null,
  })).sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));

  return {
    nodes,
    edges: [...resultEdges.values()],
    truncated,
  };
}

function parseFlowDirection(rawValue: string | null): FlowDirection | null {
  if (!rawValue || rawValue === "out") return "out";
  if (rawValue === "in") return "in";
  return null;
}

router.get("/api/flow", async (ctx) => {
  try {
    if (!rootPath) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Root path not set" };
      return;
    }

    const path = ctx.request.url.searchParams.get("path");
    const symbolRaw = ctx.request.url.searchParams.get("symbol");
    const directionRaw =
      ctx.request.url.searchParams.get("direction")?.toLowerCase() || null;
    const direction = parseFlowDirection(directionRaw);
    if (!direction) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid direction. Use 'in' or 'out'." };
      return;
    }

    const parsedDepth = Number(
      ctx.request.url.searchParams.get("maxDepth") || DEFAULT_FLOW_MAX_DEPTH,
    );
    const maxDepth = Number.isFinite(parsedDepth)
      ? Math.max(1, Math.min(200, Math.floor(parsedDepth)))
      : DEFAULT_FLOW_MAX_DEPTH;

    const tree = await loadProjectTreeAndMaps();
    const program = getProgram(tree);

    const symbol = resolveTargetSymbol(path, symbolRaw);
    if (!symbol) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Missing symbol/path for flow query" };
      return;
    }

    const rootBlock = findBlock(program, symbol);
    if (!rootBlock) {
      ctx.response.status = 404;
      ctx.response.body = { error: `Block not found for symbol: ${symbol}` };
      return;
    }

    const flow = buildFlowGraph(program, symbol, direction, maxDepth);

    ctx.response.body = {
      root: symbol,
      rootPath: symbolPathMap[symbol] || path || null,
      direction,
      maxDepth,
      truncated: flow.truncated,
      nodes: flow.nodes,
      edges: flow.edges,
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
