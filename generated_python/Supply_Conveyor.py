from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *

class Supply_Conveyor(BaseBlock):
    def __init__(self, **kwargs):
        self.xMaterialOnConveyor: bool = False
        self.xEdgeMemory1: bool = False
        self.xEdgeMemory2: bool = False
        self.xEdgeMemory3: bool = False

def network_1(self):
    """Network 1"""
    if (False and self.xMaterialOnConveyor): self.DB_Equipment_SupplyStation_Command_xSupplyDataRequest = True
    if (False and self.DB_Equipment_SupplyStation_Command_xSupplyDataRequest): self.qIO_xSupplyGetMaterial = True
    if (True and self.iIO_xSupplyEntrySensor): self.xMaterialOnConveyor = True
    if (True and self.iIO_xSupplyEntrySensor): self.qIO_xSupplyGetMaterial = False

def network_2(self):
    """Network 2"""
    if ((True and self.iIO_xSupplyEntrySensor) and (not self.iIO_xSupplyExitSensor)): self.qIO_xSupplyConveyor1 = True
    if ((True and self.iIO_xSupplyEntrySensor) and (not self.iIO_xSupplyExitSensor)): self.qIO_xSupplyConveyor2 = True
    if (True and self.iIO_xSupplyExitSensor): self.qIO_xSupplyConveyor1 = False
    if (True and self.iIO_xSupplyExitSensor): self.qIO_xSupplyConveyor2 = False
    if (True and self.iIO_xSupplyExitSensor): self.xMaterialOnConveyor = False
    if ((True and self.iIO_xSupplyExitSensor) and (not self.iIO_xS1EntrySensor)): self.qIO_xSupplyConveyor2 = True

def run(self):
    """Executes the block logic."""
    self.network_1()
    self.network_2()
