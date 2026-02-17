from src.runtime import BaseBlock, DotDict, RecursiveMock, Bool, Int, DInt, Real, String, Time
from src.runtime.std import *
from generated_python.Control_Panel import Control_Panel
from generated_python.Sequence_Data_Management import Sequence_Data_Management
from generated_python.Supply_Conveyor import Supply_Conveyor
from generated_python.Work_Station import Work_Station

class Main(BaseBlock):
    def __init__(self, **kwargs):
        self.Initial_Call: bool = kwargs.get('Initial_Call', False)
        self.Remanence: bool = kwargs.get('Remanence', False)

def network_1(self):
    """Network 1"""
    if True:
        if not hasattr(self, 'Supply_Conveyor_DB'): self.Supply_Conveyor_DB = Supply_Conveyor()
        self.Supply_Conveyor_DB.run()

def network_2(self):
    """Network 2"""
    if True:
        if not hasattr(self, 'Work_Station1_DB'): self.Work_Station1_DB = Work_Station()
        self.Work_Station1_DB.xEntrySensor = self.iIO_xS1EntrySensor
        self.Work_Station1_DB.xExitSensor = self.iIO_xS1ExitSensor
        self.Work_Station1_DB.xPositionerSensor = self.iIO_xS1PositionerSensor
        self.Work_Station1_DB.xQueueSensor = self.iIO_xSupplyExitSensor
        self.Work_Station1_DB.xClampSensor = self.iIO_xS1ClampSensor
        self.Work_Station1_DB.xConveyor1 = self.qIO_xS1Conveyor1
        self.Work_Station1_DB.xConveyor2 = self.qIO_xS1Conveyor2
        self.Work_Station1_DB.xConveyor3 = self.qIO_xS1Conveyor3
        self.Work_Station1_DB.xPositionerClamp = self.qIO_xS1PositionerClamp
        self.Work_Station1_DB.xPositionerRaise = self.qIO_xS1PositionerRaise
        self.Work_Station1_DB.Work_Station_DB = self.DB_Equipment_Station1
        self.Work_Station1_DB.run()
    if True:
        if not hasattr(self, 'Control_Panel1_DB'): self.Control_Panel1_DB = Control_Panel()
        self.Control_Panel1_DB.xResetButton = self.iIO_xS1ResetButton
        self.Control_Panel1_DB.xEmergencyButton = self.iIO_xS1EmergencyButton
        self.Control_Panel1_DB.xProcessLight = self.qIO_xS1ProcessLight
        self.Control_Panel1_DB.diProcessTimeLeft = self.qIO_iS1ProcessTimeLeft
        self.Control_Panel1_DB.Work_Station_DB = self.DB_Equipment_Station1
        self.Control_Panel1_DB.run()

def network_3(self):
    """Network 3"""
    if True:
        if not hasattr(self, 'Work_Station2_DB'): self.Work_Station2_DB = Work_Station()
        self.Work_Station2_DB.xEntrySensor = self.iIO_xS2EntrySensor
        self.Work_Station2_DB.xExitSensor = self.iIO_xS2ExitSensor
        self.Work_Station2_DB.xPositionerSensor = self.iIO_xS2PositionerSensor
        self.Work_Station2_DB.xQueueSensor = self.iIO_xS1ExitSensor
        self.Work_Station2_DB.xClampSensor = self.iIO_xS2ClampSensor
        self.Work_Station2_DB.xConveyor1 = self.qIO_xS2Conveyor1
        self.Work_Station2_DB.xConveyor2 = self.qIO_xS2Conveyor2
        self.Work_Station2_DB.xConveyor3 = self.qIO_xS2Conveyor3
        self.Work_Station2_DB.xPositionerClamp = self.qIO_xS2PositionerClamp
        self.Work_Station2_DB.xPositionerRaise = self.qIO_xS2PositionerRaise
        self.Work_Station2_DB.Work_Station_DB = self.DB_Equipment_Station2
        self.Work_Station2_DB.run()
    if True:
        if not hasattr(self, 'Control_Panel2_DB'): self.Control_Panel2_DB = Control_Panel()
        self.Control_Panel2_DB.xResetButton = self.iIO_xS2ResetButton
        self.Control_Panel2_DB.xEmergencyButton = self.iIO_xS2EmergencyButton
        self.Control_Panel2_DB.xProcessLight = self.qIO_xS2ProcessLight
        self.Control_Panel2_DB.diProcessTimeLeft = self.qIO_iS2ProcessTimeLeft
        self.Control_Panel2_DB.Work_Station_DB = self.DB_Equipment_Station2
        self.Control_Panel2_DB.run()

def network_4(self):
    """Network 4"""
    if True:
        if not hasattr(self, 'Work_Station3_DB'): self.Work_Station3_DB = Work_Station()
        self.Work_Station3_DB.xEntrySensor = self.iIO_xS3EntrySensor
        self.Work_Station3_DB.xExitSensor = self.iIO_xS3ExitSensor
        self.Work_Station3_DB.xPositionerSensor = self.iIO_xS3PositionerSensor
        self.Work_Station3_DB.xQueueSensor = self.iIO_xS2ExitSensor
        self.Work_Station3_DB.xClampSensor = self.iIO_xS3ClampSensor
        self.Work_Station3_DB.xConveyor1 = self.qIO_xS3Conveyor1
        self.Work_Station3_DB.xConveyor2 = self.qIO_xS3Conveyor2
        self.Work_Station3_DB.xConveyor3 = self.qIO_xS3Conveyor3
        self.Work_Station3_DB.xPositionerClamp = self.qIO_xS3PositionerClamp
        self.Work_Station3_DB.xPositionerRaise = self.qIO_xS3PositionerRaise
        self.Work_Station3_DB.Work_Station_DB = self.DB_Equipment_Station3
        self.Work_Station3_DB.run()
    if True:
        if not hasattr(self, 'Control_Panel3_DB'): self.Control_Panel3_DB = Control_Panel()
        self.Control_Panel3_DB.xResetButton = self.iIO_xS3ResetButton
        self.Control_Panel3_DB.xEmergencyButton = self.iIO_xS3EmergencyButton
        self.Control_Panel3_DB.xProcessLight = self.qIO_xS3ProcessLight
        self.Control_Panel3_DB.diProcessTimeLeft = self.qIO_iS3ProcessTimeLeft
        self.Control_Panel3_DB.Work_Station_DB = self.DB_Equipment_Station3
        self.Control_Panel3_DB.run()

def network_5(self):
    """Network 5"""
    if True:
        if not hasattr(self, 'Sequence_Data_Management_DB'): self.Sequence_Data_Management_DB = Sequence_Data_Management()
        self.Sequence_Data_Management_DB.run()

def network_6(self):
    """Network 6"""
    pass

def run(self):
    """Executes the block logic."""
    self.network_1()
    self.network_2()
    self.network_3()
    self.network_4()
    self.network_5()
    self.network_6()
