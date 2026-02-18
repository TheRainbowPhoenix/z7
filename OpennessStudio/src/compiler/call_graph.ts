import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { ProgramIR } from "./ir.ts";

export interface CallGraphEdge {
  from: string;
  to: string;
  network: number;
  blockType: string;
  args: string[];
}

export interface CallGraphNode {
  name: string;
  kind: "internal" | "external";
  callers: string[];
  callees: string[];
}

export interface CallGraph {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
}

export function buildCallGraph(program: ProgramIR): CallGraph {
  const internal = new Set(program.blocks.map((b) => b.name));
  const edgeList: CallGraphEdge[] = [];

  for (const block of program.blocks) {
    for (const network of block.networks) {
      for (const call of network.calls) {
        edgeList.push({
          from: block.name,
          to: call.name,
          network: network.index,
          blockType: call.blockType,
          args: Object.keys(call.args).sort(),
        });
      }
    }
  }

  const deduped = dedupeEdges(edgeList);
  const nodeNames = new Set<string>([
    ...internal,
    ...deduped.flatMap((e) => [e.from, e.to]),
  ]);

  const nodes: CallGraphNode[] = [...nodeNames].sort().map((name) => {
    const callers = deduped.filter((e) => e.to === name).map((e) => e.from);
    const callees = deduped.filter((e) => e.from === name).map((e) => e.to);
    return {
      name,
      kind: internal.has(name) ? "internal" : "external",
      callers: [...new Set(callers)].sort(),
      callees: [...new Set(callees)].sort(),
    };
  });

  return { nodes, edges: deduped };
}

export async function emitCallGraphArtifacts(
  graph: CallGraph,
  outDir: string,
): Promise<void> {
  await ensureDir(outDir);

  await Deno.writeTextFile(
    join(outDir, "call_graph.json"),
    JSON.stringify(graph, null, 2),
  );

  await Deno.writeTextFile(join(outDir, "call_graph.dot"), renderDot(graph));
  await Deno.writeTextFile(
    join(outDir, "call_graph.mmd"),
    renderMermaid(graph),
  );
  await Deno.writeTextFile(
    join(outDir, "call_graph.md"),
    renderMarkdown(graph),
  );
}

function dedupeEdges(edges: CallGraphEdge[]): CallGraphEdge[] {
  const map = new Map<string, CallGraphEdge>();
  for (const edge of edges) {
    const key = `${edge.from}|${edge.to}|${edge.network}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, edge);
      continue;
    }

    map.set(key, {
      ...existing,
      args: [...new Set([...existing.args, ...edge.args])].sort(),
      blockType: existing.blockType || edge.blockType,
    });
  }

  return [...map.values()].sort((a, b) => {
    if (a.from !== b.from) return a.from.localeCompare(b.from);
    if (a.to !== b.to) return a.to.localeCompare(b.to);
    return a.network - b.network;
  });
}

function renderDot(graph: CallGraph): string {
  const lines = ["digraph PLC_CallGraph {", "  rankdir=LR;"];

  for (const node of graph.nodes) {
    const shape = node.kind === "internal" ? "box" : "ellipse";
    lines.push(`  "${node.name}" [shape=${shape}];`);
  }

  for (const edge of graph.edges) {
    const label = `N${edge.network} ${edge.blockType}`;
    lines.push(`  "${edge.from}" -> "${edge.to}" [label="${label}"];`);
  }

  lines.push("}");
  return lines.join("\n") + "\n";
}

function renderMermaid(graph: CallGraph): string {
  const lines = ["flowchart LR"];

  for (const node of graph.nodes) {
    const shape = node.kind === "internal"
      ? `[${node.name}]`
      : `(${node.name})`;
    lines.push(`  ${node.name}${shape}`);
  }

  for (const edge of graph.edges) {
    lines.push(
      `  ${edge.from} -->|N${edge.network} ${edge.blockType}| ${edge.to}`,
    );
  }

  return lines.join("\n") + "\n";
}

function renderMarkdown(graph: CallGraph): string {
  const lines: string[] = [
    "# Global PLC Call Graph",
    "",
    "This call graph is generated from OB/FB/FC network `Call` nodes.",
    "",
    `- Nodes: ${graph.nodes.length}`,
    `- Edges: ${graph.edges.length}`,
    "",
    "## Node index",
    "",
    "| Node | Kind | Callers | Callees |",
    "| --- | --- | --- | --- |",
  ];

  for (const node of graph.nodes) {
    lines.push(
      `| ${node.name} | ${node.kind} | ${formatList(node.callers)} | ${
        formatList(node.callees)
      } |`,
    );
  }

  lines.push(
    "",
    "## Edge index",
    "",
    "| Caller | Callee | Network | BlockType | Args |",
    "| --- | --- | --- | --- | --- |",
  );

  for (const edge of graph.edges) {
    lines.push(
      `| ${edge.from} | ${edge.to} | ${edge.network} | ${edge.blockType} | ${
        formatList(edge.args)
      } |`,
    );
  }

  return lines.join("\n") + "\n";
}

function formatList(items: string[]): string {
  return items.length ? items.join(", ") : "-";
}
