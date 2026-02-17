import re

def sanitize_name(name):
    """Sanitizes variable names for Python."""
    if not name:
        return "UNKNOWN"
    # Remove quotes
    name = name.replace('"', '').replace("'", "")
    # Remove brackets for arrays/comments if they are part of the name (e.g. "diProcessTime[ms]")
    # But wait, usually brackets in SCL mean array index, but here "diProcessTime[ms]" looks like a name with unit in brackets?
    # Actually, in Siemens, identifiers can contain special chars if quoted.
    # We should sanitize properly.
    name = re.sub(r'\[.*?\]', '', name) # Remove units/indices from name for safety? Or convert to underscores?
    # Let's replace non-alphanumeric with _
    return re.sub(r'[^a-zA-Z0-9_]', '_', name).strip('_')

class SclParser:
    def __init__(self, filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            self.content = f.read()

    def parse(self):
        """Parses the SCL file."""
        data = {}

        # 1. Parse Header
        header_match = re.search(r'(FUNCTION|FUNCTION_BLOCK)\s+"(.*?)"\s*:\s*(.*?)\s', self.content)
        if header_match:
            data['block_type'] = header_match.group(1)
            data['name'] = header_match.group(2)
            data['return_type'] = header_match.group(3)
        else:
            # Maybe without quotes?
            header_match = re.search(r'(FUNCTION|FUNCTION_BLOCK)\s+(\w+)\s*:\s*(\w+)\s', self.content)
            if header_match:
                data['block_type'] = header_match.group(1)
                data['name'] = header_match.group(2)
                data['return_type'] = header_match.group(3)

        # 2. Parse Variables
        data['interface'] = self._parse_vars()

        # 3. Parse Body
        body_match = re.search(r'BEGIN(.*?)END_(FUNCTION|FUNCTION_BLOCK)', self.content, re.DOTALL)
        if body_match:
            data['body'] = body_match.group(1).strip()
        else:
            data['body'] = ""

        return data

    def _parse_vars(self):
        """Parses variable blocks."""
        interface = {}
        # Find all VAR blocks
        var_blocks = re.findall(r'(VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|VAR|VAR_TEMP|VAR_CONSTANT)(.*?)(END_VAR)', self.content, re.DOTALL)

        for block_type, content, _ in var_blocks:
            # Map SCL var types to our standard names
            section_name = {
                'VAR_INPUT': 'Input',
                'VAR_OUTPUT': 'Output',
                'VAR_IN_OUT': 'InOut',
                'VAR': 'Static',
                'VAR_TEMP': 'Temp',
                'VAR_CONSTANT': 'Constant'
            }.get(block_type, 'Unknown')

            vars = []
            # Parse individual lines: "name" : Type; or name : Type;
            lines = content.strip().split(';')
            for line in lines:
                line = line.strip()
                if not line or line.startswith('//'):
                    continue

                parts = line.split(':')
                if len(parts) >= 2:
                    name_part = parts[0].strip()
                    type_part = parts[1].strip()
                    # Handle comments after type?

                    var_name = name_part
                    if var_name.startswith('"') and var_name.endswith('"'):
                         var_name = var_name[1:-1]

                    vars.append({
                        "name": sanitize_name(var_name),
                        "type": type_part,
                        "original_name": var_name
                    })

            if section_name not in interface:
                interface[section_name] = []
            interface[section_name].extend(vars)

        return interface

if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) > 1:
        parser = SclParser(sys.argv[1])
        data = parser.parse()
        print(json.dumps(data, indent=2))
