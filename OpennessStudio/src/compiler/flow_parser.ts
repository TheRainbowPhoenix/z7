import { BlockType, Connection, Network, NetworkPart } from "../types.ts";
import { ActionIR, BlockIR, CallIR, CompileInput, NetworkIR, TypeField } from "./ir.ts";

interface NameConEdge {
  fromUid: string;
  fromPin: string;
  toUid: string;
  toPin: string;
}

export function buildBlockIR(input: CompileInput): BlockIR {
  return {
    name: sanitizeIdent(input.blockName || basename(input.path)),
    sourcePath: input.path,
    type: input.type,
    fields: extractFields(input.interface),
    networks: (input.networks || []).map((net, idx) => parseNetworkToIR(net, idx + 1)),
    sclBody: typeof input.xmlContent?.raw === "string" ? input.xmlContent.raw : undefined,
  };
}

function parseNetworkToIR(net: Network, index: number): NetworkIR {
  const partMap = new Map<string, NetworkPart>();
  for (const p of net.parts) partMap.set(p.uid, p);

  const nameConEdges = buildNameConEdges(net.wires);
  const accessByUid = new Map<string, string>();
  for (const p of net.parts) {
    if (p.type === "Access") accessByUid.set(p.uid, symbolPath(p));
  }

  const conditions: string[] = [];
  const actions: ActionIR[] = [];
  const calls: CallIR[] = [];

  for (const p of net.parts) {
    if (p.type !== "Part" && p.type !== "Call") continue;

    if (p.type === "Part" && (p.name === "Contact" || p.name === "PContact")) {
      const expr = resolveContactExpr(p, nameConEdges, accessByUid);
      if (expr) conditions.push(expr);
      continue;
    }

    if (p.type === "Part" && (p.name === "Coil" || p.name === "SCoil" || p.name === "RCoil")) {
      const action = resolveCoilAction(p, nameConEdges, accessByUid, conditions);
      if (action) actions.push(action);
      continue;
    }

    if (p.type === "Call" && p.callInfo) {
      calls.push(resolveCall(p, net.wires, accessByUid));
    }
  }

  return { index, conditions, actions, calls };
}

function resolveCall(part: NetworkPart, wires: any[], accessByUid: Map<string, string>): CallIR {
  const args: Record<string, string> = {};
  for (const wire of wires) {
    const source = (wire.connections as Connection[]).find((c) => c.type === "IdentCon");
    const targetNameCon = (wire.connections as Connection[]).find((c) => c.type === "NameCon" && c.uid === part.uid);
    if (source && targetNameCon?.name && source.uid) {
      args[targetNameCon.name] = accessByUid.get(source.uid) || "None";
    }
  }

  return {
    name: sanitizeIdent(part.callInfo?.name || "unknown_call"),
    blockType: part.callInfo?.blockType || "FC",
    args,
  };
}

function resolveCoilAction(part: NetworkPart, edges: NameConEdge[], accessByUid: Map<string, string>, conditions: string[]): ActionIR | null {
  const operandUid = findAccessUidConnectedToPin(part.uid, "operand", edges, accessByUid);
  if (!operandUid) return null;

  const target = accessByUid.get(operandUid) || "unknown_target";
  const expression = conditions.length > 0 ? conditions.join(" and ") : "True";

  if (part.name === "SCoil") return { kind: "set", target, expression };
  if (part.name === "RCoil") return { kind: "reset", target, expression };
  return { kind: "assign", target, expression };
}

function resolveContactExpr(part: NetworkPart, edges: NameConEdge[], accessByUid: Map<string, string>): string | null {
  const operandUid = findAccessUidConnectedToPin(part.uid, "operand", edges, accessByUid);
  if (!operandUid) return null;

  const symbol = accessByUid.get(operandUid) || "False";
  const isNegated = Boolean(part.negated?.includes("operand"));
  if (part.name === "PContact") {
    return `rising(${symbol})`;
  }
  return isNegated ? `(not ${symbol})` : symbol;
}

function findAccessUidConnectedToPin(partUid: string, pin: string, edges: NameConEdge[], accessByUid: Map<string, string>): string | null {
  for (const edge of edges) {
    if (edge.toUid === partUid && edge.toPin === pin && accessByUid.has(edge.fromUid)) {
      return edge.fromUid;
    }
    if (edge.fromUid === partUid && edge.fromPin === pin && accessByUid.has(edge.toUid)) {
      return edge.toUid;
    }
  }
  return null;
}

function buildNameConEdges(wires: any[]): NameConEdge[] {
  const result: NameConEdge[] = [];
  for (const wire of wires) {
    const nameCons = (wire.connections as Connection[]).filter((c) => c.type === "NameCon" && c.uid && c.name) as Required<Connection>[];
    const identCons = (wire.connections as Connection[]).filter((c) => c.type === "IdentCon" && c.uid) as Required<Connection>[];

    if (nameCons.length >= 2) {
      for (let i = 0; i < nameCons.length - 1; i++) {
        result.push({
          fromUid: nameCons[i].uid,
          fromPin: nameCons[i].name,
          toUid: nameCons[i + 1].uid,
          toPin: nameCons[i + 1].name,
        });
      }
    }

    for (const ident of identCons) {
      for (const nc of nameCons) {
        result.push({ fromUid: ident.uid, fromPin: "value", toUid: nc.uid, toPin: nc.name });
      }
    }
  }

  return result;
}

function symbolPath(part: NetworkPart): string {
  return (part.symbol?.components || []).map((c) => sanitizeIdent(c.name)).join(".");
}

function extractFields(iface: any): TypeField[] {
  const sections = iface?.Sections?.Section || iface?.sections?.Section || iface?.Sections || [];
  const sectionList = Array.isArray(sections) ? sections : [sections];
  const result: TypeField[] = [];

  for (const sec of sectionList) {
    const sectionName = sec?.["@_Name"] || sec?.Name || "Unknown";
    const members = sec?.Member || [];
    const memberList = Array.isArray(members) ? members : [members];
    for (const m of memberList) {
      if (!m) continue;
      const name = m?.["@_Name"] || m?.Name;
      const datatype = m?.["@_Datatype"] || m?.Datatype || "Variant";
      if (name) {
        result.push({ name: sanitizeIdent(name), datatype, section: sectionName });
      }
    }
  }

  return result;
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || "block";
}

export function sanitizeIdent(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "_");
  if (/^[0-9]/.test(cleaned)) return `_${cleaned}`;
  return cleaned;
}

export function isCompilableBlock(type: BlockType): boolean {
  return [BlockType.OB, BlockType.FB, BlockType.FC].includes(type);
}
