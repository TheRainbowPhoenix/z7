import { walkDirectory } from "./walker.ts";
import { BlockType, OpennessNode } from "./types.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

const START_PATH = "c:\\Users\\Phoebe\\Documents\\git\\OpennessStudio\\Examples\\PLC_1\\Program blocks";

async function main() {
    console.log("Starting analysis of:", START_PATH);
    const tree = await walkDirectory(START_PATH);

    // Simple display function
    function displayTree(node: OpennessNode, indent: string = "") {
        let info = `${indent}${node.name}`;

        // Add Openness specifics if available
        if (node.type !== BlockType.Folder && node.type !== BlockType.Unknown) {
            const blockId = node.number !== undefined ? `[${node.type}${node.number}]` : `[${node.type}]`;
            const blockName = node.blockName ? ` (${node.blockName})` : "";
            info = `${indent}${node.name} ${blockId}${blockName}`;
        }

        console.log(info);

        if (node.children) {
            node.children.forEach(child => displayTree(child, indent + "  "));
        }
    }

    displayTree(tree);

    // Optionally save to full JSON for inspection
    await Deno.writeTextFile("output_tree.json", JSON.stringify(tree, null, 2));
    console.log("\nFull tree saved to output_tree.json");
    console.log("Found " + countNodes(tree) + " nodes.");
}

function countNodes(node: OpennessNode): number {
    let count = 1;
    if (node.children) {
        for (const child of node.children) {
            count += countNodes(child);
        }
    }
    return count;
}

if (import.meta.main) {
    main();
}
