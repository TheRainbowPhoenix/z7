from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *

class DB_Services(BaseBlock):
    def __init__(self, **kwargs):
        self.DataManager: DotDict = DotDict({})

    def run(self):
        """Executes the block logic."""
        pass
