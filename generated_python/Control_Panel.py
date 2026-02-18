from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *
from generated_python.TimeLeftCalcuation import TimeLeftCalcuation

class Control_Panel(BaseBlock):
    def __init__(self, **kwargs):
        self.xResetButton: bool = kwargs.get('xResetButton', False)
        self.xEmergencyButton: bool = kwargs.get('xEmergencyButton', False)
        self.xProcessLight: bool = kwargs.get('xProcessLight', False)
        self.diProcessTimeLeft: int = kwargs.get('diProcessTimeLeft', 0)
        self.Work_Station_DB: DotDict = kwargs.get('Work_Station_DB', DotDict({}))
        self.diProcessTime: int = 0

    def network_1(self):
        """Network 1"""
        self.xProcessLight = (True and self.Work_Station_DB.Status.xInProcess)

    def network_2(self):
        """Network 2"""
        if False:
            if not isinstance(self.UNKNOWN, TimeLeftCalcuation): self.UNKNOWN = TimeLeftCalcuation()
            self.UNKNOWN.diProcessTime_ms = self.diProcessTime
            self.UNKNOWN.diTimeDone_ms = self.Work_Station_DB.Status.diProcessTimeDone
            self.UNKNOWN.diTimeLeft_s = self.diProcessTimeLeft
            self.UNKNOWN.run()

    def network_3(self):
        """Network 3"""
        pass

    def run(self):
        """Executes the block logic."""
        self.network_1()
        self.network_2()
        self.network_3()
