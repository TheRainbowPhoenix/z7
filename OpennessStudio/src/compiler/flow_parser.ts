import {
  BlockType,
  Connection,
  Network,
  NetworkPart,
  OpennessNode,
} from "../types.ts";
import {
  ActionIR,
  BlockIR,
  CallIR,
  NetworkIR,
  ProgramIR,
  TypeField,
} from "./ir.ts";

interface NameConNode {
  uid: string;
  pin: string;
}

interface WireProjection {
  identUids: string[];
  nameCons: NameConNode[];
}

export function compileProgram(nodes: OpennessNode[]): ProgramIR {
  const blocks = nodes
    .filter((node) =>
      [BlockType.OB, BlockType.FB, BlockType.FC].includes(node.type)
    )
    .map((node) => compileNode(node));

  return { blocks };
}

export function compileNode(node: OpennessNode): BlockIR {
  return {
    name: sanitizeIdent(node.blockName || basename(node.path)),
    sourcePath: node.path,
    type: node.type,
    fields: extractFields(node.interface),
    networks: (node.networks || []).map((net, idx) =>
      parseNetworkToIR(net, idx + 1)
    ),
    sclBody: typeof node.xmlContent?.raw === "string"
      ? node.xmlContent.raw
      : undefined,
  };
}

function parseNetworkToIR(net: Network, index: number): NetworkIR {
  const accessSymbols = new Map<string, string>();
  for (const part of net.parts) {
    if (part.type === "Access") {
      accessSymbols.set(part.uid, symbolPath(part));
    }
  }

  const projections = projectWires(net.wires);
  const conditions: string[] = [];
  const actions: ActionIR[] = [];
  const calls: CallIR[] = [];

  for (const part of net.parts) {
    if (
      part.type === "Part" &&
      (part.name === "Contact" || part.name === "PContact")
    ) {
      const contactExpr = buildContactExpr(part, projections, accessSymbols);
      if (contactExpr) conditions.push(contactExpr);
    }

    if (
      part.type === "Part" &&
      (part.name === "Coil" || part.name === "SCoil" || part.name === "RCoil")
    ) {
      const action = buildCoilAction(
        part,
        conditions,
        projections,
        accessSymbols,
      );
      if (action) actions.push(action);
    }

    if (part.type === "Call" && part.callInfo) {
      calls.push(buildCall(part, projections, accessSymbols));
    }
  }

  return { index, conditions, actions, calls };
}

function buildCall(
  part: NetworkPart,
  projections: WireProjection[],
  accessSymbols: Map<string, string>,
): CallIR {
  const args: Record<string, string> = {};

  for (const wire of projections) {
    const parameterPins = wire.nameCons.filter((nc) => nc.uid === part.uid);
    if (parameterPins.length === 0 || wire.identUids.length === 0) continue;

    for (const pin of parameterPins) {
      const sourceUid = wire.identUids[0];
      args[sanitizeIdent(pin.pin)] = accessSymbols.get(sourceUid) || "None";
    }
  }

  return {
    name: sanitizeIdent(part.callInfo?.name || "unknown_call"),
    blockType: part.callInfo?.blockType || "FC",
    args,
  };
}

function buildCoilAction(
  part: NetworkPart,
  conditions: string[],
  projections: WireProjection[],
  accessSymbols: Map<string, string>,
): ActionIR | null {
  const targetUid = findUidConnectedToPin(
    part.uid,
    "operand",
    projections,
    accessSymbols,
  );
  if (!targetUid) return null;

  const target = accessSymbols.get(targetUid) || "unknown_target";
  const expression = conditions.length ? conditions.join(" and ") : "True";

  if (part.name === "SCoil") return { kind: "set", target, expression };
  if (part.name === "RCoil") return { kind: "reset", target, expression };
  return { kind: "assign", target, expression };
}

function buildContactExpr(
  part: NetworkPart,
  projections: WireProjection[],
  accessSymbols: Map<string, string>,
): string | null {
  const operandUid = findUidConnectedToPin(
    part.uid,
    "operand",
    projections,
    accessSymbols,
  );
  if (!operandUid) return null;

  const symbol = accessSymbols.get(operandUid) || "False";
  const negated = Boolean(part.negated?.includes("operand"));

  if (part.name === "PContact") return `rt.rising(${symbol})`;
  return negated ? `(not ${symbol})` : symbol;
}

function findUidConnectedToPin(
  targetUid: string,
  pin: string,
  projections: WireProjection[],
  accessSymbols: Map<string, string>,
): string | null {
  for (const wire of projections) {
    const hasPin = wire.nameCons.some((nc) =>
      nc.uid === targetUid && nc.pin === pin
    );
    if (!hasPin) continue;

    const sourceUid = wire.identUids.find((uid) => accessSymbols.has(uid));
    if (sourceUid) return sourceUid;
  }

  return null;
}

function projectWires(
  wires: { connections: Connection[] }[],
): WireProjection[] {
  return wires.map((wire) => {
    const identUids = wire.connections
      .filter((conn): conn is Required<Connection> =>
        conn.type === "IdentCon" && Boolean(conn.uid)
      )
      .map((conn) => conn.uid);

    const nameCons = wire.connections
      .filter((conn): conn is Required<Connection> =>
        conn.type === "NameCon" && Boolean(conn.uid) && Boolean(conn.name)
      )
      .map((conn) => ({ uid: conn.uid, pin: conn.name }));

    return { identUids, nameCons };
  });
}

function extractFields(iface: any): TypeField[] {
  const sections = iface?.Sections?.Section || iface?.sections?.Section ||
    iface?.Sections || [];
  const sectionList = Array.isArray(sections) ? sections : [sections];
  const output: TypeField[] = [];

  for (const section of sectionList) {
    const sectionName = section?.["@_Name"] || section?.Name || "Unknown";
    const members = section?.Member || [];
    const memberList = Array.isArray(members) ? members : [members];

    for (const member of memberList) {
      if (!member) continue;

      const name = member?.["@_Name"] || member?.Name;
      const datatype = member?.["@_Datatype"] || member?.Datatype || "Variant";
      if (!name) continue;

      output.push({
        name: sanitizeIdent(name),
        datatype,
        section: sectionName,
      });
    }
  }

  return output;
}

function symbolPath(part: NetworkPart): string {
  return (part.symbol?.components || []).map((component) =>
    sanitizeIdent(component.name)
  ).join(".");
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || "block";
}

export function sanitizeIdent(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_]/g, "_");
  if (/^[0-9]/.test(normalized)) return `_${normalized}`;
  return normalized;
}
