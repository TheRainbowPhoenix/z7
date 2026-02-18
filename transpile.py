import os
import sys
import glob

# Add src to path
sys.path.append(os.path.join(os.getcwd(), 'src'))

from compiler.lad_parser import LadParser
from compiler.scl_parser import SclParser
from compiler.transpiler import Transpiler, sanitize_identifier

INPUT_DIR = "extracted_plc"
OUTPUT_DIR = "generated_python"

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # Create __init__.py in output dir
    with open(os.path.join(OUTPUT_DIR, "__init__.py"), "w") as f:
        f.write("# Generated Python Code\n")

    files_processed = 0

    # 1. Find all XML files (LAD Blocks)
    xml_files = glob.glob(os.path.join(INPUT_DIR, "**", "*.xml"), recursive=True)
    for filepath in xml_files:
        # Skip tags/types for now, focus on Program blocks
        if "Program blocks" not in filepath:
            continue

        print(f"Processing XML: {filepath}")
        try:
            parser = LadParser(filepath)
            # Check if it's a block we can parse
            block_node = parser.get_block_node()
            if block_node is None:
                print(f"  Skipping (not a supported block type)")
                continue

            # Extract name
            name_node = block_node.find("AttributeList/Name")
            block_name = name_node.text if name_node is not None else "Unknown"

            interface = parser.parse_interface()
            networks = parser.parse_networks()

            block_data = {
                'interface': interface,
                'networks': networks
            }

            transpiler = Transpiler(block_data, block_name)
            code = transpiler.generate()

            out_name = sanitize_identifier(block_name)
            out_path = os.path.join(OUTPUT_DIR, f"{out_name}.py")
            with open(out_path, "w") as f:
                f.write(code)

            files_processed += 1

        except Exception as e:
            print(f"  Error processing {filepath}: {e}")
            # import traceback
            # traceback.print_exc()

    # 2. Find all SCL files
    scl_files = glob.glob(os.path.join(INPUT_DIR, "**", "*.scl"), recursive=True)
    for filepath in scl_files:
        print(f"Processing SCL: {filepath}")
        try:
            parser = SclParser(filepath)
            block_data = parser.parse()

            if 'name' not in block_data:
                print(f"  Skipping (could not parse name)")
                continue

            transpiler = Transpiler(block_data, block_data['name'])
            code = transpiler.generate()

            out_name = sanitize_identifier(block_data['name'])
            out_path = os.path.join(OUTPUT_DIR, f"{out_name}.py")
            with open(out_path, "w") as f:
                f.write(code)

            files_processed += 1

        except Exception as e:
            print(f"  Error processing {filepath}: {e}")

    print(f"Done. Processed {files_processed} files.")

if __name__ == "__main__":
    main()
