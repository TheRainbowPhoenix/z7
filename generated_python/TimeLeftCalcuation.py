from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *

class TimeLeftCalcuation(BaseBlock):
    def __init__(self, **kwargs):
        self.diProcessTime: int = kwargs.get('diProcessTime', 0)
        self.diTimeDone: int = kwargs.get('diTimeDone', 0)
        self.diTimeLeft: int = 0

def run(self):
    self.diTimeLeft_s = (self.diProcessTime_ms - self.diTimeDone_ms) / 1000
