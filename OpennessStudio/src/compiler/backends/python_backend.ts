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
  Variant: "Any",
};

export const pythonBackend: Backend = {
  id: "python",
  async emit(ctx: BackendContext): Promise<void> {
    const outDir = join(ctx.outDir, "python");
    await ensureDir(outDir);

    const knownBlocks = new Set(
      ctx.program.blocks.map((b) => sanitizeIdent(b.name)),
    );
    const missingCalls = new Set<string>();

    for (const block of ctx.program.blocks) {
      const modName = sanitizeIdent(block.name).toLowerCase();
      const modulePath = join(outDir, `${modName}.py`);
      await Deno.writeTextFile(modulePath, renderBlock(block));

      for (const net of block.networks) {
        for (const call of net.calls) {
          if (!knownBlocks.has(call.name)) missingCalls.add(call.name);
        }
      }
    }

    await Deno.writeTextFile(join(outDir, "runtime.py"), renderRuntime());
    await Deno.writeTextFile(
      join(outDir, "scl_stubs.py"),
      renderStubs([...missingCalls].sort()),
    );
    await Deno.writeTextFile(join(outDir, "__init__.py"), "");
  },
};

function renderBlock(block: any): string {
  const fields = block.fields
    .map((field: any) =>
      `    ${field.name}: ${mapType(field.datatype)} = ${
        defaultValue(field.datatype)
      }`
    )
    .join("\n");

  const networkMethods = block.networks.map((network: any) => {
    const condition = network.conditions.length
      ? network.conditions.join(" and ")
      : "True";
    const actions = network.actions.map((action: any) => {
      if (action.kind === "assign") {
        return `            self.${action.target} = bool(${action.expression})`;
      }
      if (action.kind === "set") {
        return `            self.${action.target} = rt.set_coil(self.${action.target}, ${action.expression})`;
      }
      return `            self.${action.target} = rt.reset_coil(self.${action.target}, ${action.expression})`;
    });

    const calls = network.calls.map((call: any) => {
      const args = Object.entries(call.args).map(([k, v]) => `${k}=self.${v}`)
        .join(", ");
      return `        scl_stubs.${call.name}(${args})`;
    });

    return [
      `    def network_${network.index}(self) -> None:`,
      `        if ${condition}:`,
      ...(actions.length ? actions : ["            pass"]),
      ...calls,
      "",
    ].join("\n");
  }).join("\n");

  const cycle =
    block.networks.map((network: any) =>
      `        self.network_${network.index}()`
    ).join("\n") || "        pass";

  return `from __future__ import annotations
from dataclasses import dataclass
from typing import Any

from . import runtime as rt
from . import scl_stubs


@dataclass
class ${sanitizeIdent(block.name)}:
${fields || "    pass"}

${networkMethods}    def cycle(self) -> None:
${cycle}
`;
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


def z3_bool(name: str):
    try:
        import z3  # type: ignore
        return z3.Bool(name)
    except Exception:
        return False
`;
}

function renderStubs(missing: string[]): string {
  const body = missing
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
  return "None";
}
