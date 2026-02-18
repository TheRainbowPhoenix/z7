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
  Variant: "Any",
};

export const pythonBackend: Backend = {
  id: "python",
  async emit(ctx: BackendContext): Promise<void> {
    const outDir = join(ctx.outDir, "python");
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
      const modName = sanitizeIdent(block.name).toLowerCase();
      const modulePath = join(outDir, `${modName}.py`);
      await Deno.writeTextFile(modulePath, renderBlock(block, knownBlocks));

      for (const net of block.networks) {
        for (const call of net.calls) allCalled.add(call.name);
      }
    }

    await Deno.writeTextFile(join(outDir, "runtime.py"), renderRuntime());
    await Deno.writeTextFile(
      join(outDir, "scl_stubs.py"),
      renderStubs([...allCalled].sort(), knownBlocks),
    );
    await Deno.writeTextFile(join(outDir, "__init__.py"), "");
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
    `from .${c.module} import ${c.className}`
  ).join("\n");
  const depFields = calledKnown.map((c) =>
    `    _dep_${c.module}: ${c.className} = field(default_factory=${c.className})`
  ).join("\n");

  const fields = block.fields
    .map((field) =>
      `    ${field.name}: ${mapType(field.datatype)} = ${
        defaultValue(field.datatype)
      }`
    )
    .join("\n");

  const networkMethods = block.networks.map((network) =>
    renderNetwork(network, calledKnown)
  ).join("\n");
  const cycle =
    block.networks.map((network) => `        self.network_${network.index}()`)
      .join("\n") || "        pass";

  return `from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any

from . import runtime as rt
from . import scl_stubs
${imports}


@dataclass
class ${sanitizeIdent(block.name)}(rt.AutoStruct):
${fields || "    pass"}
${depFields ? `${depFields}\n` : ""}
${networkMethods}    def cycle(self) -> None:
${cycle}
`;
}

function renderNetwork(
  network: NetworkIR,
  calledKnown: { module: string; className: string; callName: string }[],
): string {
  const condition = qualifyPythonExpr(
    network.conditions.length ? network.conditions.join(" and ") : "True",
  );

  const actions = network.actions.map((action) => {
    const target = `self.${action.target}`;
    const expr = qualifyPythonExpr(action.expression);
    if (action.kind === "assign") {
      return `            ${target} = bool(${expr})`;
    }
    if (action.kind === "set") {
      return `            ${target} = rt.set_coil(${target}, ${expr})`;
    }
    return `            ${target} = rt.reset_coil(${target}, ${expr})`;
  });

  const calls = network.calls.map((call) => {
    const known = calledKnown.find((c) => c.callName === call.name);
    if (!known) {
      const args = Object.entries(call.args).map(([k, v]) =>
        `${k}=${qualifyPythonExpr(v)}`
      ).join(", ");
      return `        scl_stubs.${call.name}(${args})`;
    }

    const assigns = Object.entries(call.args).map(([k, v]) =>
      `        self._dep_${known.module}.${sanitizeIdent(k)} = ${
        qualifyPythonExpr(v)
      }`
    ).join("\n");
    return `${assigns}${
      assigns ? "\n" : ""
    }        self._dep_${known.module}.cycle()`;
  });

  return [
    `    def network_${network.index}(self) -> None:`,
    `        if ${condition}:`,
    ...(actions.length ? actions : ["            pass"]),
    ...calls,
    "",
  ].join("\n");
}

function qualifyPythonExpr(expr: string): string {
  const out = expr.replace(
    /\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\b/g,
    (token) => {
      if (
        ["True", "False", "None", "and", "or", "not", "rt", "bool"].includes(
          token,
        )
      ) return token;
      if (token.startsWith("rt.")) return token;
      if (/^[0-9]/.test(token)) return token;
      return `self.${token}`;
    },
  );

  return out.replace(/self\.rt\./g, "rt.");
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
  return `from __future__ import annotations
from typing import NewType, Union

BOOL = bool
INT = NewType("INT", int)
DINT = NewType("DINT", int)
UINT = NewType("UINT", int)
REAL = NewType("REAL", float)
TIME = NewType("TIME", int)
STRING = NewType("STRING", str)

BoolLike = Union[bool, int]


def rising(current: BoolLike) -> bool:
    return bool(current)


def set_coil(previous: BoolLike, condition: BoolLike) -> bool:
    return bool(previous) or bool(condition)


def reset_coil(previous: BoolLike, condition: BoolLike) -> bool:
    if bool(condition):
        return False
    return bool(previous)


class AutoStruct:
    def __getattr__(self, name: str):
        child = AutoStruct()
        setattr(self, name, child)
        return child

    def __bool__(self) -> bool:
        return False


def z3_bool(name: str):
    try:
        import z3  # type: ignore
        return z3.Bool(name)
    except Exception:
        return False
`;
}

function renderStubs(
  calls: string[],
  knownBlocks: Map<string, { module: string; className: string }>,
): string {
  const body = calls
    .filter((name) => !knownBlocks.has(name))
    .map((name) =>
      `def ${name}(**kwargs: object) -> None:\n    \"\"\"Auto-generated stub\"\"\"\n    return None\n`
    )
    .join("\n");

  return `from __future__ import annotations

${body || "# No missing SCL calls\n"}`;
}

function mapType(t: string): string {
  return TYPE_MAP[t] || "Any";
}

function defaultValue(t: string): string {
  const mapped = mapType(t);
  if (mapped === "rt.BOOL") return "False";
  if (["rt.INT", "rt.DINT", "rt.UINT", "rt.TIME"].includes(mapped)) {
    return `${mapped}(0)`;
  }
  if (mapped === "rt.REAL") return "rt.REAL(0.0)";
  if (mapped === "rt.STRING") return "rt.STRING('')";
  return "rt.AutoStruct()";
}
