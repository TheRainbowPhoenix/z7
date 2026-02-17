from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *

class DownloadNewData(BaseBlock):
    def __init__(self, **kwargs):
        self.WorkStationList1: DotDict = kwargs.get('WorkStationList1', DotDict({}))
        self.WorkStationList2: DotDict = kwargs.get('WorkStationList2', DotDict({}))
        self.WorkStationList3: DotDict = kwargs.get('WorkStationList3', DotDict({}))
        self.TEMP________iCounter1: int = 0

def run(self):
    self.DB_Services.DataManager.Status.xTiaReady = True
    if self.DB_Services.DataManager.Status.xCReady:
        for self.iCounter1 in range(0, 9 + 1):
            if self.WorkStationList1[self.iCounter1] == -1:
                self.WorkStationList1[self.iCounter1] = self.DB_Services.DataManager.Status.DownloadedData[0]
                # EXIT;
                # ;
            pass
            # ;
        pass
        for self.iCounter1 in range(0, 9 + 1):
            if self.WorkStationList2[self.iCounter1] == -1:
                self.WorkStationList2[self.iCounter1] = self.DB_Services.DataManager.Status.DownloadedData[1]
                # EXIT;
                # ;
            pass
            # ;
        pass
        for self.iCounter1 in range(0, 9 + 1):
            if self.WorkStationList3[self.iCounter1] == -1:
                self.WorkStationList3[self.iCounter1] = self.DB_Services.DataManager.Status.DownloadedData[2]
                # EXIT;
                # ;
            pass
            # ;
        pass
        self.DB_Services.DataManager.Status.xTiaReady = False
        self.DB_Services.DataManager.Status.xDataTransfered = True
        self.DB_Equipment.SupplyStation.Command.xSupplyDataRequest = False
    pass
