import { BlockType } from "../types.ts";

export type ScalarType =
  | "Bool"
  | "Int"
  | "DInt"
  | "UInt"
  | "Real"
  | "Time"
  | "String"
  | "Variant";

export interface TypeField {
  name: string;
  datatype: string;
  section: string;
}

export interface CallIR {
  name: string;
  blockType: string;
  args: Record<string, string>;
}

export interface ActionIR {
  kind: "assign" | "set" | "reset";
  target: string;
  expression: string;
}

export interface NetworkIR {
  index: number;
  conditions: string[];
  actions: ActionIR[];
  calls: CallIR[];
}

export interface BlockIR {
  name: string;
  sourcePath: string;
  type: BlockType;
  fields: TypeField[];
  networks: NetworkIR[];
  sclBody?: string;
}

export interface ProgramIR {
  blocks: BlockIR[];
}

export interface BackendContext {
  program: ProgramIR;
  outDir: string;
}

export interface Backend {
  id: "python" | "typescript";
  emit(context: BackendContext): Promise<void>;
}
