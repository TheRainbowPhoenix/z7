import { XMLParser } from "npm:fast-xml-parser";
import {
  BlockType,
  InterfaceMember,
  InterfaceSection,
  Network,
  NetworkPart,
  NetworkWire,
  OpennessNode,
} from "./types.ts";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => {
    // Force arrays for these elements to handle single/multiple items uniformly
    const arrayElements = [
      "SW.Blocks.CompileUnit",
      "Section",
      "Member",
      "Part",
      "Wire",
      "Call",
      "Access",
      "Component",
      "Parameter",
      "TemplateValue",
      "Negated",
      "Wire",
      "NameCon",
      "IdentCon",
    ];
    return arrayElements.includes(name);
  },
});

/**
 * Parses a single Openness XML file and returns an OpennessNode.
 */
export async function parseFile(
  filePath: string,
): Promise<OpennessNode | null> {
  try {
    const xmlContent = await Deno.readTextFile(filePath);
    const parsed = parser.parse(xmlContent);

    if (!parsed.Document) return null;

    let type = BlockType.Unknown;
    let blockData: any = null;
    let number: number | undefined = undefined;
    let blockName: string | undefined = undefined;

    // Detect block type
    if (parsed.Document["SW.Blocks.OB"]) {
      type = BlockType.OB;
      blockData = parsed.Document["SW.Blocks.OB"];
    } else if (parsed.Document["SW.Blocks.FB"]) {
      type = BlockType.FB;
      blockData = parsed.Document["SW.Blocks.FB"];
    } else if (parsed.Document["SW.Blocks.FC"]) {
      type = BlockType.FC;
      blockData = parsed.Document["SW.Blocks.FC"];
    } else if (parsed.Document["SW.Blocks.GlobalDB"]) {
      type = BlockType.DB;
      blockData = parsed.Document["SW.Blocks.GlobalDB"];
    } else if (parsed.Document["SW.Types.PlcStruct"]) {
      type = BlockType.UDT;
      blockData = parsed.Document["SW.Types.PlcStruct"];
    }

    if (blockData) {
      if (blockData.AttributeList) {
        blockName = blockData.AttributeList.Name;
        number = blockData.AttributeList.Number
          ? parseInt(blockData.AttributeList.Number)
          : undefined;
      }
    } else {
      // Not a recognized block type, maybe library or other xml
      return null;
    }

    const node: OpennessNode = {
      name: filePath.split(/[\\/]/).pop() || "",
      blockName,
      type,
      number,
      path: filePath,
      xmlContent: blockData, // Keep reference if needed
    };

    // Extract Logic (Networks) for OB, FB, FC
    if (
      type === BlockType.OB || type === BlockType.FB || type === BlockType.FC
    ) {
      if (
        blockData.ObjectList && blockData.ObjectList["SW.Blocks.CompileUnit"]
      ) {
        const units = blockData.ObjectList["SW.Blocks.CompileUnit"];
        node.networks = units.map((unit: any) => parseNetwork(unit)).filter((
          n: any,
        ) => n !== null);
      }
    }

    // Extract Interface (DB, OB, FB, FC, UDT)
    if (blockData.AttributeList && blockData.AttributeList.Interface) {
      node.interface = {
        sections: parseInterfaceSections(blockData.AttributeList.Interface),
      };
    }

    return node;
  } catch (error) {
    console.warn(`Failed to parse file: ${filePath}`, error);
    return null;
  }
}

/**
 * Parses a single SCL file and returns partial OpennessNode info.
 */
export async function parseSclFile(
  filePath: string,
): Promise<OpennessNode | null> {
  try {
    let content = await Deno.readTextFile(filePath);
    // Remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    let type = BlockType.Unknown;
    let blockName = "";

    // Robust regex matching with whitespace support
    const functionMatch = content.match(/^\s*FUNCTION\s+"([^"]+)"/m);
    const fbMatch = content.match(/^\s*FUNCTION_BLOCK\s+"([^"]+)"/m);
    const dbMatch = content.match(/^\s*DATA_BLOCK\s+"([^"]+)"/m);
    const udtMatch = content.match(/^\s*TYPE\s+"([^"]+)"/m);
    const obMatch = content.match(/^\s*ORGANIZATION_BLOCK\s+"([^"]+)"/m);

    if (functionMatch) {
      type = BlockType.FC;
      blockName = functionMatch[1];
    } else if (fbMatch) {
      type = BlockType.FB;
      blockName = fbMatch[1];
    } else if (dbMatch) {
      type = BlockType.DB;
      blockName = dbMatch[1];
    } else if (udtMatch) {
      type = BlockType.UDT;
      blockName = udtMatch[1];
    } else if (obMatch) {
      type = BlockType.OB;
      blockName = obMatch[1];
    }

    if (type === BlockType.Unknown) {
      // console.log("SCL Regex failed for:", filePath, "Start of content:", content.substring(0, 50));
      return null;
    }

    return {
      name: filePath.split(/[\\/]/).pop() || "",
      blockName,
      type,
      path: filePath,
      xmlContent: { raw: content }, // Store content if needed
    };
  } catch (e) {
    console.warn(`Failed to parse SCL file: ${filePath}`, e);
    return null;
  }
}

