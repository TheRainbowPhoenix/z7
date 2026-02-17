import { BlockType, Network } from "../types.ts";

export interface TypeField {
  name: string;
  datatype: string;
  section: string;
}

export interface BlockIR {
  name: string;
  sourcePath: string;
  type: BlockType;
  fields: TypeField[];
  networks: NetworkIR[];
  sclBody?: string;
}

export interface NetworkIR {
  index: number;
  conditions: string[];
  actions: ActionIR[];
  calls: CallIR[];
}

export interface ActionIR {
  kind: "assign" | "set" | "reset";
  target: string;
  expression: string;
}

export interface CallIR {
  name: string;
  blockType: string;
  args: Record<string, string>;
}

export interface CompileInput {
  blockName?: string;
  path: string;
  type: BlockType;
  networks?: Network[];
  interface?: any;
  xmlContent?: any;
}
