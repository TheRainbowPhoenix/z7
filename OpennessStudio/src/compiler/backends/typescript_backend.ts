import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { Backend, BackendContext } from "../ir.ts";
import { sanitizeIdent } from "../flow_parser.ts";

const TYPE_MAP: Record<string, string> = {
  Bool: "rt.BOOL",
  Int: "rt.INT",
  DInt: "rt.DINT",
  UInt: "rt.UINT",
  Real: "rt.REAL",
  Time: "rt.TIME",
  String: "rt.STRING",
  Variant: "unknown",
};

export const typescriptBackend: Backend = {
  id: "typescript",
  async emit(ctx: BackendContext): Promise<void> {
    const outDir = join(ctx.outDir, "typescript");
    await ensureDir(outDir);

    const knownBlocks = new Set(
      ctx.program.blocks.map((block) => sanitizeIdent(block.name)),
    );
    const missingCalls = new Set<string>();

    for (const block of ctx.program.blocks) {
      const moduleName = sanitizeIdent(block.name).toLowerCase();
      await Deno.writeTextFile(
        join(outDir, `${moduleName}.ts`),
        renderBlock(block),
      );

      for (const network of block.networks) {
        for (const call of network.calls) {
          if (!knownBlocks.has(call.name)) missingCalls.add(call.name);
        }
      }
    }

    await Deno.writeTextFile(join(outDir, "runtime.ts"), renderRuntime());
    await Deno.writeTextFile(
      join(outDir, "scl_stubs.ts"),
      renderStubs([...missingCalls].sort()),
    );
  },
};

function renderBlock(block: any): string {
  const fields = block.fields
    .map((field: any) =>
      `  ${field.name}: ${toTsType(field.datatype)} = ${
        defaultValue(field.datatype)
      };`
    )
    .join("\n");

  const networks = block.networks.map((network: any) => {
    const condition = network.conditions.length
      ? network.conditions.join(" && ")
      : "true";
    const actions = network.actions.map((action: any) => {
      if (action.kind === "assign") {
        return `      this.${action.target} = Boolean(${action.expression});`;
      }
      if (action.kind === "set") {
        return `      this.${action.target} = rt.setCoil(this.${action.target}, ${action.expression});`;
      }
      return `      this.${action.target} = rt.resetCoil(this.${action.target}, ${action.expression});`;
    });

    const calls = network.calls.map((call: any) => {
      const args = Object.entries(call.args).map(([k, v]) => `${k}: this.${v}`)
        .join(", ");
      return `    scl.${call.name}({ ${args} });`;
    });

    return [
      `  network_${network.index}(): void {`,
      `    if (${condition}) {`,
      ...(actions.length ? actions : ["      // no actions"]),
      "    }",
      ...calls,
      "  }",
      "",
    ].join("\n");
  }).join("\n");

  const cycle =
    block.networks.map((network: any) => `    this.network_${network.index}();`)
      .join("\n") || "    // no networks";

  return `import * as rt from "./runtime.ts";
import * as scl from "./scl_stubs.ts";

export class ${sanitizeIdent(block.name)} {
${fields || "  // no interface fields"}

${networks}  cycle(): void {
${cycle}
  }
}
`;
}

function renderRuntime(): string {
  return `export type BOOL = boolean;
export type INT = number;
export type DINT = number;
export type UINT = number;
export type REAL = number;
export type TIME = number;
export type STRING = string;

export function rising(current: boolean): boolean {
  return current;
}

export function setCoil(previous: boolean, condition: boolean): boolean {
  return previous || condition;
}

export function resetCoil(previous: boolean, condition: boolean): boolean {
  return condition ? false : previous;
}

export function z3Bool(name: string): unknown {
  try {
    // deno-lint-ignore no-explicit-any
    const z3 = (globalThis as any).z3;
    return z3?.Bool?.(name) ?? false;
  } catch {
    return false;
  }
}
`;
}

function renderStubs(missing: string[]): string {
  return missing
    .map((name) =>
      `export function ${name}(_args: Record<string, unknown>): void { /* auto-generated */ }`
    )
    .join("\n") || "export {}\n";
}

function toTsType(datatype: string): string {
  return TYPE_MAP[datatype] || "unknown";
}

function defaultValue(datatype: string): string {
  const t = toTsType(datatype);
  if (t === "rt.STRING") return "''";
  if (t === "rt.BOOL") return "false";
  if (["rt.INT", "rt.DINT", "rt.UINT", "rt.REAL", "rt.TIME"].includes(t)) {
    return "0";
  }
  return "undefined as unknown";
}
