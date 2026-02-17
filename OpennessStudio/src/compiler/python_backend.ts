import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";
import { BlockIR } from "./ir.ts";
import { sanitizeIdent } from "./flow_parser.ts";

const TYPE_MAP: Record<string, string> = {
  Bool: "BOOL",
  Int: "INT",
  DInt: "DINT",
  UInt: "UINT",
  Real: "REAL",
  Time: "TIME",
  String: "STRING",
  Variant: "Any",
};

export interface PythonEmitResult {
  missingCalls: Set<string>;
}

export async function emitPythonProject(blocks: BlockIR[], outDir: string): Promise<PythonEmitResult> {
  await ensureDir(outDir);
  const missingCalls = new Set<string>();

  const knownCalls = new Set(blocks.map((b) => sanitizeIdent(b.name)));

  for (const block of blocks) {
    const moduleName = sanitizeIdent(block.name).toLowerCase();
    const filePath = join(outDir, `${moduleName}.py`);
    await Deno.writeTextFile(filePath, renderBlockModule(block));

    for (const network of block.networks) {
      for (const call of network.calls) {
        if (!knownCalls.has(call.name)) missingCalls.add(call.name);
      }
    }
  }

  await Deno.writeTextFile(join(outDir, "runtime.py"), renderRuntime());
  await Deno.writeTextFile(join(outDir, "scl_stubs.py"), renderStubs(Array.from(missingCalls).sort()));
  await Deno.writeTextFile(join(outDir, "__init__.py"), "");

  return { missingCalls };
}

function renderBlockModule(block: BlockIR): string {
  const fieldLines = block.fields.map((f) => `    ${f.name}: ${toPyType(f.datatype)} = ${defaultValue(f.datatype)}`);

  const methodLines = block.networks.map((n) => {
    const condition = n.conditions.length > 0 ? n.conditions.join(" and ") : "True";
    const actionLines = n.actions.map((a) => {
      if (a.kind === "assign") return `            self.${a.target} = bool(${a.expression})`;
      if (a.kind === "set") return `            self.${a.target} = set_coil(self.${a.target}, ${a.expression})`;
      return `            self.${a.target} = reset_coil(self.${a.target}, ${a.expression})`;
    });

    const callLines = n.calls.map((c) => {
      const args = Object.entries(c.args).map(([k, v]) => `${sanitizeIdent(k)}=self.${v}`).join(", ");
      return `        scl_stubs.${c.name}(${args})`;
    });

    const body = [
      `    def network_${n.index}(self) -> None:`,
      `        if ${condition}:`,
      ...(actionLines.length > 0 ? actionLines : ["            pass"]),
      ...callLines,
      "",
    ];

    return body.join("\n");
  }).join("\n");

  const cycleBody = block.networks.map((n) => `        self.network_${n.index}()`).join("\n") || "        pass";

  return `from __future__ import annotations
from dataclasses import dataclass
from typing import Any

from .runtime import *
from . import scl_stubs


@dataclass
class ${sanitizeIdent(block.name)}:
${fieldLines.length > 0 ? fieldLines.join("\n") : "    pass"}

${methodLines}    def cycle(self) -> None:
${cycleBody}
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
    """Create a symbolic boolean when z3-solver is installed."""
    try:
        import z3  # type: ignore

        return z3.Bool(name)
    except Exception:
        return False
`;
}

function renderStubs(stubs: string[]): string {
  const methods = stubs.map((name) => `def ${name}(**kwargs: object) -> None:\n    \"\"\"Auto-generated SCL stub.\"\"\"\n    return None\n`).join("\n");

  return `from __future__ import annotations

${methods || "# No missing SCL calls were detected.\n"}`;
}

function toPyType(datatype: string): string {
  return TYPE_MAP[datatype] || sanitizeIdent(datatype) || "Any";
}

function defaultValue(datatype: string): string {
  const normalized = toPyType(datatype);
  if (normalized === "BOOL") return "False";
  if (["INT", "DINT", "UINT", "TIME"].includes(normalized)) return `${normalized}(0)`;
  if (normalized === "REAL") return "REAL(0.0)";
  if (normalized === "STRING") return "STRING('')";
  return "None";
}
