from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *

class StationProcessControl(BaseBlock):
    def __init__(self, **kwargs):
        self.xPositionerSensor: bool = kwargs.get('xPositionerSensor', False)
        self.xClampSensor: bool = kwargs.get('xClampSensor', False)
        self.tProcessTime: DotDict = kwargs.get('tProcessTime', 0)
        self.xPositionerClamp: bool = kwargs.get('xPositionerClamp', False)
        self.xPositionerRaise: bool = kwargs.get('xPositionerRaise', False)
        self.xInProcess: bool = kwargs.get('xInProcess', False)
        self.diProcessTimeLeft: int = kwargs.get('diProcessTimeLeft', 0)
        self.xRequestData: bool = kwargs.get('xRequestData', False)
        self.xProcessDone: bool = False
        self.xEdgeMemory1: bool = False
        self.xEdgeMemory2: bool = False
        self.IEC_Timer_0_Instance: DotDict = DotDict({})

    def network_1(self):
        """Network 1"""
        if (True and self.xPositionerSensor): self.xPositionerClamp = True
        if (True and self.xPositionerSensor): self.xRequestData = True
        if (True and self.xClampSensor): self.xInProcess = True

    def network_2(self):
        """Network 2"""
        if False: self.xPositionerClamp = False
        if False: self.xProcessDone = True
        if (True and self.xProcessDone): self.xPositionerRaise = True
        if (True and self.xProcessDone): self.xInProcess = False
        if (True and self.xProcessDone): self.xProcessDone = False

    def network_3(self):
        """Network 3"""
        if (False and self.xPositionerSensor): self.xPositionerRaise = False

    def network_4(self):
        """Network 4"""
        pass

    def run(self):
        """Executes the block logic."""
        self.network_1()
        self.network_2()
        self.network_3()
        self.network_4()
