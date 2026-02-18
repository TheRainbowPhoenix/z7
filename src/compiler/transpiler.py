import textwrap
import re

def sanitize_identifier(name):
    """Sanitizes names for Python identifiers (classes, methods, variable definitions)."""
    if not name: return "UNKNOWN"
    return re.sub(r'[^a-zA-Z0-9_]', '_', name).strip('_')

def sanitize_variable_name(name):
    """Sanitizes names for variable access (allows dots)."""
    if not name: return "UNKNOWN"
    name = name.replace('"', '').replace("'", "")
    # Allow dots for member access
    return re.sub(r'[^a-zA-Z0-9_.]', '_', name).strip('_')

class Transpiler:
    def __init__(self, block_data, block_name):
        self.block_data = block_data
        self.block_name = sanitize_identifier(block_name)
        self.imports = set()
        self.methods = []
        self.init_lines = []
        self.class_code = ""

    def generate(self):
        self._generate_imports()
        self._generate_init()
        self._generate_networks()
        self._generate_run_method()

        full_code = "from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time\n"
        full_code += "from src.runtime.std import *\n"
        if self.imports:
            full_code += "\n".join(sorted(list(self.imports))) + "\n"

        code = f"class {self.block_name}(BaseBlock):\n"
        code += self._indent("\n".join(self.init_lines), 1) + "\n\n"
        code += self._indent("\n\n".join(self.methods), 1) + "\n"

        return full_code + "\n" + code

    def _indent(self, text, level):
        indent_str = "    " * level
        return "\n".join([indent_str + line if line.strip() else line for line in text.split('\n')])

    def _generate_imports(self):
        networks = self.block_data.get('networks', [])
        for net in networks:
            if net.get('type') == 'LAD':
                for part in net.get('parts', []):
                    if part.get('type') == 'Call':
                        call_name = part.get('call_name')
                        if call_name:
                            import_name = sanitize_identifier(call_name)
                            if import_name != self.block_name:
                                self.imports.add(f"from generated_python.{import_name} import {import_name}")

    def _generate_init(self):
        lines = ["def __init__(self, **kwargs):"]
        interface = self.block_data.get('interface', {})

        def get_default(type_):
            if type_ == 'Bool': return "False"
            if type_ in ['Int', 'DInt', 'UInt', 'USInt', 'SInt', 'UDInt']: return "0"
            if type_ in ['Real', 'LReal']: return "0.0"
            if type_ == 'String': return '""'
            if type_ == 'Time': return "0"
            return "DotDict({})"

        def get_py_type(type_):
            if type_ == 'Bool': return "bool"
            if type_ in ['Int', 'DInt', 'UInt', 'USInt', 'SInt', 'UDInt']: return "int"
            if type_ in ['Real', 'LReal']: return "float"
            if type_ == 'String': return "str"
            return "DotDict"

        for section, vars in interface.items():
            for var in vars:
                name = sanitize_identifier(var['name'])
                default = get_default(var['type'])
                py_type = get_py_type(var['type'])
                if section in ['Input', 'InOut']:
                    lines.append(f"    self.{name}: {py_type} = kwargs.get('{name}', {default})")
                else:
                    lines.append(f"    self.{name}: {py_type} = {default}")

        if len(lines) == 1: lines.append("    pass")
        self.init_lines = lines

    def _generate_networks(self):
        networks = self.block_data.get('networks', [])
        for i, net in enumerate(networks):
            method_name = f"network_{i+1}"
            lines = [f"def {method_name}(self):"]
            lines.append(f'    """Network {i+1}"""')

            if net.get('type') == 'LAD':
                code_lines = self._transpile_lad_network(net)
                if code_lines:
                    lines.extend([f"    {l}" for l in code_lines])
                else:
                    lines.append("    pass")
            elif net.get('type') == 'SCL':
                 pass
            else:
                 lines.append("    pass")
            self.methods.append("\n".join(lines))

        if 'body' in self.block_data and self.block_data['body']:
             self._transpile_scl_body()

    def _transpile_lad_network(self, net):
        parts = net.get('parts', [])
        wires = net.get('wires', [])
        uid_to_part = {p['uid']: p for p in parts}
        lines = []

        def get_variable(uid, pin_name):
            for w in wires:
                for c in w['connections']:
                    if c['uid'] == uid and c['name'] == pin_name:
                        for c2 in w['connections']:
                            if c2['type'] == 'IdentCon':
                                part = uid_to_part.get(c2['uid'])
                                if part and part.get('variable'):
                                    return sanitize_variable_name(part['variable'])
            return None

        def get_logic(uid, pin_name, visited=None):
            if visited is None: visited = set()
            if (uid, pin_name) in visited: return "False"
            visited.add((uid, pin_name))

            relevant_wires = []
            for w in wires:
                for c in w['connections']:
                    if c['uid'] == uid and c['name'] == pin_name:
                        relevant_wires.append(w)
                        break

            if not relevant_wires: return "False"

            sources = []
            for w in relevant_wires:
                if any(c['type'] == 'Powerrail' for c in w['connections']):
                    return "True"

                for c in w['connections']:
                    if c['uid'] == uid and c['name'] == pin_name: continue

                    if c['type'] == 'NameCon':
                        part = uid_to_part.get(c['uid'])
                        if part:
                            if c['name'] in ['out', 'eno']:
                                if part['type'] in ['Contact', 'NContact']:
                                    prev_logic = get_logic(part['uid'], 'in', visited.copy())
                                    var = get_variable(part['uid'], 'operand') or "UNKNOWN"
                                    op = f"self.{var}"
                                    if part.get('negated'): op = f"(not {op})"
                                    sources.append(f"({prev_logic} and {op})")
                                elif part['type'] in ['PContact']:
                                    prev_logic = get_logic(part['uid'], 'pre', visited.copy())
                                    var = get_variable(part['uid'], 'operand') or "UNKNOWN"
                                    sources.append(f"({prev_logic} and self.{var})")
                                elif part['type'] == 'Call':
                                    sources.append(get_logic(part['uid'], 'en', visited.copy()))

            if not sources: return "False"
            if len(sources) == 1: return sources[0]
            return f"({' or '.join(sources)})"

        for part in parts:
            if part['type'] == 'Call':
                en_logic = get_logic(part['uid'], 'en')
                call_name = sanitize_identifier(part.get('call_name', 'Unknown'))
                instance = sanitize_variable_name(part.get('instance', ''))

                params = []
                for p in part.get('parameters', []):
                    p_name = sanitize_identifier(p['name'])
                    var = get_variable(part['uid'], p['name'])
                    if var:
                        params.append(f"{p_name}=self.{var}")

                param_str = ", ".join(params)

                lines.append(f"if {en_logic}:")
                if instance:
                    lines.append(f"    if not isinstance(self.{instance}, {call_name}): self.{instance} = {call_name}()")
                    for p in params:
                        k, v = p.split('=', 1)
                        lines.append(f"    self.{instance}.{k} = {v}")
                    lines.append(f"    self.{instance}.run()")
                else:
                    lines.append(f"    {call_name}({param_str})")

        for part in parts:
            if part['type'] in ['Coil', 'SCoil', 'RCoil']:
                logic = get_logic(part['uid'], 'in')
                var = get_variable(part['uid'], 'operand') or sanitize_variable_name(part.get('variable', 'Unknown'))

                if part['type'] == 'Coil':
                    if part.get('negated'):
                        lines.append(f"self.{var} = not ({logic})")
                    else:
                        lines.append(f"self.{var} = {logic}")
                elif part['type'] == 'SCoil':
                    lines.append(f"if {logic}: self.{var} = True")
                elif part['type'] == 'RCoil':
                    lines.append(f"if {logic}: self.{var} = False")

        return lines

    def _transpile_scl_body(self):
        body = self.block_data['body']
        lines = ["def run(self):"]

        processed_body = body.replace(';', ';\n')
        keywords = ['IF', 'ELSE', 'ELSIF', 'END_IF', 'FOR', 'END_FOR', 'CASE', 'END_CASE', 'WHILE', 'END_WHILE']
        for kw in keywords:
            processed_body = re.sub(r'\b' + kw + r'\b', f'\n{kw} ', processed_body)

        indent = 1
        source_lines = processed_body.splitlines()

        for line in source_lines:
            line = line.strip()
            if not line or line.startswith('//'): continue

            if '//' in line:
                line = line.split('//')[0].strip()

            if line.startswith('IF '):
                if 'THEN' in line:
                    cond = line[3:line.find('THEN')].strip()
                    cond = self._scl_repl(cond).replace('=', '==').replace(':=', '==')
                    lines.append(f"{'    '*indent}if {cond}:")
                    indent += 1
                else:
                    lines.append(f"{'    '*indent}# Unhandled IF format: {line}")

            elif line.startswith('ELSIF '):
                indent = max(1, indent - 1)
                if 'THEN' in line:
                    cond = line[6:line.find('THEN')].strip()
                    cond = self._scl_repl(cond).replace('=', '==')
                    lines.append(f"{'    '*indent}elif {cond}:")
                    indent += 1
                else:
                    lines.append(f"{'    '*indent}elif True: # Unhandled ELSIF")

            elif line.startswith('ELSE'):
                indent = max(1, indent - 1)
                lines.append(f"{'    '*indent}else:")
                indent += 1

            elif line.startswith('END_IF'):
                indent = max(1, indent - 1)
                if indent < 1: indent = 1
                lines.append(f"{'    '*indent}pass")

            elif line.startswith('FOR ') and 'TO' in line:
                 try:
                     var_assign = line[3:line.find('TO')].strip()
                     if ':=' in var_assign:
                         var, start = var_assign.split(':=')
                         var = self._scl_repl(var.strip())
                         start = start.strip()
                         end_part = line[line.find('TO')+2:]
                         if 'DO' in end_part:
                             end = end_part[:end_part.find('DO')].strip()
                         else:
                             end = end_part.strip()
                         lines.append(f"{'    '*indent}for {var} in range({start}, {end} + 1):")
                         indent += 1
                 except:
                     lines.append(f"{'    '*indent}# Failed parsing FOR: {line}")

            elif line.startswith('END_FOR'):
                indent = max(1, indent - 1)
                lines.append(f"{'    '*indent}pass")

            elif ':=' in line:
                parts = line.split(':=', 1)
                lhs = self._scl_repl(parts[0].strip())
                rhs = self._scl_repl(parts[1].strip().rstrip(';'))
                lines.append(f"{'    '*indent}{lhs} = {rhs}")

            elif line == 'EXIT;' or line == 'EXIT':
                lines.append(f"{'    '*indent}break")

            else:
                lines.append(f"{'    '*indent}# {line}")

        self.methods.append("\n".join(lines))

    def _scl_repl(self, text):
        text = re.sub(r'\bTRUE\b', 'True', text, flags=re.IGNORECASE)
        text = re.sub(r'\bFALSE\b', 'False', text, flags=re.IGNORECASE)

        # SCL var access can be Complex.Path
        # Regex to find identifiers starting with # or quoted

        def replace_var(match):
            # Extract name, remove quotes/hash
            raw = match.group(1) or match.group(2)
            return "self." + sanitize_variable_name(raw)

        text = re.sub(r'#"([^"]+)"', replace_var, text)
        text = re.sub(r'#([a-zA-Z0-9_]+)', replace_var, text)
        text = re.sub(r'"([^"]+)"', replace_var, text)

        return text

    def _generate_run_method(self):
        if any("def run(self):" in m for m in self.methods): return
        lines = ["def run(self):", '    """Executes the block logic."""']
        if self.block_data.get('networks'):
            for i in range(len(self.block_data['networks'])):
                lines.append(f"    self.network_{i+1}()")
        if len(lines) == 2: lines.append("    pass")
        self.methods.append("\n".join(lines))
