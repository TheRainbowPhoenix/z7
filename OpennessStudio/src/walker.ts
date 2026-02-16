import { parseFile, parseSclFile } from "./parser.ts";
import { BlockType, OpennessNode } from "./types.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts"; // Or implementation manually if needed

/**
 * Recursively walks a directory and builds an OpennessNode tree.
 */
export async function walkDirectory(dirPath: string): Promise<OpennessNode> {
    const rootName = dirPath.split(/[\\/]/).pop() || "Root";
    const rootNode: OpennessNode = {
        name: rootName,
        type: BlockType.Folder,
        path: dirPath,
        children: []
    };

    try {
        for await (const entry of Deno.readDir(dirPath)) {
            const entryPath = join(dirPath, entry.name);

            if (entry.isDirectory) {
                const childNode = await walkDirectory(entryPath);
                rootNode.children?.push(childNode);
            } else {
                if (entry.name.endsWith(".xml")) {
                    const parsedNode = await parseFile(entryPath);
                    if (parsedNode) {
                        rootNode.children?.push(parsedNode);
                    }
                } else if (entry.name.toLowerCase().endsWith(".scl")) { // Case insensitive check
                    const parsedNode = await parseSclFile(entryPath);
                    if (parsedNode) {
                        rootNode.children?.push(parsedNode);
                    }
                }
            }
        }
    } catch (err) {
        console.error(`Error walking directory ${dirPath}:`, err);
    }

    // Sort children for consistent output (Files first, then Folders as per TIA)
    rootNode.children?.sort((a, b) => {
        if (a.type === BlockType.Folder && b.type !== BlockType.Folder) return 1;
        if (a.type !== BlockType.Folder && b.type === BlockType.Folder) return -1;
        return a.name.localeCompare(b.name);
    });

    return rootNode;
}
