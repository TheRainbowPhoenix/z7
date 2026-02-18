from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *

class StationConveyorControl(BaseBlock):
    def __init__(self, **kwargs):
        self.xEntrySensor: bool = kwargs.get('xEntrySensor', False)
        self.xExitSensor: bool = kwargs.get('xExitSensor', False)
        self.xPositionerSensor: bool = kwargs.get('xPositionerSensor', False)
        self.xQueueSensor: bool = kwargs.get('xQueueSensor', False)
        self.xInProcess: bool = kwargs.get('xInProcess', False)
        self.xConveyor1: bool = kwargs.get('xConveyor1', False)
        self.xConveyor2: bool = kwargs.get('xConveyor2', False)
        self.xConveyor3: bool = kwargs.get('xConveyor3', False)
        self.xMaterialAtExit: bool = False
        self.xMaterialAtPositioner: bool = False
        self.xProcessDone: bool = False
        self.xEdgeMemory1: bool = False
        self.xEdgeMemory2: bool = False
        self.xEdgeMemory3: bool = False
        self.xEdgeMemory4: bool = False
        self.xEdgeMemory5: bool = False

    def network_1(self):
        """Network 1"""
        if ((True and (not self.xEntrySensor)) and self.xQueueSensor): self.xConveyor1 = True
        if ((True and self.xEntrySensor) and self.xMaterialAtPositioner): self.xConveyor1 = False
        if ((True and self.xEntrySensor) and (not self.xMaterialAtPositioner)): self.xConveyor2 = True
        if ((True and self.xEntrySensor) and (not self.xMaterialAtPositioner)): self.xConveyor1 = True
        if ((True and self.xEntrySensor) and (not self.xMaterialAtPositioner)): self.xMaterialAtPositioner = True

    def network_2(self):
        """Network 2"""
        if (True and self.xPositionerSensor): self.xConveyor2 = False

    def network_3(self):
        """Network 3"""
        if (False and self.xInProcess): self.xProcessDone = True
        if ((True and self.xProcessDone) and (not self.xMaterialAtExit)): self.xConveyor2 = True
        if ((True and self.xProcessDone) and (not self.xMaterialAtExit)): self.xConveyor3 = True
        if (True and self.xExitSensor): self.xProcessDone = False
        if (True and self.xExitSensor): self.xMaterialAtPositioner = False
        if (True and self.xExitSensor): self.xConveyor3 = False
        if (True and self.xExitSensor): self.xMaterialAtExit = True
        if (False and self.xExitSensor): self.xMaterialAtExit = False

    def network_4(self):
        """Network 4"""
        pass

    def run(self):
        """Executes the block logic."""
        self.network_1()
        self.network_2()
        self.network_3()
        self.network_4()
