import xml.etree.ElementTree as ET
import re
import json

def sanitize_name(name):
    if not name: return "UNKNOWN"
    return re.sub(r'[^a-zA-Z0-9_]', '_', name)

class LadParser:
    def __init__(self, filepath):
        self.filepath = filepath
        self.tree = ET.parse(filepath)
        self.root = self.tree.getroot()
        self.ns_interface = '{http://www.siemens.com/automation/Openness/SW/Interface/v4}'
        self.ns_flgnet = '{http://www.siemens.com/automation/Openness/SW/NetworkSource/FlgNet/v4}'

    def get_block_node(self):
        for child in self.root:
            if child.tag.startswith("SW.Blocks."):
                return child
        return None

    def parse_interface(self):
        interface = {}
        block_node = self.get_block_node()
        if block_node is None: return {}

        attr_list = block_node.find("AttributeList")
        if attr_list is None: return {}

        interface_node = attr_list.find("Interface")
        if interface_node is None: return {}

        sections_node = interface_node.find(f"{self.ns_interface}Sections")
        if sections_node is None: return {}

        for section in sections_node:
            section_name = section.get("Name")
            vars = []
            for member in section:
                var_name = member.get("Name")
                datatype = member.get("Datatype")
                vars.append({"name": sanitize_name(var_name), "type": datatype, "original_name": var_name})
            interface[section_name] = vars

        return interface

    def parse_networks(self):
        networks = []
        block_node = self.get_block_node()
        if block_node is None: return []

        object_list = block_node.find("ObjectList")
        if object_list is None: return []

        for child in object_list:
            if child.tag == "SW.Blocks.CompileUnit":
                network_data = self._parse_compile_unit(child)
                if network_data:
                    networks.append(network_data)
        return networks

    def _parse_compile_unit(self, unit_node):
        attr_list = unit_node.find("AttributeList")
        if attr_list is None: return None
        network_source = attr_list.find("NetworkSource")
        if network_source is None: return None

        flg_net = network_source.find(f"{self.ns_flgnet}FlgNet")
        parts = []
        wires = []

        if flg_net is not None:
            parts_node = flg_net.find(f"{self.ns_flgnet}Parts")
            if parts_node is not None:
                for part in parts_node:
                    p = self._parse_part(part)
                    parts.append(p)

            wires_node = flg_net.find(f"{self.ns_flgnet}Wires")
            if wires_node is not None:
                for wire in wires_node:
                    w = self._parse_wire(wire)
                    wires.append(w)
            return {"type": "LAD", "parts": parts, "wires": wires}
        return {"type": "UNKNOWN", "parts": [], "wires": []}

    def _parse_part(self, part_node):
        uid = part_node.get("UId")
        tag = part_node.tag.replace(self.ns_flgnet, "")
        name = part_node.get("Name")

        part_data = {"uid": uid, "type": tag, "name": name}

        if tag == "Part":
            part_data["type"] = name # Override type with Name (Contact, Coil, etc.)

        if tag == "Access":
            symbol = part_node.find(f"{self.ns_flgnet}Symbol")
            if symbol is not None:
                components = symbol.findall(f"{self.ns_flgnet}Component")
                full_name = ".".join([c.get("Name") for c in components])
                part_data["variable"] = sanitize_name(full_name)
                part_data["original_variable"] = full_name

        elif tag == "Call":
            call_info = part_node.find(f"{self.ns_flgnet}CallInfo")
            if call_info is not None:
                part_data["call_name"] = call_info.get("Name")
                part_data["block_type"] = call_info.get("BlockType")
                params = []
                for param in call_info.findall(f"{self.ns_flgnet}Parameter"):
                    params.append({
                        "name": param.get("Name"),
                        "section": param.get("Section"),
                        "type": param.get("Type")
                    })
                part_data["parameters"] = params
                instance = call_info.find(f"{self.ns_flgnet}Instance")
                if instance is not None:
                    comp = instance.find(f"{self.ns_flgnet}Component")
                    if comp is not None:
                        part_data["instance"] = sanitize_name(comp.get("Name"))

        elif tag in ["Contact", "Coil", "SCoil", "RCoil", "PContact", "NContact"] or part_data["type"] in ["Contact", "Coil", "SCoil", "RCoil", "PContact", "NContact"]:
             negated = part_node.find(f"{self.ns_flgnet}Negated")
             part_data["negated"] = (negated is not None)

        return part_data

    def _parse_wire(self, wire_node):
        uid = wire_node.get("UId")
        connections = []
        for child in wire_node:
            tag = child.tag.replace(self.ns_flgnet, "")
            con_uid = child.get("UId")
            con_name = child.get("Name")
            connections.append({"type": tag, "uid": con_uid, "name": con_name})
        return {"uid": uid, "connections": connections}
