from enum import IntEnum, auto
from dataclasses import dataclass, field
from typing import List, Callable, Union, Optional, Any
import struct

# Constants
LADDER_MAX_ROWS = 32
LADDER_MAX_COLS = 255
LADDERLIB_VERSION_MAJOR = 3
LADDERLIB_VERSION_MINOR = 5
LADDERLIB_VERSION_PATCH = 0

class LadderInstructions(IntEnum):
    LADDER_INS_NOP = 0
    LADDER_INS_CONN = 1
    LADDER_INS_NEG = 2
    LADDER_INS_NO = 3
    LADDER_INS_NC = 4
    LADDER_INS_RE = 5
    LADDER_INS_FE = 6
    LADDER_INS_COIL = 7
    LADDER_INS_COILL = 8
    LADDER_INS_COILU = 9
    LADDER_INS_TON = 10
    LADDER_INS_TOF = 11
    LADDER_INS_TP = 12
    LADDER_INS_CTU = 13
    LADDER_INS_CTD = 14
    LADDER_INS_MOVE = 15
    LADDER_INS_SUB = 16
    LADDER_INS_ADD = 17
    LADDER_INS_MUL = 18
    LADDER_INS_DIV = 19
    LADDER_INS_MOD = 20
    LADDER_INS_SHL = 21
    LADDER_INS_SHR = 22
    LADDER_INS_ROL = 23
    LADDER_INS_ROR = 24
    LADDER_INS_AND = 25
    LADDER_INS_OR = 26
    LADDER_INS_XOR = 27
    LADDER_INS_NOT = 28
    LADDER_INS_EQ = 29
    LADDER_INS_GT = 30
    LADDER_INS_GE = 31
    LADDER_INS_LT = 32
    LADDER_INS_LE = 33
    LADDER_INS_NE = 34
    LADDER_INS_FOREIGN = 35
    LADDER_INS_TMOVE = 36
    LADDER_INS_INV = 37
    LADDER_INS_MULTI = 255

class LadderState(IntEnum):
    LADDER_ST_STOPPED = 0
    LADDER_ST_RUNNING = 1
    LADDER_ST_ERROR = 2
    LADDER_ST_EXIT_TSK = 3
    LADDER_ST_NULLFN = 4
    LADDER_ST_INV = 5

class LadderInsError(IntEnum):
    LADDER_INS_ERR_OK = 0
    LADDER_INS_ERR_GETPREVVAL = 1
    LADDER_INS_ERR_GETDATAVAL = 2
    LADDER_INS_ERR_SETDATAVAL = 3
    LADDER_INS_ERR_NOFOREIGN = 4
    LADDER_INS_ERR_NOTABLE = 5
    LADDER_INS_ERR_OUTOFRANGE = 6
    LADDER_INS_ERR_DIVBYZERO = 7
    LADDER_INS_ERR_TYPEMISMATCH = 8
    LADDER_INS_ERR_OVERFLOW = 9
    LADDER_INS_ERR_NULL = 10
    LADDER_INS_ERR_FAIL = 11

class LadderDataType(IntEnum):
    LADDER_DATATYPE_BOOL = 0
    LADDER_DATATYPE_U8 = 1
    LADDER_DATATYPE_U16 = 2
    LADDER_DATATYPE_U32 = 3
    LADDER_DATATYPE_I8 = 4
    LADDER_DATATYPE_I16 = 5
    LADDER_DATATYPE_I32 = 6
    LADDER_DATATYPE_REAL = 7
    LADDER_DATATYPE_CSTR = 8
    LADDER_DATATYPE_MOD_PORT = 9
    LADDER_DATATYPE_INV = 10

class LadderBaseTime(IntEnum):
    LADDER_BASETIME_MS = 0
    LADDER_BASETIME_10MS = 1
    LADDER_BASETIME_100MS = 2
    LADDER_BASETIME_SEC = 3
    LADDER_BASETIME_MIN = 4

class LadderRegister(IntEnum):
    LADDER_REGISTER_NONE = 0
    LADDER_REGISTER_M = 1
    LADDER_REGISTER_Q = 2
    LADDER_REGISTER_I = 3
    LADDER_REGISTER_Cd = 4
    LADDER_REGISTER_Cr = 5
    LADDER_REGISTER_Td = 6
    LADDER_REGISTER_Tr = 7
    LADDER_REGISTER_IW = 8
    LADDER_REGISTER_QW = 9
    LADDER_REGISTER_C = 10
    LADDER_REGISTER_T = 11
    LADDER_REGISTER_D = 12
    LADDER_REGISTER_S = 13
    LADDER_REGISTER_R = 14
    LADDER_REGISTER_INV = 15

@dataclass
class LadderInstructionIOCD:
    inputs: int = 0
    outputs: int = 0
    cells: int = 0
    data_qty: int = 0

