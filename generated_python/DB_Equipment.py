from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *

class DB_Equipment(BaseBlock):
    def __init__(self, **kwargs):
        self.Station1: DotDict = DotDict({})
        self.Station2: DotDict = DotDict({})
        self.Station3: DotDict = DotDict({})
        self.SupplyStation: DotDict = DotDict({})

def run(self):
    """Executes the block logic."""
    pass
