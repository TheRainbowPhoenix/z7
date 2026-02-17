import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { Backend, BackendContext, BlockIR, NetworkIR } from "../ir.ts";
import { sanitizeIdent } from "../flow_parser.ts";

const TYPE_MAP: Record<string, string> = {
  Bool: "rt.BOOL",
  Int: "rt.INT",
  DInt: "rt.DINT",
  UInt: "rt.UINT",
  Real: "rt.REAL",
  Time: "rt.TIME",
  String: "rt.STRING",
  Variant: "any",
};

export const typescriptBackend: Backend = {
  id: "typescript",
  async emit(ctx: BackendContext): Promise<void> {
    const outDir = join(ctx.outDir, "typescript");
    await ensureDir(outDir);

    const knownBlocks = new Map(
      ctx.program.blocks.map((
        b,
      ) => [sanitizeIdent(b.name), {
        module: sanitizeIdent(b.name).toLowerCase(),
        className: sanitizeIdent(b.name),
      }]),
    );
    const allCalled = new Set<string>();

    for (const block of ctx.program.blocks) {
      const moduleName = sanitizeIdent(block.name).toLowerCase();
      await Deno.writeTextFile(
        join(outDir, `${moduleName}.ts`),
        renderBlock(block, knownBlocks),
      );

      for (const network of block.networks) {
        for (const call of network.calls) allCalled.add(call.name);
      }
    }

    await Deno.writeTextFile(join(outDir, "runtime.ts"), renderRuntime());
    await Deno.writeTextFile(
      join(outDir, "scl_stubs.ts"),
      renderStubs([...allCalled].sort(), knownBlocks),
    );
  },
};

function renderBlock(
  block: BlockIR,
  knownBlocks: Map<string, { module: string; className: string }>,
): string {
  const calledKnown = collectKnownCalls(
    block.networks,
    block.name,
    knownBlocks,
  );
  const imports = calledKnown.map((c) =>
    `import { ${c.className} } from "./${c.module}.ts";`
  ).join("\n");
  const depFields = calledKnown.map((c) =>
    `  private _dep_${c.module}: ${c.className} = new ${c.className}();`
  ).join("\n");

  const fields = block.fields
    .map((field) =>
      `  ${field.name}: ${toTsType(field.datatype)} = ${
        defaultValue(field.datatype)
      };`
    )
    .join("\n");

  const networks = block.networks.map((network) =>
    renderNetwork(network, calledKnown)
  ).join("\n");
  const cycle =
    block.networks.map((network) => `    this.network_${network.index}();`)
      .join("\n") || "    // no networks";

  return `import * as rt from "./runtime.ts";
import * as scl from "./scl_stubs.ts";
${imports}

export class ${sanitizeIdent(block.name)} {
  [key: string]: any;
${fields || "  // no interface fields"}
${depFields ? `${depFields}\n` : ""}
${networks}  cycle(): void {
${cycle}
  }
}
`;
}

function renderNetwork(
  network: NetworkIR,
  calledKnown: { module: string; className: string; callName: string }[],
): string {
  const condition = qualifyTsExpr(
    network.conditions.length ? network.conditions.join(" and ") : "True",
  );
  const actions = network.actions.map((action) => {
    const target = `this.${action.target}`;
    const expr = qualifyTsExpr(action.expression);
    if (action.kind === "assign") return `      ${target} = Boolean(${expr});`;
    if (action.kind === "set") {
      return `      ${target} = rt.setCoil(${target}, ${expr});`;
    }
    return `      ${target} = rt.resetCoil(${target}, ${expr});`;
  });

  const calls = network.calls.map((call) => {
    const known = calledKnown.find((c) => c.callName === call.name);
    if (!known) {
      const args = Object.entries(call.args).map(([k, v]) =>
        `${k}: ${qualifyTsExpr(v)}`
      ).join(", ");
      return `    scl.${call.name}({ ${args} });`;
    }

    const assigns = Object.entries(call.args).map(([k, v]) =>
      `    this._dep_${known.module}.${sanitizeIdent(k)} = ${qualifyTsExpr(v)};`
    ).join("\n");
    return `${assigns}${
      assigns ? "\n" : ""
    }    this._dep_${known.module}.cycle();`;
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
}

function qualifyTsExpr(expr: string): string {
  let out = expr
    .replace(/\band\b/g, "&&")
    .replace(/\bor\b/g, "||")
    .replace(/\bnot\b/g, "!")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false");

  out = out.replace(
    /\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\b/g,
    (token) => {
      if (["true", "false", "rt", "Boolean"].includes(token)) return token;
      if (token.startsWith("rt.")) return token;
      if (/^[0-9]/.test(token)) return token;
      return `this.${token}`;
    },
  );

  return out.replace(/this\.rt\./g, "rt.");
}

function collectKnownCalls(
  networks: NetworkIR[],
  blockName: string,
  knownBlocks: Map<string, { module: string; className: string }>,
) {
  const own = sanitizeIdent(blockName);
  const out: { module: string; className: string; callName: string }[] = [];
  const seen = new Set<string>();

  for (const n of networks) {
    for (const c of n.calls) {
      if (c.name === own) continue;
      const kb = knownBlocks.get(c.name);
      if (!kb || seen.has(c.name)) continue;
      seen.add(c.name);
      out.push({ ...kb, callName: c.name });
    }
  }

  return out;
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

function renderStubs(
  calls: string[],
  knownBlocks: Map<string, { module: string; className: string }>,
): string {
  const out = calls
    .filter((name) => !knownBlocks.has(name))
    .map((name) =>
      `export function ${name}(_args: Record<string, unknown>): void { /* auto-generated */ }`
    )
    .join("\n");

  return out || "export {}\n";
}

function toTsType(datatype: string): string {
  return TYPE_MAP[datatype] || "any";
}

function defaultValue(datatype: string): string {
  const t = toTsType(datatype);
  if (t === "rt.STRING") return "''";
  if (t === "rt.BOOL") return "false";
  if (["rt.INT", "rt.DINT", "rt.UINT", "rt.REAL", "rt.TIME"].includes(t)) {
    return "0";
  }
  return "{} as any";
}
