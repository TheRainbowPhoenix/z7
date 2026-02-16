
import { parseFile } from "./parser.ts";
import { BlockType, OpennessNode, Network, NetworkPart, NetworkWire, Connection } from "./types.ts";
import { join, dirname } from "https://deno.land/std@0.208.0/path/mod.ts";

// --- Types for Graph Representation ---

interface GraphNode {
    id: string; // UId
    x: number;
    y: number;
    width: number;
    height: number;
    data: NetworkPart;
    inputs: GraphPin[];
    outputs: GraphPin[];
    rank: number; // Topological sort depth
    operandLabel?: string; // For Coils/Contacts/etc driven by a variable
}

interface GraphPin {
    name: string; // "en", "in1", "out", etc.
    type: "input" | "output";
    connectedWireId?: string;
    relY: number; // Y position relative to node top
    relX?: number; // Optional X override
    isNegated?: boolean;
    connectedVariable?: string; // Merged variable name
    isConnected?: boolean;
}

interface GraphWire {
    id: string; // Wire UId
    points?: { x: number, y: number }[];
    source?: { nodeId: string, pinName: string };
    targets: { nodeId: string, pinName: string }[];
}

// --- Configuration ---
const BLOCK_WIDTH = 150;
const HEADER_HEIGHT = 40;
const PIN_ROW_HEIGHT = 20;
const COL_SPACING = 100;
const ROW_SPACING = 40;
const RANK_WIDTH = 300;
const VAR_BOX_WIDTH = 120; // Configured Box Width

// --- Labels Mapping ---
const BLOCK_NAME_MAP: Record<string, string> = {
    "A": "&",
    "O": ">=1",
    "X": "X", // XOR usually X or =/= 
    "Coil": "=",
    "SCoil": "S",
    "RCoil": "R",
    "Contact": "Contact"
};
const BASIC_BLOCKS = ["A", "O", "X", "Coil", "SCoil", "RCoil"];

// --- File Mapping for Links ---
let fileMap: Record<string, string> = {};

// --- Main Render Function ---

