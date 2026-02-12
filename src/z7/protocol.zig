const std = @import("std");

pub const Standard = struct {
    pub const TPKT_VERSION: u8 = 3;
    pub const COTP_CONNECT_REQUEST: u8 = 0xE0;
    pub const COTP_CONNECT_CONFIRM: u8 = 0xD0;
    pub const COTP_DATA: u8 = 0xF0;

    pub const S7_PROTO_ID: u8 = 0x32;
    pub const S7_ROSCTR_JOB: u8 = 1;
    pub const S7_ROSCTR_ACK: u8 = 2;
    pub const S7_ROSCTR_ACK_DATA: u8 = 3;
    pub const S7_ROSCTR_USERDATA: u8 = 7;

    pub const Function = enum(u8) {
        read_var = 0x04,
        write_var = 0x05,
        request_download = 0x1A,
        download = 0x1B,
        download_end = 0x1C,
        start_upload = 0x1D,
        upload = 0x1E,
        end_upload = 0x1F,
        plc_control = 0x28,
        plc_stop = 0x29,
        setup_comm = 0xF0,
        _,
    };

    pub const TransportSize = enum(u8) {
        bit = 0x03,
        byte = 0x04,
        word = 0x05,
        dword = 0x06,
        real = 0x07,
        octet_string = 0x09,
        _,
    };

    pub const ReturnCode = enum(u8) {
        reserved = 0x00,
        success = 0xFF,
        hardware_error = 0x01,
        access_denied = 0x03,
        address_out_of_range = 0x05,
        data_type_not_supported = 0x06,
        data_type_inconsistent = 0x07,
        object_does_not_exist = 0x0A,
        _,
    };

    pub const Area = enum(u8) {
        inputs = 0x81,
        outputs = 0x82,
        merkers = 0x83,
        db = 0x84,
        timers = 0x1D,
        counters = 0x1C,
        _,
    };
};

pub const TPKT = extern struct {
    version: u8,
    reserved: u8,
    length: u16, // Big Endian
};

pub const S7Header = extern struct {
    proto_id: u8,
    rosctr: u8,
    reserved: u16,
    pdu_ref: u16,
    param_len: u16,
    data_len: u16,
    // Note: If rosctr == 2 or 3, error_code: u16 follows.
};

pub const ItemRequest = extern struct {
    // Variable length...
    // But conceptually:
    // header: u8=0x12, len: u8=0x0A, syntax_id: u8=0x10,
    // transport_size: u8, length: u16, db_number: u16, area: u8, address: [3]u8
};