function parseNetwork(compileUnit: any): Network | null {
  const attributeList = compileUnit.AttributeList;
  if (!attributeList || !attributeList.NetworkSource) return null;

  const flgNet = attributeList.NetworkSource["FlgNet"];
  if (!flgNet) return null;

  const rawParts = flgNet.Parts && flgNet.Parts.Part ? flgNet.Parts.Part : [];
  const calls = flgNet.Parts && flgNet.Parts.Call ? flgNet.Parts.Call : [];
  const accesses = flgNet.Parts && flgNet.Parts.Access
    ? flgNet.Parts.Access
    : [];

  const parts: NetworkPart[] = [];

  if (Array.isArray(rawParts)) {
    rawParts.forEach((p: any) => {
      const templateValues = p.TemplateValue
        ? (Array.isArray(p.TemplateValue) ? p.TemplateValue : [p.TemplateValue])
        : [];
      const negated = p.Negated
        ? (Array.isArray(p.Negated) ? p.Negated : [p.Negated]).map((n: any) =>
          n["@_Name"]
        )
        : [];

      parts.push({
        uid: p["@_UId"],
        name: p["@_Name"],
        type: "Part",
        templateValue: templateValues.map((tv: any) => ({
          name: tv["@_Name"],
          type: tv["@_Type"],
          value: tv["#text"],
        })),
        negated,
      });
    });
  }

  if (Array.isArray(calls)) {
    calls.forEach((c: any) => {
      const callInfo = c.CallInfo;
      const parameters = callInfo && callInfo.Parameter
        ? (Array.isArray(callInfo.Parameter)
          ? callInfo.Parameter
          : [callInfo.Parameter])
        : [];
      const instanceComponent = callInfo?.Instance?.Component;
      const firstInstanceComponent = Array.isArray(instanceComponent)
        ? instanceComponent[0]
        : instanceComponent;
      const instanceName = firstInstanceComponent?.["@_Name"];
      const instanceScope = callInfo?.Instance?.["@_Scope"];

      parts.push({
        uid: c["@_UId"],
        name: callInfo ? callInfo["@_Name"] : "Unknown Call",
        type: "Call",
        callInfo: {
          name: callInfo["@_Name"],
          blockType: callInfo["@_BlockType"],
          instanceName,
          instanceScope,
          parameters: parameters.map((param: any) => ({
            name: param["@_Name"],
            section: param["@_Section"],
            type: param["@_Type"],
          })),
        },
      });
    });
  }

  if (Array.isArray(accesses)) {
    accesses.forEach((a: any) => {
      const components = a.Symbol && a.Symbol.Component
        ? (Array.isArray(a.Symbol.Component)
          ? a.Symbol.Component
          : [a.Symbol.Component])
        : [];
      const constant = a.Constant
        ? {
          constantType: a.Constant.ConstantType || a.Constant["ConstantType"] ||
            undefined,
          constantValue: a.Constant.ConstantValue ||
            a.Constant["ConstantValue"] || undefined,
        }
        : undefined;

      parts.push({
        uid: a["@_UId"],
        type: "Access",
        scope: a["@_Scope"],
        symbol: {
          components: components.map((comp: any) => ({
            name: comp["@_Name"],
            accessModifier: comp["@_AccessModifier"],
            accessModifierPos: comp["@_AccessModifierPos"],
          })),
        },
        constant,
      });
    });
  }

  const wires: NetworkWire[] = [];
  if (flgNet.Wires && flgNet.Wires.Wire) {
    const rawWires = flgNet.Wires.Wire;
    if (Array.isArray(rawWires)) {
      rawWires.forEach((w: any) => {
        const connections: any[] = [];
        if (w.hasOwnProperty("Powerrail")) {
          connections.push({ type: "Powerrail" });
        }

        if (w.NameCon) {
          const cons = Array.isArray(w.NameCon) ? w.NameCon : [w.NameCon];
          cons.forEach((nc: any) =>
            connections.push({
              type: "NameCon",
              uid: nc["@_UId"],
              name: nc["@_Name"],
            })
          );
        }
        if (w.IdentCon) {
          const cons = Array.isArray(w.IdentCon) ? w.IdentCon : [w.IdentCon];
          cons.forEach((ic: any) =>
            connections.push({ type: "IdentCon", uid: ic["@_UId"] })
          );
        }
        if (w.OpenCon) {
          const cons = Array.isArray(w.OpenCon) ? w.OpenCon : [w.OpenCon];
          cons.forEach((oc: any) =>
            connections.push({ type: "OpenCon", uid: oc["@_UId"] })
          );
        }

        wires.push({
          uid: w["@_UId"],
          connections,
        });
      });
    }
  }

  return {
    parts,
    wires,
    title: extractNetworkLocalizedText(compileUnit, "Title"),
    comment: extractNetworkLocalizedText(compileUnit, "Comment"),
  };
}