export async function renderFbd(filePath: string) {
    // 1. Load File Map from output_tree.json if exists
    try {
        const treeText = await Deno.readTextFile("output_tree.json");
        const tree = JSON.parse(treeText) as OpennessNode;
        buildFileMap(tree);
    } catch (e) {
        console.warn("Could not load output_tree.json for file linking. " + e);
    }

    const node = await parseFile(filePath);
    if (!node) {
        console.error(`Could not parse ${filePath}`);
        return;
    }

    if (!node.networks || node.networks.length === 0) {
        console.log(`No networks found in ${node.name}`);
        return;
    }

    let htmlBody = `<div class="fbd-container">`;
    htmlBody += `<h1>${node.name} [${node.type}${node.number || ''}]</h1>`;

    node.networks.forEach((network, index) => {
        const svgContent = layoutAndRenderNetwork(network, index + 1);
        htmlBody += `
        <div class="network-container">
            <div class="network-header">
                <span class="network-title">Network ${index + 1}</span>
            </div>
            <div class="network-body">
                ${svgContent}
            </div>
        </div>`;
    });

    htmlBody += `</div>`;

    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>FBD Viewer - ${node.name}</title>
    <style>
        body { background-color: #1e1e1e; color: #cccccc; font-family: "Segoe UI", sans-serif; }
        .fbd-container { padding: 20px; }
        .network-container { background-color: #252526; margin-bottom: 20px; border: 1px solid #333; }
        .network-header { background-color: #333; padding: 5px 10px; font-weight: bold; border-bottom: 1px solid #444; }
        .network-body { padding: 10px; overflow-x: auto; }
        svg { background-color: #f0f0f0; display: block; } 
        
        /* SVG Styles */
        text { font-family: "Segoe UI", Consolas, monospace; font-size: 12px; }
        .block-body { fill: #e0e0e0; stroke: #888; stroke-width: 1; }
        .block-header { fill: #ffffcc; stroke: #888; stroke-width: 1; } /* Yellow header */
        .block-title { font-weight: bold; fill: #000; text-anchor: middle; dominant-baseline: middle; }
        .block-type { fill: #666; font-size: 10px; text-anchor: middle; }
        
        .pin-label { fill: #000; font-size: 11px; }
        .pin-label.input { text-anchor: start; }
        .pin-label.output { text-anchor: end; }
        
        .wire { stroke: #000; stroke-width: 2; fill: none; }
        .pin-negated { fill: #fff; stroke: #000; stroke-width: 1; }
        
        .variable-text { fill: #000; font-size: 11px; }
        .variable-box { fill: #ffffcc; fill-opacity: 0.5; stroke: none; }
        .operand-bg { fill: #ffff00; fill-opacity: 0.8; stroke: none; }
    </style>
</head>
<body>
    ${htmlBody}
</body>
</html>`;

    const outPath = `output_fbd.html`;
    await Deno.writeTextFile(outPath, fullHtml);
    console.log(`Generated ${outPath}`);
}

function buildFileMap(node: OpennessNode) {
    if (node.name) {
        // Map Name without extension -> File Path
        const key = node.name.replace(/\.(xml|scl)$/i, "");
        fileMap[key] = node.name;
        console.log(`Mapped: ${key} -> ${node.name}`); // Debug
    }
    if (node.children) {
        node.children.forEach(buildFileMap);
    }
}

// --- Layout & Render Logic ---

function layoutAndRenderNetwork(network: Network, netIndex: number): string {
    const nodes = new Map<string, GraphNode>();

    // 1. Build Nodes
    network.parts.forEach(part => {
        const inputs = getPins(part, 'input');
        const outputs = getPins(part, 'output');
        const h = calculateNodeHeight(part, inputs, outputs);
        const w = calculateNodeWidth(part);

        const node: GraphNode = {
            id: part.uid,
            x: 0,
            y: 0,
            width: w,
            height: h,
            data: part,
            inputs,
            outputs,
            rank: 0
        };
        nodes.set(part.uid, node);
    });

    const wires: GraphWire[] = [];

    // 2. Build Wires & Detect Operands + Merged Variables
    network.wires.forEach(w => {
        const points: { nodeId: string, pinName?: string, type: string }[] = [];
        let hasPowerrail = false;

        w.connections.forEach(c => {
            if (c.type === "NameCon") {
                points.push({ nodeId: c.uid!, pinName: c.name!, type: "pin" });
            } else if (c.type === "IdentCon") {
                points.push({ nodeId: c.uid!, type: "ident" });
            } else if (c.type === "Powerrail") {
                hasPowerrail = true;
            }
        });

        let isMerged = false;

        // 2a. Operand Handling (Top of block)
        const operandPin = points.find(p => p.type === 'pin' && p.pinName === 'operand');
        if (operandPin) {
            const accessNodePoint = points.find(p => {
                const n = nodes.get(p.nodeId);
                return n && n.data.type === 'Access';
            });

            if (accessNodePoint) {
                const blockNode = nodes.get(operandPin.nodeId);
                const accessNode = nodes.get(accessNodePoint.nodeId);

                if (blockNode && accessNode) {
                    // MERGE as Operand Label
                    const label = accessNode.data.symbol?.components.map(c => c.name).join('.') || "???";
                    blockNode.operandLabel = label;

                    nodes.delete(accessNode.id);
                    isMerged = true;
                }
            }
        }

        if (isMerged) return;

        // 2b. Pin Label Check (Merge Access Node to Block Pins)
        const accessPoint = points.find(p => {
            const n = nodes.get(p.nodeId);
            return n && n.data.type === 'Access';
        });

        if (accessPoint && !hasPowerrail) {
            // Check if it connects to standard pins on blocks
            const blockPoints = points.filter(p => p !== accessPoint && p.type === 'pin');

            if (blockPoints.length > 0) {
                const accessNode = nodes.get(accessPoint.nodeId);
                if (accessNode) {
                    const label = accessNode.data.symbol?.components.map(c => c.name).join('.') || "???";

                    // Apply label to all connected block pins
                    blockPoints.forEach(bp => {
                        const blockNode = nodes.get(bp.nodeId);
                        if (blockNode) {
                            const pin = [...blockNode.inputs, ...blockNode.outputs].find(p => p.name === bp.pinName);
                            if (pin) {
                                pin.connectedVariable = label;
                                pin.isConnected = true;
                            }
                        }
                    });

                    nodes.delete(accessNode.id);
                    isMerged = true;
                }
            }
        }

        if (isMerged) return;

        // 2c. Standard Wire Logic
        let source: { nodeId: string, pinName: string } | undefined;
        let targets: { nodeId: string, pinName: string }[] = [];

        if (hasPowerrail) {
            source = { nodeId: "Powerrail", pinName: "out" };
        } else {
            // Find Driver
            const driver = points.find(p => {
                const node = nodes.get(p.nodeId);
                if (!node) return false;
                // Access is Driver if it connects to an Input Pin of another node
                if (node.data.type === 'Access') {
                    return false;
                } else {
                    // Block Output
                    const pin = node.outputs.find(o => o.name === p.pinName);
                    return !!pin;
                }
            });

            if (driver) {
                source = { nodeId: driver.nodeId, pinName: driver.pinName || 'main' };
            }
        }

        points.forEach(p => {
            const node = nodes.get(p.nodeId);
            if (!node) return;
            if (source && p.nodeId === source.nodeId && (p.pinName || 'main') === source.pinName) return;
            const pinName = p.pinName || 'main';
            targets.push({ nodeId: p.nodeId, pinName });
        });

        if ((source || targets.length > 0) && targets.length > 0) {
            wires.push({
                id: w.uid,
                source,
                targets
            });
        }
    });

    // 2.5: Mark Connected Pins & Filter EN/ENO
    wires.forEach(w => {
        if (w.source && w.source.nodeId !== 'Powerrail') {
            const node = nodes.get(w.source.nodeId);
            if (node) {
                const pin = node.outputs.find(p => p.name === w.source!.pinName);
                if (pin) pin.isConnected = true;
            }
        }
        w.targets.forEach(t => {
            const node = nodes.get(t.nodeId);
            if (node) {
                const pin = node.inputs.find(p => p.name === t.pinName);
                if (pin) pin.isConnected = true;
            }
        });
    });

    nodes.forEach(node => {
        if (BASIC_BLOCKS.includes(node.data.name || "")) {
            node.inputs = node.inputs.filter(p => {
                if (p.name === 'EN' && !p.isConnected && !p.connectedVariable) return false;
                return true;
            });
            node.outputs = node.outputs.filter(p => {
                if (p.name === 'ENO' && !p.isConnected && !p.connectedVariable) return false;
                return true;
            });
        }
    });

    // 3. Rank Calculation 
    wires.forEach(w => {
        if (w.source && w.source.nodeId === "Powerrail") {
            w.targets.forEach(t => {
                const node = nodes.get(t.nodeId);
                if (node) node.rank = 0;
            });
        }
    });

    let changed = true;
    let iterations = 0;
    while (changed && iterations < 50) {
        changed = false;
        wires.forEach(wire => {
            if (wire.source) {
                let srcRank = 0;
                if (wire.source.nodeId !== "Powerrail") {
                    const srcNode = nodes.get(wire.source.nodeId);
                    if (srcNode) srcRank = srcNode.rank;
                } else {
                    srcRank = -1;
                }

                wire.targets.forEach(tgt => {
                    const tgtNode = nodes.get(tgt.nodeId);
                    if (tgtNode) {
                        // Push target to rank + 1
                        if (tgtNode.rank <= srcRank) {
                            tgtNode.rank = srcRank + 1;
                            changed = true;
                        }
                    }
                });
            }
        });
        iterations++;
    }

    // 4. Coordinates
    const rankGroups = new Map<number, GraphNode[]>();
    nodes.forEach(n => {
        if (n.rank < 0) n.rank = 0;
        if (!rankGroups.has(n.rank)) rankGroups.set(n.rank, []);
        rankGroups.get(n.rank)!.push(n);
    });

    let maxX = 0;
    let maxY = 0;

    const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);

    // With variables merged, we can start ranks further left or just spacing
    const LEFT_MARGIN = VAR_BOX_WIDTH + 50;

    sortedRanks.forEach((rank) => {
        const groupNodes = rankGroups.get(rank)!;
        let currentY = 50;
        const x = LEFT_MARGIN + (rank * RANK_WIDTH);

        groupNodes.forEach(node => {
            node.x = x;
            node.y = currentY;
            currentY += node.height + ROW_SPACING;
        });

        const maxWidth = Math.max(...groupNodes.map(n => n.width));
        if (x + maxWidth > maxX) maxX = x + maxWidth + 50;
        if (currentY > maxY) maxY = currentY;
    });

    if (maxX < 800) maxX = 800;
    if (maxY < 400) maxY = 400;

    // 5. Generate SVG
    let svg = `<svg width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}" xmlns="http://www.w3.org/2000/svg">`;

    // Draw Powerrail line
    svg += `<line x1="40" y1="20" x2="40" y2="${maxY - 20}" stroke="#000" stroke-width="2" />`;

    // Draw Wires
    wires.forEach(wire => {
        let srcX = 0, srcY = 0;

        if (wire.source) {
            if (wire.source.nodeId === "Powerrail") {
                srcX = 40;
                const firstTgt = nodes.get(wire.targets[0].nodeId);
                if (firstTgt) {
                    const tgtPin = firstTgt.inputs.find(p => p.name === wire.targets[0].pinName) || { relY: 10 };
                    srcY = firstTgt.y + tgtPin.relY;
                } else {
                    srcY = 20;
                }
            } else {
                const srcNode = nodes.get(wire.source.nodeId);
                if (srcNode) {
                    srcX = srcNode.x + srcNode.width;
                    const srcPin = srcNode.outputs.find(p => p.name === wire.source!.pinName) || { relY: srcNode.height / 2, relX: 0 };
                    srcY = srcNode.y + srcPin.relY;
                    if (srcPin.relX) srcX = srcNode.x + srcPin.relX;
                }
            }

            wire.targets.forEach(tgt => {
                const tgtNode = nodes.get(tgt.nodeId);
                if (tgtNode) {
                    let tgtX = tgtNode.x;
                    const tgtPin = tgtNode.inputs.find(p => p.name === tgt.pinName) || { relY: tgtNode.height / 2, relX: 0 };
                    let tgtY = tgtNode.y + tgtPin.relY;
                    if (tgtPin.relX) tgtX = tgtNode.x + tgtPin.relX;

                    if (wire.source?.nodeId === "Powerrail") srcY = tgtY;

                    const c1x = srcX + (tgtX - srcX) / 2;
                    const c1y = srcY;
                    const c2x = srcX + (tgtX - srcX) / 2;
                    const c2y = tgtY;

                    svg += `<path d="M ${srcX} ${srcY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tgtX} ${tgtY}" class="wire" />`;
                }
            });
        }
    });

    nodes.forEach(node => {
        svg += renderNodeSvg(node);
    });

    svg += `</svg>`;
    return svg;
}

// --- Helpers ---

function getPins(part: NetworkPart, type: "input" | "output"): GraphPin[] {
    const pins: GraphPin[] = [];
    const isNegated = (name: string) => part.negated && part.negated.includes(name);

    if (part.type === 'Part' || part.type === 'Call') {
        if (part.type === 'Call' && part.callInfo) {
            if (type === 'input') pins.push({ name: 'EN', type: 'input', relY: 0 });

            part.callInfo.parameters.forEach(p => {
                if (type === 'input' && (p.section === 'Input' || p.section === 'InOut')) {
                    pins.push({ name: p.name, type: 'input', relY: 0, isNegated: isNegated(p.name) });
                }
                if (type === 'output' && (p.section === 'Output' || p.section === 'InOut')) {
                    pins.push({ name: p.name, type: 'output', relY: 0, isNegated: isNegated(p.name) });
                }
            });

            if (type === 'output') pins.push({ name: 'ENO', type: 'output', relY: 0 });

        } else {
            // Standard Parts
            const name = part.name || "";
            let card = 2; // Default
            if (part.templateValue) {
                const c = part.templateValue.find((v: any) => v.type === "Cardinality");
                if (c) card = parseInt(c.value);
            }

            if (type === 'input') {
                pins.push({ name: 'EN', type: 'input', relY: 0 });

                // Logic Gates
                if (["A", "O", "X", "AND", "OR", "XOR"].includes(name) || name === "&" || name === ">=1") {
                    for (let i = 1; i <= card; i++) {
                        const pinName = `in${i}`;
                        pins.push({ name: pinName, type: 'input', relY: 0, isNegated: isNegated(pinName) });
                    }
                } else if (["Coil", "SCoil", "RCoil", "Contact"].includes(name)) {
                    pins.push({ name: 'in', type: 'input', relY: 0, isNegated: isNegated('in') });
                    pins.push({ name: 'operand', type: 'input', relY: 0, relX: BLOCK_WIDTH / 2 });
                } else if (name === "Move") {
                    pins.push({ name: 'in', type: 'input', relY: 0 });
                } else {
                    pins.push({ name: 'in1', type: 'input', relY: 0, isNegated: isNegated('in1') });
                }
            }

            if (type === 'output') {
                if (["Coil", "SCoil", "RCoil", "Contact"].includes(name)) {
                    pins.push({ name: 'out', type: 'output', relY: 0 });
                    pins.push({ name: 'ENO', type: 'output', relY: 0 });
                    pins.push({ name: 'operand', type: 'output', relY: 0, relX: BLOCK_WIDTH / 2 });
                } else if (name === "Move") {
                    pins.push({ name: 'out1', type: 'output', relY: 0 });
                    pins.push({ name: 'ENO', type: 'output', relY: 0 });
                } else {
                    pins.push({ name: 'out', type: 'output', relY: 0 });
                    pins.push({ name: 'ENO', type: 'output', relY: 0 });
                }
            }
        }
    } else if (part.type === 'Access') {
        if (type === 'output') pins.push({ name: 'main', type: 'output', relY: 0 });
        if (type === 'input') pins.push({ name: 'main', type: 'input', relY: 0 });
    }

    // Distribute
    if (part.type === 'Access') {
        pins.forEach(p => p.relY = 15);
    } else {
        const startY = HEADER_HEIGHT + 15;
        const sidePins = pins.filter(p => p.relX === undefined);
        sidePins.forEach((p, i) => {
            p.relY = startY + (i * PIN_ROW_HEIGHT);
        });
    }

    return pins;
}

function calculateNodeHeight(part: NetworkPart, inputs: GraphPin[], outputs: GraphPin[]): number {
    if (part.type === 'Access') return 30;
    const inSide = inputs.filter(p => p.relX === undefined).length;
    const outSide = outputs.filter(p => p.relX === undefined).length;
    const count = Math.max(inSide, outSide);
    return HEADER_HEIGHT + (count * PIN_ROW_HEIGHT) + 15;
}

function calculateNodeWidth(part: NetworkPart): number {
    if (part.type === 'Access') {
        const len = part.symbol?.components.map(c => c.name).join('.').length || 10;
        return Math.max(50, len * 9);
    }
    return BLOCK_WIDTH;
}

function renderNodeSvg(node: GraphNode): string {
    const { x, y, width, height, data } = node;
    let svg = '';

    if (data.type === 'Access') {
        const text = data.symbol?.components.map(c => c.name).join('.') || '???';
        svg += `<g transform="translate(${x}, ${y})">
            <text x="0" y="20" class="variable-text">${text}</text>
        </g>`;
    } else {
        // Map Name
        let title = data.name || data.type;
        if (BLOCK_NAME_MAP[title]) title = BLOCK_NAME_MAP[title];

        const typeLabel = data.type === 'Call' ? (data.callInfo?.blockType ? `%${data.callInfo.blockType}` : '') : '';

        // Data Attributes for Links
        let dataAttrs = `data-uid="${data.uid}"`;
        let displayName = "";
        if (data.type === 'Call' && data.callInfo?.name) {
            displayName = data.callInfo.name;
        }

        if (displayName) {
            // Find file path
            if (fileMap[displayName]) {
                dataAttrs += ` data-filepath="${fileMap[displayName]}" style="cursor: pointer;"`;
            } else {
                dataAttrs += ` data-blockname="${displayName}"`;
            }
        }

        svg += `<g transform="translate(${x}, ${y})" ${dataAttrs}>
            <rect x="0" y="0" width="${width}" height="${height}" class="block-body" />
            <rect x="0" y="0" width="${width}" height="${HEADER_HEIGHT}" class="block-header" />
            <text x="${width / 2}" y="${HEADER_HEIGHT / 2}" class="block-title">${title}</text>
            <text x="${width / 2}" y="10" class="block-type">${typeLabel}</text>
            
            ${renderPins(node.inputs, width)}
            ${renderPins(node.outputs, width)}
            
            ${renderOperandLabel(node, width)}
        </g>`;
    }
    return svg;
}

function renderPins(pins: GraphPin[], width: number) {
    return pins.map(p => {
        if (p.relX !== undefined) return '';

        const isInput = p.type === 'input';
        const xText = isInput ? 5 : width - 5;
        const xLineStart = isInput ? 0 : width;
        const xLineEnd = isInput ? -5 : width + 5;

        let decoration = '';
        if (p.isNegated) {
            decoration = `<circle cx="${isInput ? 0 : width}" cy="${p.relY}" r="3" class="pin-negated" />`;
        }

        // Boxed Label for Connected Variable
        let labelSvg = '';
        if (p.connectedVariable) {
            const labelWidth = VAR_BOX_WIDTH;
            let boxX = 0;
            let textX = 0;
            let anchor = "start";

            if (isInput) {
                // Box to left of pin
                boxX = xLineEnd - labelWidth;
                textX = xLineEnd - 5;
                anchor = "end";
            } else {
                // Box to right of pin
                boxX = xLineEnd;
                textX = boxX + 5;
                anchor = "start";
            }

            // Text Overflow Logic
            const maxChars = Math.floor(labelWidth / 7);
            let dispText = p.connectedVariable;
            if (dispText.length > maxChars) {
                dispText = dispText.substring(0, maxChars - 2) + "...";
            }

            labelSvg = `<g>
                <title>${p.connectedVariable}</title>
                <rect x="${boxX}" y="${p.relY - 10}" width="${labelWidth}" height="20" class="variable-box" />
                <text x="${textX}" y="${p.relY + 4}" class="variable-text" text-anchor="${anchor}">${dispText}</text>
             </g>`;
        }

        // Always draw the tick line
        const lineSvg = `<line x1="${xLineStart}" y1="${p.relY}" x2="${xLineEnd}" y2="${p.relY}" stroke="black" />`;

        return `<text x="${xText}" y="${p.relY}" class="pin-label ${p.type}">${p.name}</text>
                ${lineSvg}
                ${labelSvg}
                ${decoration}`;
    }).join('');
}

function renderOperandLabel(node: GraphNode, width: number) {
    if (!node.operandLabel) return '';

    // Draw centered yellow box above block 
    const textLen = node.operandLabel.length * 7;
    const boxW = Math.max(50, textLen + 10);
    const boxX = (width - boxW) / 2;

    return `<g transform="translate(0, -22)">
        <title>${node.operandLabel}</title>
        <rect x="${boxX}" y="0" width="${boxW}" height="20" class="operand-bg" />
        <text x="${width / 2}" y="14" text-anchor="middle" font-weight="bold" fill="black">${node.operandLabel}</text>
    </g>`;
}


if (import.meta.main) {
    const targetFile = Deno.args[0];
    if (!targetFile) {
        console.error("Please provide a file path.");
        Deno.exit(1);
    }
    await renderFbd(targetFile);
}
