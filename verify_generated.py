import sys
import os

# Add root to path so generated_python is accessible
sys.path.append(os.getcwd())

try:
    from generated_python.Main import Main
    print("Successfully imported Main.")

    # Instantiate Main
    main_ob = Main()
    print("Successfully instantiated Main.")

    # Run one cycle
    main_ob.run()
    print("Successfully executed Main.run().")

except Exception as e:
    print(f"Verification failed: {e}")
    import traceback
    traceback.print_exc()
