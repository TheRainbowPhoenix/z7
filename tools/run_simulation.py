import sys
import os

# Add root to path
sys.path.append(os.getcwd())

from generated_python.Main import Main
from src.runtime import DotDict

def run_simulation():
    print("Initializing Main (OB1)...")
    main = Main()

    # Initialize Inputs
    # Sensors for Station 1
    main.iIO_xS1EntrySensor = False
    main.iIO_xS1ExitSensor = False
    main.iIO_xS1PositionerSensor = False
    main.iIO_xSupplyExitSensor = False
    main.iIO_xS1ClampSensor = False

    main.qIO_xS1Conveyor1 = False

    print("Starting Simulation (5 Cycles)...")

    for cycle in range(1, 6):
        print(f"\n--- Cycle {cycle} ---")

        if cycle == 2:
            print("Action: Material detected at Station 1 Entry")
            main.iIO_xS1EntrySensor = True
        elif cycle == 3:
            print("Action: Material clears Station 1 Entry")
            main.iIO_xS1EntrySensor = False
            main.iIO_xSupplyExitSensor = True

        main.run()

        if hasattr(main, 'Work_Station1_DB'):
            ws1 = main.Work_Station1_DB
            print(f"Work Station 1 Entry Sensor (Internal): {ws1.xEntrySensor}")
            print(f"Work Station 1 Conveyor 1 Cmd (Internal): {ws1.xConveyor1}")
            if hasattr(ws1, 'StationConveyorControl_Instance'):
                conveyor_ctrl = ws1.StationConveyorControl_Instance
                print(f"Station 1 Material At Positioner (Internal): {conveyor_ctrl.xMaterialAtPositioner}")
        else:
            print("Work Station 1 DB not initialized yet.")

if __name__ == "__main__":
    run_simulation()
