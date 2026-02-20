from ladderlad.engine import LadderEngine

def demo_plcopen():
    schematic = (
        "||--[START]--[/STOP]--(RUN)--||\n" +
        "||                           ||\n" +
        "||--[RUN]--{TON T1 5s}--(Q)--||"
    )

    engine = LadderEngine()
    instructions = engine.compile(schematic)

    print("Instructions:")
    print(instructions)

    print("\nPLCopen XML:")
    try:
        xml_out = engine.export_plcopen(instructions)
        print(xml_out)

        with open("demo_export.xml", "w") as f:
            f.write(xml_out)
        print("\nExported to demo_export.xml")
    except Exception as e:
        print(f"Export failed: {e}")

if __name__ == "__main__":
    demo_plcopen()
