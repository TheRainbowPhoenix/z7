from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *

class PushDataToStation(BaseBlock):
    def __init__(self, **kwargs):
        self.Work_Station_GD: DotDict = kwargs.get('Work_Station_GD', DotDict({}))
        self.WorkStationList: DotDict = kwargs.get('WorkStationList', DotDict({}))
        self.TEMP________iArrayLength: int = 0
        self.iTemp: int = 0
        self.iCounter: int = 0

def run(self):
    if self.Work_Station_GD.Command.xRequestData:
        self.Work_Station_GD.Status.tProcessTime = DINT_TO_TIME(self.WorkStationList[0] * 1000)
        self.Work_Station_GD.Command.xRequestData = False
        for self.iCounter in range(0, 8 + 1):
            self.WorkStationList[self.iCounter] = self.WorkStationList[self.iCounter + 1]
            # ;
        pass
        # ;
    pass
