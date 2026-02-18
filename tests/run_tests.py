import sys
from tests.test_functions import test_ladder_instructions

if __name__ == "__main__":
    if test_ladder_instructions():
        sys.exit(0)
    else:
        sys.exit(1)
