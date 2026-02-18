export enum BlockType {
    Folder = "Folder",
    OB = "OB",
    FB = "FB",
    FC = "FC",
    DB = "DB",
    UDT = "UDT",
    Unknown = "Unknown",
}

export interface NetworkComponent {
    name: string;
    accessModifier?: string;
    accessModifierPos?: number;
}

export interface NetworkSymbol {
    components: NetworkComponent[];
}

export interface NetworkParameter {
    name: string;
    section: string;
    type: string;
}

export interface NetworkCallInfo {
    name: string;
    blockType: string;
    parameters: NetworkParameter[];
    instanceName?: string;
    instanceScope?: string;
    instanceDbNumber?: number;
}

export interface NetworkPart {
    uid: string;
    name?: string; // For parts and calls
    type: "Part" | "Call" | "Access" | "Coil";

    // For Access
    scope?: string;
    symbol?: NetworkSymbol;

    // For Call
    callInfo?: NetworkCallInfo;

    // For Part (Standard)
    templateValue?: {
        name: string;
        type: string;
        value: any;
    }[];
    negated?: string[]; // Names of negated pins
}

export interface Connection {
    type: "Powerrail" | "NameCon" | "IdentCon" | "OpenCon";
    uid?: string;
    name?: string; // For NameCon
}

export interface NetworkWire {
    uid: string;
    connections: Connection[];
}

export interface Network {
    parts: NetworkPart[];
    wires: NetworkWire[];
    title?: string;
    comment?: string;
}

export interface InterfaceMember {
    name: string;
    datatype: string;
    defaultValue?: string;
    comment?: string;
    children?: InterfaceMember[];
}

export interface InterfaceSection {
    name: string;
    members: InterfaceMember[];
}

export interface BlockInterface {
    sections: InterfaceSection[];
}

export interface OpennessNode {
    name: string; // File or folder name
    blockName?: string; // Internal name from XML
    type: BlockType;
    number?: number; // e.g., 1 for OB1, 2 for FB2
    path: string;
    children?: OpennessNode[];
    interface?: BlockInterface;
    networks?: Network[];
    xmlContent?: any; // Raw parsed content for debugging/details
}
