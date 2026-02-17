import { walkDirectory } from "./walker.ts";
import { OpennessNode } from "./types.ts";
import { buildBlockIR, isCompilableBlock } from "./compiler/flow_parser.ts";
import { emitPythonProject } from "./compiler/python_backend.ts";

const inputRoot = Deno.args[0] || "examples/PLC_1/PLC_1/Program blocks";
const outputRoot = Deno.args[1] || "generated_py";

async function main() {
  const tree = await walkDirectory(inputRoot);
  const nodes = flatten(tree);

  const blocks = nodes
    .filter((n) => isCompilableBlock(n.type))
    .map((n) => buildBlockIR({
      blockName: n.blockName,
      path: n.path,
      type: n.type,
      networks: n.networks,
      interface: n.interface,
      xmlContent: n.xmlContent,
    }));

  const emit = await emitPythonProject(blocks, outputRoot);

  console.log(`Compiled ${blocks.length} blocks into ${outputRoot}`);
  console.log(`Generated ${emit.missingCalls.size} SCL stubs.`);
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
