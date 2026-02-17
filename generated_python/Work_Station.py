from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *
from generated_python.StationConveyorControl import StationConveyorControl
from generated_python.StationProcessControl import StationProcessControl

class Work_Station(BaseBlock):
    def __init__(self, **kwargs):
        self.xEntrySensor: bool = kwargs.get('xEntrySensor', False)
        self.xExitSensor: bool = kwargs.get('xExitSensor', False)
        self.xPositionerSensor: bool = kwargs.get('xPositionerSensor', False)
        self.xQueueSensor: bool = kwargs.get('xQueueSensor', False)
        self.xClampSensor: bool = kwargs.get('xClampSensor', False)
        self.xConveyor1: bool = kwargs.get('xConveyor1', False)
        self.xConveyor2: bool = kwargs.get('xConveyor2', False)
        self.xConveyor3: bool = kwargs.get('xConveyor3', False)
        self.xPositionerClamp: bool = kwargs.get('xPositionerClamp', False)
        self.xPositionerRaise: bool = kwargs.get('xPositionerRaise', False)
        self.Work_Station_DB: DotDict = kwargs.get('Work_Station_DB', DotDict({}))
        self.StationConveyorControl_Instance: DotDict = DotDict({})
        self.StationProcessControl_Instance: DotDict = DotDict({})

def network_1(self):
    """Network 1"""
    pass

def network_2(self):
    """Network 2"""
    if True:
        if not hasattr(self, 'StationConveyorControl_Instance'): self.StationConveyorControl_Instance = StationConveyorControl()
        self.StationConveyorControl_Instance.xEntrySensor = self.xEntrySensor
        self.StationConveyorControl_Instance.xExitSensor = self.xExitSensor
        self.StationConveyorControl_Instance.xPositionerSensor = self.xPositionerSensor
        self.StationConveyorControl_Instance.xQueueSensor = self.xQueueSensor
        self.StationConveyorControl_Instance.xInProcess = self.Work_Station_DB_Status_xInProcess
        self.StationConveyorControl_Instance.xConveyor1 = self.xConveyor1
        self.StationConveyorControl_Instance.xConveyor2 = self.xConveyor2
        self.StationConveyorControl_Instance.xConveyor3 = self.xConveyor3
        self.StationConveyorControl_Instance.run()

def network_3(self):
    """Network 3"""
    if True:
        if not hasattr(self, 'StationProcessControl_Instance'): self.StationProcessControl_Instance = StationProcessControl()
        self.StationProcessControl_Instance.xPositionerSensor = self.xPositionerSensor
        self.StationProcessControl_Instance.xClampSensor = self.xClampSensor
        self.StationProcessControl_Instance.tProcessTime = self.Work_Station_DB_Status_tProcessTime
        self.StationProcessControl_Instance.xPositionerClamp = self.xPositionerClamp
        self.StationProcessControl_Instance.xPositionerRaise = self.xPositionerRaise
        self.StationProcessControl_Instance.xInProcess = self.Work_Station_DB_Status_xInProcess
        self.StationProcessControl_Instance.diProcessTimeLeft = self.Work_Station_DB_Status_diProcessTimeDone
        self.StationProcessControl_Instance.xRequestData = self.Work_Station_DB_Command_xRequestData
        self.StationProcessControl_Instance.run()

def run(self):
    """Executes the block logic."""
    self.network_1()
    self.network_2()
    self.network_3()