@dataclass
class ModulePort:
    module: int = 0
    port: int = 0

@dataclass
class LadderValue:
    type: LadderRegister = LadderRegister.LADDER_REGISTER_NONE
    value: Union[bool, int, float, str, ModulePort] = 0

    @property
    def i32(self) -> int:
        if isinstance(self.value, (int, bool)):
            return int(self.value)
        if isinstance(self.value, float):
            return int(self.value)
        return 0

    @i32.setter
    def i32(self, v: int):
        self.value = v

    @property
    def mp(self) -> ModulePort:
        if isinstance(self.value, ModulePort):
            return self.value
        return ModulePort()

    @mp.setter
    def mp(self, v: ModulePort):
        self.value = v

@dataclass
class LadderCell:
    state: bool = False
    vertical_bar: bool = False
    code: LadderInstructions = LadderInstructions.LADDER_INS_NOP
    data_qty: int = 0
    data: List[LadderValue] = field(default_factory=list)

@dataclass
class LadderNetwork:
    enable: bool = True
    rows: int = 0
    cols: int = 0
    cells: List[List[LadderCell]] = field(default_factory=list)

@dataclass
class LadderTimer:
    time_stamp: int = 0
    acc: int = 0

@dataclass
class LadderInternalsLast:
    instr: int = 0
    network: int = 0
    cell_column: int = 0
    cell_row: int = 0
    err: int = 0

@dataclass
class LadderInternalsQuantity:
    m: int = 0
    c: int = 0
    t: int = 0
    d: int = 0
    r: int = 0
    networks: int = 0
    delay_not_run: int = 0
    watchdog_ms: int = 0

@dataclass
class LadderInternals:
    state: LadderState = LadderState.LADDER_ST_STOPPED
    write_on_fault: bool = True
    last: LadderInternalsLast = field(default_factory=LadderInternalsLast)
    quantity: LadderInternalsQuantity = field(default_factory=LadderInternalsQuantity)

@dataclass
class LadderHWIO:
    fn_read_qty: int = 0
    fn_write_qty: int = 0
    read: List[Callable] = field(default_factory=list)
    write: List[Callable] = field(default_factory=list)
    init_read: List[Callable] = field(default_factory=list)
    init_write: List[Callable] = field(default_factory=list)

@dataclass
class LadderHWTime:
    millis: Optional[Callable[[], int]] = None
    delay: Optional[Callable[[int], None]] = None

@dataclass
class LadderHW:
    io: LadderHWIO = field(default_factory=LadderHWIO)
    time: LadderHWTime = field(default_factory=LadderHWTime)

@dataclass
class LadderManage:
    scan_end: Optional[Callable] = None
    instruction: Optional[Callable] = None
    task_before: Optional[Callable] = None
    task_after: Optional[Callable] = None
    panic: Optional[Callable] = None
    end_task: Optional[Callable] = None

@dataclass
class LadderMemory:
    M: List[int] = field(default_factory=list) # uint8_t
    Cr: List[bool] = field(default_factory=list)
    Cd: List[bool] = field(default_factory=list)
    Tr: List[bool] = field(default_factory=list)
    Td: List[bool] = field(default_factory=list)

@dataclass
class LadderPrevScanVals:
    Mh: List[int] = field(default_factory=list)
    Crh: List[bool] = field(default_factory=list)
    Cdh: List[bool] = field(default_factory=list)
    Trh: List[bool] = field(default_factory=list)
    Tdh: List[bool] = field(default_factory=list)

@dataclass
class LadderRegisters:
    C: List[int] = field(default_factory=list) # uint32_t
    D: List[int] = field(default_factory=list) # int32_t
    R: List[float] = field(default_factory=list) # float

@dataclass
class LadderHWInputVals:
    fn_id: int = 0
    i_qty: int = 0
    iw_qty: int = 0
    I: List[int] = field(default_factory=list) # uint8_t
    IW: List[int] = field(default_factory=list) # int32_t
    Ih: List[int] = field(default_factory=list) # uint8_t
    IWh: List[int] = field(default_factory=list) # int32_t

@dataclass
class LadderHWOutputVals:
    fn_id: int = 0
    q_qty: int = 0
    qw_qty: int = 0
    Q: List[int] = field(default_factory=list) # uint8_t
    QW: List[int] = field(default_factory=list) # int32_t
    Qh: List[int] = field(default_factory=list) # uint8_t
    QWh: List[int] = field(default_factory=list) # int32_t

@dataclass
class LadderScanInternals:
    actual_scan_time: int = 0
    start_time: int = 0
    max_scan_cycles: int = 0
    target_scan_ms: int = 0
    min_scan_time: int = 0
    max_scan_time: int = 0
    total_scan_time: int = 0
    avg_scan_time: int = 0
    scan_count: int = 0
    overrun: bool = False

