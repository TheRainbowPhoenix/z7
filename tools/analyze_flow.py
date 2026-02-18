import sys
import os
import glob
import re

# Add src to path
sys.path.append(os.path.join(os.getcwd(), 'src'))

from compiler.lad_parser import LadParser

INPUT_DIR = "extracted_plc"

def find_file(block_name):
    # Search for XML
    files = glob.glob(os.path.join(INPUT_DIR, "**", f"{block_name}.xml"), recursive=True)
    if files: return files[0]
    # Search for SCL
    files = glob.glob(os.path.join(INPUT_DIR, "**", f"{block_name}.scl"), recursive=True)
    if files: return files[0]
    return None

def analyze_block(block_name, indent=0, visited=None):
    if visited is None: visited = set()

    prefix = "  " * indent
    if block_name in visited:
        print(f"{prefix}-> {block_name} (Recursion)")
        return
    visited.add(block_name)

    filepath = find_file(block_name)
    if not filepath:
        print(f"{prefix}-> {block_name} (Not found/Built-in)")
        return

    print(f"{prefix}-> {block_name} ({'SCL' if filepath.endswith('.scl') else 'LAD'})")

    try:
        if filepath.endswith('.xml'):
            parser = LadParser(filepath)
            networks = parser.parse_networks()
            interface = parser.parse_interface()

            # List State Variables
            states = []
            for sec in ['Static', 'InOut']:
                if sec in interface:
                    for v in interface[sec]:
                        states.append(v['name'])

            if states:
                print(f"{prefix}   State: {', '.join(states[:5])}{'...' if len(states)>5 else ''}")

            # Find calls
            calls = set()
            for net in networks:
                parts = net.get('parts', [])
                for p in parts:
                    if p.get('type') == 'Call':
                        cname = p.get('call_name')
                        if cname: calls.add(cname)

            for c in sorted(list(calls)):
                analyze_block(c, indent + 1, visited.copy())

        else:
             # SCL
             # Need to use SCL parser to find calls?
             # My SCL parser is basic regex.
             pass

    except Exception as e:
        print(f"{prefix}   Error analyzing: {e}")

if __name__ == "__main__":
    print("Static Flow Analysis (Call Graph):")
    analyze_block("Main")
