from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *
from generated_python.DownloadNewData import DownloadNewData
from generated_python.PushDataToStation import PushDataToStation

class Sequence_Data_Management(BaseBlock):
    def __init__(self, **kwargs):
        self.WorkStationList1: DotDict = DotDict({})
        self.WorkStationList2: DotDict = DotDict({})
        self.WorkStationList3: DotDict = DotDict({})

def network_1(self):
    """Network 1"""
    if (True and self.DB_Equipment_SupplyStation_Command_xSupplyDataRequest):
        if not hasattr(self, 'UNKNOWN'): self.UNKNOWN = DownloadNewData()
        self.UNKNOWN.WorkStationList1 = self.WorkStationList1
        self.UNKNOWN.WorkStationList2 = self.WorkStationList2
        self.UNKNOWN.WorkStationList3 = self.WorkStationList3
        self.UNKNOWN.run()

def network_2(self):
    """Network 2"""
    if True:
        if not hasattr(self, 'UNKNOWN'): self.UNKNOWN = PushDataToStation()
        self.UNKNOWN.Work_Station_GD = self.DB_Equipment_Station1
        self.UNKNOWN.WorkStationList = self.WorkStationList1
        self.UNKNOWN.run()
    if True:
        if not hasattr(self, 'UNKNOWN'): self.UNKNOWN = PushDataToStation()
        self.UNKNOWN.Work_Station_GD = self.DB_Equipment_Station2
        self.UNKNOWN.WorkStationList = self.WorkStationList2
        self.UNKNOWN.run()
    if True:
        if not hasattr(self, 'UNKNOWN'): self.UNKNOWN = PushDataToStation()
        self.UNKNOWN.Work_Station_GD = self.DB_Equipment_Station3
        self.UNKNOWN.WorkStationList = self.WorkStationList3
        self.UNKNOWN.run()

def network_3(self):
    """Network 3"""
    pass

def run(self):
    """Executes the block logic."""
    self.network_1()
    self.network_2()
    self.network_3()
