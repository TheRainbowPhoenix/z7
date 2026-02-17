import { walkDirectory } from "./walker.ts";
import { OpennessNode } from "./types.ts";
import { compileProgram } from "./compiler/flow_parser.ts";
import { emitProgram } from "./compiler/transpiler.ts";
import { pythonBackend } from "./compiler/backends/python_backend.ts";
import { typescriptBackend } from "./compiler/backends/typescript_backend.ts";

const inputRoot = Deno.args[0] || "examples/PLC_1/PLC_1/Program blocks";
const outputRoot = Deno.args[1] || "generated";
const targetsArg = Deno.args[2] || "python,typescript";

async function main() {
  const tree = await walkDirectory(inputRoot);
  const nodes = flatten(tree);
  const program = compileProgram(nodes);

  const selectedTargets = targetsArg.split(",").map((t) =>
    t.trim().toLowerCase()
  );
  const backends = [];
  if (selectedTargets.includes("python")) backends.push(pythonBackend);
  if (selectedTargets.includes("typescript")) backends.push(typescriptBackend);

  await emitProgram(program, outputRoot, backends);

  console.log(`Compiled ${program.blocks.length} blocks from: ${inputRoot}`);
  console.log(
    `Emitted targets: ${backends.map((b) => b.id).join(", ") || "none"}`,
  );
  console.log(`Output directory: ${outputRoot}`);
}

function flatten(root: OpennessNode): OpennessNode[] {
  const out: OpennessNode[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const item = stack.pop()!;
    out.push(item);
    if (item.children) stack.push(...item.children);
  }

  return out;
}

if (import.meta.main) {
  await main();
}
