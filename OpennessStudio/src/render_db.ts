
import { XMLParser } from "npm:fast-xml-parser";

interface DbMember {
    name: string;
    datatype: string;
    startValue: string;
    retain: boolean;
    accessible: boolean;
    writable: boolean;
    visible: boolean;
    setpoint: boolean;
    comment: string;
    children?: DbMember[];
}

export async function renderDb(filePath: string): Promise<string> {
    const xmlContent = await Deno.readTextFile(filePath);
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseAttributeValue: true,
        textNodeName: "#text"
    });
    const doc = parser.parse(xmlContent);

    // Navigate to Interface
    const globalDB = doc.Document["SW.Blocks.GlobalDB"];
    if (!globalDB) {
        throw new Error("Not a Global DB");
    }

    const attributeList = globalDB.AttributeList;
    const dbName = attributeList.Name;
    const dbNum = attributeList.Number;

    // Interface > Sections > Section (Static)
    let sections = attributeList.Interface.Sections.Section;
    if (!Array.isArray(sections)) sections = [sections];

    const staticSection = sections.find((s: any) => s["@_Name"] === "Static");

    const members: DbMember[] = [];
    if (staticSection && staticSection.Member) {
        parseMembers(staticSection.Member, members);
    }

    // Generate HTML
    let rows = "";
    let rowIndex = 1;

    function renderRows(items: DbMember[], level: number) {
        items.forEach(m => {
            const indent = level * 20;
            const icon = m.children ? "📂" : "🔹";

            // Checkboxes
            const chk = (val: boolean) => `<input type="checkbox" ${val ? "checked" : ""} disabled>`;

            rows += `
            <tr>
                <td>${rowIndex++}</td>
                <td style="text-align: center;">${icon}</td>
                <td style="padding-left: ${indent + 5}px;">${m.name}</td>
                <td>${m.datatype}</td>
                <td>${m.startValue}</td>
                <td class="chk">${chk(m.retain)}</td>
                <td class="chk">${chk(m.accessible)}</td>
                <td class="chk">${chk(m.writable)}</td>
                <td class="chk">${chk(m.visible)}</td>
                <td class="chk">${chk(m.setpoint)}</td>
                <td>${m.comment}</td>
            </tr>`;

            if (m.children) {
                renderRows(m.children, level + 1);
            }
        });
    }

    renderRows(members, 0);

    return `
    <div class="db-viewer">
        <h2>${dbName} [DB${dbNum}]</h2>
        <table>
            <thead>
                <tr>
                    <th width="30">#</th>
                    <th width="30"></th>
                    <th>Name</th>
                    <th>Data type</th>
                    <th>Start value</th>
                    <th width="50">Retain</th>
                    <th width="50">Accessible</th>
                    <th width="50">Writable</th>
                    <th width="50">Visible</th>
                    <th width="50">Setpoint</th>
                    <th>Comment</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    </div>
    <style>
        .db-viewer { padding: 20px; font-family: 'Segoe UI', sans-serif; color: #ccc; }
        .db-viewer h2 { margin-top: 0; color: #fff; font-size: 18px; margin-bottom: 10px; }
        .db-viewer table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .db-viewer th { text-align: left; border-bottom: 1px solid #555; padding: 5px; color: #888; font-weight: normal; }
        .db-viewer td { border-bottom: 1px solid #333; padding: 4px 5px; color: #ddd; vertical-align: middle; }
        .db-viewer tr:hover { background-color: #2a2d2e; }
        .db-viewer .chk { text-align: center; }
        .db-viewer input[type="checkbox"] { margin: 0; }
    </style>
    `;
}

function parseMembers(xmlMembers: any, list: DbMember[]) {
    if (!Array.isArray(xmlMembers)) xmlMembers = [xmlMembers];

    xmlMembers.forEach((m: any) => {
        const name = m["@_Name"];
        const datatype = m["@_Datatype"];

        let startValue = "";
        // StartValue might be text content or nested
        // In XML provided: <StartValue>T#0MS</StartValue> or default
        if (m.StartValue) {
            startValue = m.StartValue["#text"] || m.StartValue;
            if (typeof startValue !== 'string') startValue = "";
        }

        // Attributes
        let accessible = true;
        let writable = true;
        let visible = true;
        let setpoint = false;

        if (m.AttributeList && m.AttributeList.BooleanAttribute) {
            let attrs = m.AttributeList.BooleanAttribute;
            if (!Array.isArray(attrs)) attrs = [attrs];

            attrs.forEach((a: any) => {
                const n = a["@_Name"];
                const v = a["#text"] === true || a["#text"] === "true";
                if (n === "ExternalAccessible") accessible = v;
                if (n === "ExternalWritable") writable = v;
                if (n === "ExternalVisible") visible = v;
                if (n === "SetPoint") setpoint = v;
            });
        }

        const retain = m["@_Remanence"] === "Retain";

        const member: DbMember = {
            name,
            datatype: datatype.replace(/"/g, ''), // clean quotes
            startValue,
            retain,
            accessible,
            writable,
            visible,
            setpoint,
            comment: "" // Need to parse comments if available
        };

        // Recursive structuring
        // A member is a struct if it has Sections inner child
        if (m.Sections && m.Sections.Section) {
            member.children = [];
            // Usually <Section Name="None"> contains members for Structs
            let innerSections = m.Sections.Section;
            if (!Array.isArray(innerSections)) innerSections = [innerSections];

            innerSections.forEach((s: any) => {
                if (s.Member) {
                    parseMembers(s.Member, member.children!);
                }
            });
        }

        list.push(member);
    });
}