@dataclass
class LadderForeignFunction:
    id: int = 0
    name: str = ""
    description: LadderInstructionIOCD = field(default_factory=LadderInstructionIOCD)
    exec: Optional[Callable] = None
    deinit: Optional[Callable] = None
    data: Any = None

@dataclass
class LadderForeign:
    qty: int = 0
    fn: List[LadderForeignFunction] = field(default_factory=list)

@dataclass
class LadderCtx:
    ladder: LadderInternals = field(default_factory=LadderInternals)
    hw: LadderHW = field(default_factory=LadderHW)
    on: LadderManage = field(default_factory=LadderManage)
    memory: LadderMemory = field(default_factory=LadderMemory)
    prev_scan_vals: LadderPrevScanVals = field(default_factory=LadderPrevScanVals)
    input: List[LadderHWInputVals] = field(default_factory=list)
    output: List[LadderHWOutputVals] = field(default_factory=list)
    registers: LadderRegisters = field(default_factory=LadderRegisters)
    timers: List[LadderTimer] = field(default_factory=list)
    scan_internals: LadderScanInternals = field(default_factory=LadderScanInternals)
    network: List[LadderNetwork] = field(default_factory=list)
    exec_network: Optional[LadderNetwork] = None
    foreign: LadderForeign = field(default_factory=LadderForeign)
    cron: Any = None

# Instruction definitions table
LADDER_FN_IOCD = {
    LadderInstructions.LADDER_INS_NOP: LadderInstructionIOCD(0, 0, 1, 0),
    LadderInstructions.LADDER_INS_CONN: LadderInstructionIOCD(1, 1, 1, 0),
    LadderInstructions.LADDER_INS_NEG: LadderInstructionIOCD(1, 1, 1, 0),
    LadderInstructions.LADDER_INS_NO: LadderInstructionIOCD(1, 1, 1, 1),
    LadderInstructions.LADDER_INS_NC: LadderInstructionIOCD(1, 1, 1, 1),
    LadderInstructions.LADDER_INS_RE: LadderInstructionIOCD(1, 1, 1, 1),
    LadderInstructions.LADDER_INS_FE: LadderInstructionIOCD(1, 1, 1, 1),
    LadderInstructions.LADDER_INS_COIL: LadderInstructionIOCD(1, 1, 1, 1),
    LadderInstructions.LADDER_INS_COILL: LadderInstructionIOCD(1, 1, 1, 1),
    LadderInstructions.LADDER_INS_COILU: LadderInstructionIOCD(1, 1, 1, 1),
    LadderInstructions.LADDER_INS_TON: LadderInstructionIOCD(1, 1, 2, 2),
    LadderInstructions.LADDER_INS_TOF: LadderInstructionIOCD(1, 1, 2, 2),
    LadderInstructions.LADDER_INS_TP: LadderInstructionIOCD(1, 1, 2, 2),
    LadderInstructions.LADDER_INS_CTU: LadderInstructionIOCD(1, 1, 2, 2),
    LadderInstructions.LADDER_INS_CTD: LadderInstructionIOCD(1, 1, 2, 2),
    LadderInstructions.LADDER_INS_MOVE: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_SUB: LadderInstructionIOCD(1, 1, 1, 3),
    LadderInstructions.LADDER_INS_ADD: LadderInstructionIOCD(1, 1, 1, 3),
    LadderInstructions.LADDER_INS_MUL: LadderInstructionIOCD(1, 1, 1, 3),
    LadderInstructions.LADDER_INS_DIV: LadderInstructionIOCD(1, 1, 1, 3),
    LadderInstructions.LADDER_INS_MOD: LadderInstructionIOCD(1, 1, 1, 3),
    LadderInstructions.LADDER_INS_SHL: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_SHR: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_ROL: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_ROR: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_AND: LadderInstructionIOCD(1, 1, 1, 3),
    LadderInstructions.LADDER_INS_OR: LadderInstructionIOCD(1, 1, 1, 3),
    LadderInstructions.LADDER_INS_XOR: LadderInstructionIOCD(1, 1, 1, 3),
    LadderInstructions.LADDER_INS_NOT: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_EQ: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_GT: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_GE: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_LT: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_LE: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_NE: LadderInstructionIOCD(1, 1, 1, 2),
    LadderInstructions.LADDER_INS_FOREIGN: LadderInstructionIOCD(1, 1, 1, 0),
    LadderInstructions.LADDER_INS_TMOVE: LadderInstructionIOCD(1, 1, 1, 5),
    LadderInstructions.LADDER_INS_INV: LadderInstructionIOCD(0, 0, 0, 0),
    LadderInstructions.LADDER_INS_MULTI: LadderInstructionIOCD(0, 0, 0, 0),
}
