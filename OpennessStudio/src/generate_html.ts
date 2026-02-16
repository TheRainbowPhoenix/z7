import { BlockType, OpennessNode } from "./types.ts";

const OUTPUT_FILE = "output_tree.html";
const JSON_FILE = "output_tree.json";

// User provided styles + Custom styles
const STYLES = `
<style type="text/css" media="screen">
    body { background-color: #1e1e1e; color: #cccccc; font-family: -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "Ubuntu", "Droid Sans", sans-serif; margin: 0; padding: 0; }
    .monaco-list-rows { background: var(--vscode-sideBar-background); }
    .monaco-list-row { cursor: pointer; display: flex; align-items: center; }
    .monaco-list-row:hover { background-color: #2a2d2e; }
    .monaco-tl-row { display: flex; height: 100%; width: 100%; align-items: center; }
    .monaco-tl-indent { height: 100%; display: flex; }
    .indent-guide { border-left: 1px solid #404040; width: 1px; height: 100%; margin-left: 10px; opacity: 0.4; }
    .monaco-tl-twistie { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; }
    .monaco-tl-twistie::before { content: "›"; font-size: 14px; color: #cccccc; transition: transform 0.1s; }
    .collapsible.codicon-tree-item-expanded::before { transform: rotate(90deg); }
    .monaco-tl-contents { flex: 1; display: flex; align-items: center; padding-left: 4px; overflow: hidden; }
    .monaco-icon-label { display: flex; align-items: center; }
    .monaco-icon-label-container { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .label-name { color: #cccccc; text-decoration: none; font-size: 13px; margin-left: 6px; }

    /* Custom Icons */
    .icon { width: 16px; height: 16px; background-repeat: no-repeat; background-position: center; display: inline-block; }
    
    .icon-folder { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%23dcb67a" d="M14.5 3H7.71l-.85-.85L6.37 1.63C6.27 1.53 6.14 1.5 6 1.5H1.5C.67 1.5 0 2.17 0 3v10c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5V4.5c0-.83-.67-1.5-1.5-1.5z"/></svg>'); }
    
    /* Transistor Icons - adjusted for better visibility */
    .icon-ob { background-image: url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="12" height="12" fill="%23800080"/><rect x="5" y="5" width="6" height="6" fill="%23D080FF"/><line x1="0" y1="5" x2="2" y2="5" stroke="%23800080" stroke-width="2"/><line x1="0" y1="11" x2="2" y2="11" stroke="%23800080" stroke-width="2"/><line x1="14" y1="8" x2="16" y2="8" stroke="%23800080" stroke-width="2"/></svg>'); }
    
    .icon-fb { background-image: url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="12" height="12" fill="%230000FF"/><rect x="5" y="5" width="6" height="6" fill="%238080FF"/><line x1="0" y1="5" x2="2" y2="5" stroke="%230000FF" stroke-width="2"/><line x1="0" y1="11" x2="2" y2="11" stroke="%230000FF" stroke-width="2"/><line x1="14" y1="8" x2="16" y2="8" stroke="%230000FF" stroke-width="2"/></svg>'); }
    
    .icon-fc { background-image: url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="12" height="12" fill="%23008000"/><rect x="5" y="5" width="6" height="6" fill="%2380FF80"/><line x1="0" y1="5" x2="2" y2="5" stroke="%23008000" stroke-width="2"/><line x1="0" y1="11" x2="2" y2="11" stroke="%23008000" stroke-width="2"/><line x1="14" y1="8" x2="16" y2="8" stroke="%23008000" stroke-width="2"/></svg>'); }
    
    .icon-db { background-image: url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><ellipse cx="8" cy="4" rx="6" ry="2" fill="%234040FF"/><path d="M2,4 v8 a6,2 0 0,0 12,0 v-8" fill="%230000C0"/><ellipse cx="8" cy="4" rx="6" ry="2" fill="none" stroke="%23000080" stroke-width="1"/></svg>'); }
    
    .icon-udt { background-image: url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="10" height="12" fill="none" stroke="%23cccccc" stroke-width="1"/><line x1="5" y1="5" x2="11" y2="5" stroke="%23cccccc" stroke-width="1"/><line x1="5" y1="8" x2="11" y2="8" stroke="%23cccccc" stroke-width="1"/><line x1="5" y1="11" x2="11" y2="11" stroke="%23cccccc" stroke-width="1"/></svg>'); }

    .icon-file { background-image: url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M13.71,4.29l-3-3A1,1,0,0,0,10,1H4A1,1,0,0,0,3,2V14a1,1,0,0,0,1,1H12a1,1,0,0,0,1-1V5A1,1,0,0,0,13.71,4.29ZM10,3.41,11.59,5H10Z" fill="%23cccccc"/></svg>'); }
</style>
`;

// Helper to determine icon class
function getIconClass(node: OpennessNode): string {
    if (node.type === BlockType.Folder) return "icon-folder";
    if (node.type === BlockType.OB) return "icon-ob";
    if (node.type === BlockType.FB) return "icon-fb";
    if (node.type === BlockType.FC) return "icon-fc";
    if (node.type === BlockType.DB) return "icon-db";
    if (node.type === BlockType.UDT) return "icon-udt";
    return "icon-file";
}

let globalIndex = 0;

function generateTreeHtml(node: OpennessNode, level: number = 1): string {
    const isFolder = node.type === BlockType.Folder;
    const hasChildren = node.children && node.children.length > 0;
    const iconClass = getIconClass(node);
    const expandClass = (isFolder && hasChildren) ? "collapsible codicon-tree-item-expanded" : "";
    const index = globalIndex++;

    // Indent calculation
    const indentWidth = 20; // px
    const indentHtml = [];
    for (let i = 0; i < level - 1; i++) {
        indentHtml.push(`<div class="indent-guide"></div>`);
    }

    // Label construction
    let label = node.name;
    if (node.blockName && node.type !== BlockType.Folder) {
        label = `${node.blockName} [${node.type}${node.number !== undefined ? node.number : ''}]`;
    }

    let html = `
    <div class="monaco-list-row" role="treeitem" data-index="${index}" aria-level="${level}" style="padding-left: 0px">
        <div class="monaco-tl-row">
            <div class="monaco-tl-indent" style="width: ${(level - 1) * indentWidth}px">
                ${indentHtml.join('')}
            </div>
            <div class="monaco-tl-twistie ${expandClass}"></div>
            <div class="monaco-tl-contents">
                <div class="monaco-icon-label">
                    <div class="icon ${iconClass}"></div>
                    <div class="monaco-icon-label-container">
                        <a class="label-name"><span class="monaco-highlighted-label">${label}</span></a>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    if (hasChildren && node.children) {
        node.children.forEach(child => {
            html += generateTreeHtml(child, level + 1);
        });
    }

    return html;
}

async function main() {
    try {
        const text = await Deno.readTextFile(JSON_FILE);
        const tree: OpennessNode = JSON.parse(text);

        const listContent = generateTreeHtml(tree);

        const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Openness Studio Explorer</title>
    ${STYLES}
</head>
<body>
    <div class="pane-body">
        <div class="explorer-folders-view">
            <div class="monaco-list">
                <div class="monaco-scrollable-element">
                    <div class="monaco-list-rows">
                        ${listContent}
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

        await Deno.writeTextFile(OUTPUT_FILE, fullHtml);
        console.log(`Generated ${OUTPUT_FILE}`);

    } catch (err) {
        console.error("Error generating HTML:", err);
    }
}

if (import.meta.main) {
    main();
}