function parseInterfaceSections(interfaceData: any): InterfaceSection[] {
  const sections = interfaceData?.Sections?.Section;
  if (!sections) return [];
  const items = Array.isArray(sections) ? sections : [sections];
  return items.map((section: any) => ({
    name: section?.["@_Name"] || "Section",
    members: parseInterfaceMembers(section?.Member),
  }));
}

function parseInterfaceMembers(rawMembers: any): InterfaceMember[] {
  if (!rawMembers) return [];
  const members = Array.isArray(rawMembers) ? rawMembers : [rawMembers];
  return members.map((member: any) => {
    const nestedMembers: any[] = [];
    nestedMembers.push(...arrayify(member?.Member));
    for (const section of arrayify(member?.Sections?.Section)) {
      nestedMembers.push(...arrayify(section?.Member));
    }

    return {
      name: member?.["@_Name"] || "",
      datatype: member?.["@_Datatype"] || "",
      defaultValue: extractMemberDefaultValue(member),
      comment: extractMultilingualText(member?.Comment),
      children: parseInterfaceMembers(nestedMembers).filter((c) =>
        c.name || c.datatype
      ),
    };
  });
}

function extractMemberDefaultValue(member: any): string {
  const startValue = member?.StartValue;
  if (typeof startValue === "string") return startValue;
  if (typeof startValue?.["#text"] === "string") return startValue["#text"];
  return "";
}

function extractNetworkLocalizedText(
  compileUnit: any,
  compositionName: "Title" | "Comment",
): string | undefined {
  const objectList = compileUnit?.ObjectList;
  if (!objectList) return undefined;

  const allTexts = [
    ...(arrayify(objectList["MultilingualText"])),
    ...(arrayify(objectList["SW.Blocks.MultilingualText"])),
  ];

  for (const entry of allTexts) {
    if (entry?.["@_CompositionName"] !== compositionName) continue;
    const text = extractMultilingualText(entry);
    if (text) return text;
  }

  return undefined;
}

function extractMultilingualText(value: any): string {
  if (!value) return "";

  if (typeof value === "string") return value.trim();
  if (typeof value["#text"] === "string") return value["#text"].trim();

  if (value.ObjectList) {
    const list = value.ObjectList;
    const candidates = [
      ...arrayify(list.MultilingualTextItem),
      ...arrayify(list["SW.Blocks.MultilingualTextItem"]),
      ...arrayify(list["SW.Blocks.CompileUnit"]),
      ...arrayify(list.Text),
    ];
    for (const candidate of candidates) {
      const text = extractMultilingualText(candidate);
      if (text) return text;
    }
  }

  if (value.AttributeList) {
    const attr = value.AttributeList;
    if (typeof attr.Text === "string") return attr.Text.trim();
    if (typeof attr.Culture === "string" && typeof value.Text === "string") {
      return value.Text.trim();
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = extractMultilingualText(item);
      if (text) return text;
    }
  }

  if (typeof value === "object") {
    for (
      const key of ["Text", "Value", "MultilingualText", "MultilingualTextItem"]
    ) {
      if (value[key]) {
        const text = extractMultilingualText(value[key]);
        if (text) return text;
      }
    }
  }

  return "";
}

function arrayify<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
