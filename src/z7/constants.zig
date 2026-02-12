pub const Area = struct {
    pub const DATA_RECORD: u8 = 0x01;
    pub const SYSTEM_INFO_200: u8 = 0x03;
    pub const SYSTEM_FLAGS_200: u8 = 0x05;
    pub const ANALOG_INPUT_200: u8 = 0x06;
    pub const ANALOG_OUTPUT_200: u8 = 0x07;
    pub const COUNTER_S7: u8 = 0x1C; // CT
    pub const TIMER_S7: u8 = 0x1D; // TM
    pub const IEC_COUNTER_200: u8 = 0x1E;
    pub const IEC_TIMER_200: u8 = 0x1F;
    pub const DIRECT_ACCESS: u8 = 0x80;
    pub const PE_INPUTS: u8 = 0x81; // PE
    pub const PA_OUTPUTS: u8 = 0x82; // PA
    pub const MK_FLAGS: u8 = 0x83; // MK
    pub const DB_DATABLOCKS: u8 = 0x84; // DB
    pub const DI_DB_INSTANCE: u8 = 0x85;
    pub const LOCAL_DATA: u8 = 0x86;
};

pub const COTP = struct {
    pub const NOP: u8 = 0x00;
    pub const EXPEDITED_DATA: u8 = 0x10;
    pub const CLTP_USER_DATA: u8 = 0x20;
    pub const EXPEDITED_DATA_ACK: u8 = 0x40;
    pub const REJECT: u8 = 0x50;
    pub const ACK_DATA: u8 = 0x70;
    pub const DISCONNECT_REQUEST: u8 = 0x80;
    pub const DISCONNECT_CONFIRM: u8 = 0xC0;
    pub const CONNECT_CONFIRM: u8 = 0xD0;
    pub const CONNECT_REQUEST: u8 = 0xE0;
    pub const DATA: u8 = 0xF0;
};

pub const CpuStatus = struct {
    pub const UNKNOWN: u8 = 0x00;
    pub const RUN: u8 = 0x08;
    pub const STOP: u8 = 0x04;
};

pub const CpuSubfunction = struct {
    pub const READ_SZL: u8 = 0x01;
    pub const MESSAGE_SERVICE: u8 = 0x02;
    pub const STOP: u8 = 0x03;
    pub const ALARM_INDICATION: u8 = 0x04;
    pub const ALARM_INITIATE: u8 = 0x05;
    pub const ALARM_ACK1: u8 = 0x06;
    pub const ALARM_ACK2: u8 = 0x07;
};

pub const DataType = struct {
    pub const NONE: u8 = 0x00;
    pub const BIT: u8 = 0x01;
    pub const BYTE: u8 = 0x02;
    pub const CHAR: u8 = 0x03;
    pub const WORD: u8 = 0x04;
    pub const INT: u8 = 0x05;
    pub const DWORD: u8 = 0x06;
    pub const DINT: u8 = 0x07;
    pub const REAL: u8 = 0x08;
    pub const DATE: u8 = 0x09;
    pub const TIME_OF_DAY: u8 = 0x0A;
    pub const TIME: u8 = 0x0B;
    pub const S5TIME: u8 = 0x0C;
    pub const DATETIME: u8 = 0x0E;
    pub const STRING: u8 = 0x13;
    pub const COUNTER: u8 = 0x1C;
    pub const TIMER: u8 = 0x1D;
    pub const IECTIMER: u8 = 0x1E;
    pub const IECCOUNTER: u8 = 0x1F;
    pub const HSCOUNTER: u8 = 0x20;
};

pub const TransportSize = struct {
    pub const NULL: u8 = 0x00;
    pub const BIT: u8 = 0x03;
    pub const BYTE_WORD_DWORD: u8 = 0x04;
    pub const INT: u8 = 0x05;
    pub const DINT: u8 = 0x06;
    pub const REAL: u8 = 0x07;
    pub const OCTET_STRING: u8 = 0x09;
    pub const NCK_ADDRESS1: u8 = 0x11;
    pub const NCK_ADDRESS2: u8 = 0x12;
};

pub const ErrorClass = struct {
    pub const NO_ERROR: u8 = 0x00;
    pub const APPLICATION_RELATIONSHIP: u8 = 0x81;
    pub const OBJECT_DEFINITION: u8 = 0x82;
    pub const NO_RESOURCE_AVAILABLE: u8 = 0x83;
    pub const ERROR_ON_SERVICE_PROCESSING: u8 = 0x84;
    pub const ERROR_ON_SUPPLIES: u8 = 0x85;
    pub const ACCESS_ERROR: u8 = 0x87;
};

pub const Function = struct {
    pub const CPU_SERVICES: u8 = 0x00;
    pub const READ_VARIABLE: u8 = 0x04;
    pub const WRITE_VARIABLE: u8 = 0x05;
    pub const REQUEST_DOWNLOAD: u8 = 0x1A;
    pub const DOWNLOAD_BLOCK: u8 = 0x1B;
    pub const DOWNLOAD_ENDED: u8 = 0x1C;
    pub const START_UPLOAD: u8 = 0x1D;
    pub const UPLOAD: u8 = 0x1E;
    pub const END_UPLOAD: u8 = 0x1F;
    pub const PLC_SERVICE: u8 = 0x28;
    pub const PLC_STOP: u8 = 0x29;
    pub const SETUP_COMMUNICATION: u8 = 0xF0;
};

pub const FunctionGroup = struct {
    pub const BLOCK_REQUEST: u8 = 0x43;
    pub const BLOCK_RESPONSE: u8 = 0x83;
    pub const CPU_REQUEST: u8 = 0x44;
    pub const CPU_RESPONSE: u8 = 0x84;
    pub const TIME_REQUEST: u8 = 0x47;
    pub const TIME_RESPONSE: u8 = 0x87;
};

pub const ParamMethod = struct {
    pub const REQUEST: u8 = 0x11;
    pub const RESPONSE: u8 = 0x12;
};

pub const ReturnCode = struct {
    pub const RESERVED: u8 = 0x00;
    pub const HARDWARE_ERROR: u8 = 0x01;
    pub const ACCESSING_OBJECT_NOT_ALLOWED: u8 = 0x03;
    pub const INVALID_ADDRESS: u8 = 0x05;
    pub const DATATYPE_NOT_SUPPORTED: u8 = 0x06;
    pub const DATATYPE_INCONSISTENT: u8 = 0x07;
    pub const OBJECT_NOT_EXIST: u8 = 0x0A;
    pub const SUCCESS: u8 = 0xFF;
};

pub const ROSCTR = struct {
    pub const JOB: u8 = 0x01;
    pub const ACK: u8 = 0x02;
    pub const ACK_DATA: u8 = 0x03;
    pub const USER_DATA: u8 = 0x07;
};

pub const SystemStateList = struct {
    pub const CATALOG_CODE: u16 = 0x0011;
    pub const CPU_DIAGOSTICS: u16 = 0x00A0;
    pub const CPU_LEDS: u16 = 0x0074; // 0x0019
    pub const CPU_ID: u16 = 0x001C;
    pub const CPU_STATUS: u16 = 0x0424;
    pub const COMM_PROC: u16 = 0x0131;
    pub const PROTECTION: u16 = 0x0232; // index 0x0004
};

pub const TimeSubfunction = struct {
    pub const READ_CLOCK: u8 = 0x01;
    pub const SET_CLOCK: u8 = 0x02;
    pub const READ_CLOCK_FOLLOWING: u8 = 0x03;
    pub const SET_CLOCK_2: u8 = 0x04;
};
