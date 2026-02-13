/// S7 Protocol definitions.
///
/// Combines wire-level structs (TPKT, COTP, S7Header) with named constants
/// ported from pystep7 constants.py and snap7-rs protocol.rs.
const std = @import("std");

// ─── Wire-level packed structs ───────────────────────────────────────────────

pub const TPKT = extern struct {
    version: u8,
    reserved: u8,
    length: u16, // Big-Endian on the wire
};

/// 10-byte common header for all ROSCTR types.
/// For ROSCTR 3 (Ack_Data) and 7 (Userdata) an additional 2-byte error/result
/// field follows on the wire, which is NOT part of this struct.
pub const S7Header = extern struct {
    proto_id: u8,
    rosctr: u8,
    reserved: u16,
    pdu_ref: u16, // Big-Endian
    param_len: u16, // Big-Endian
    data_len: u16, // Big-Endian
};

// ─── TPKT ────────────────────────────────────────────────────────────────────

pub const tpkt_version: u8 = 3;
pub const tpkt_header_len: u16 = @sizeOf(TPKT); // 4

// ─── COTP PDU Types ──────────────────────────────────────────────────────────

pub const Cotp = struct {
    pub const nop: u8 = 0x00;
    pub const expedited_data: u8 = 0x10;
    pub const cltp_user_data: u8 = 0x20;
    pub const expedited_data_ack: u8 = 0x40;
    pub const reject: u8 = 0x50;
    pub const ack_data: u8 = 0x70;
    pub const disconnect_request: u8 = 0x80;
    pub const disconnect_confirm: u8 = 0xC0;
    pub const connect_confirm: u8 = 0xD0;
    pub const connect_request: u8 = 0xE0;
    pub const data: u8 = 0xF0;

    /// EOT flag in the last byte of a COTP DT header.
    pub const eot: u8 = 0x80;
};

// ─── S7 Protocol ID ──────────────────────────────────────────────────────────

pub const s7_proto_id: u8 = 0x32;

// ─── ROSCTR (Remote Operating Service Control) ───────────────────────────────

pub const Rosctr = struct {
    pub const job: u8 = 0x01;
    pub const ack: u8 = 0x02;
    pub const ack_data: u8 = 0x03;
    pub const userdata: u8 = 0x07;
};

// ─── S7 Functions (first byte of the Parameter block for ROSCTR Job/Ack) ─────

pub const Function = enum(u8) {
    cpu_services = 0x00,
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

// ─── Userdata Function Groups ────────────────────────────────────────────────
// These appear at params[5] in a Userdata request/response.

pub const FunctionGroup = struct {
    pub const block_request: u8 = 0x43;
    pub const block_response: u8 = 0x83;
    pub const cpu_request: u8 = 0x44;
    pub const cpu_response: u8 = 0x84;
    pub const time_request: u8 = 0x47;
    pub const time_response: u8 = 0x87;
};

// ─── Userdata Sub-functions ──────────────────────────────────────────────────
// These appear at params[6] in a Userdata request/response.

pub const CpuSubfunction = struct {
    pub const read_szl: u8 = 0x01;
    pub const message_service: u8 = 0x02;
    pub const stop: u8 = 0x03;
    pub const alarm_indication: u8 = 0x04;
    pub const alarm_initiate: u8 = 0x05;
    pub const alarm_ack1: u8 = 0x06;
    pub const alarm_ack2: u8 = 0x07;
};

pub const TimeSubfunction = struct {
    pub const read_clock: u8 = 0x01;
    pub const set_clock: u8 = 0x02;
    pub const read_clock_following: u8 = 0x03;
    pub const set_clock_2: u8 = 0x04;
};

// ─── Param Method ────────────────────────────────────────────────────────────

pub const ParamMethod = struct {
    pub const request: u8 = 0x11;
    pub const response: u8 = 0x12;
};

// ─── Transport Sizes ─────────────────────────────────────────────────────────

pub const TransportSize = enum(u8) {
    null = 0x00,
    bit = 0x03,
    byte_word_dword = 0x04,
    int = 0x05,
    dint = 0x06,
    real = 0x07,
    octet_string = 0x09,
    nck_address1 = 0x11,
    nck_address2 = 0x12,
    _,
};

// ─── Return Codes ────────────────────────────────────────────────────────────

pub const ReturnCode = enum(u8) {
    reserved = 0x00,
    hardware_error = 0x01,
    accessing_object_not_allowed = 0x03,
    invalid_address = 0x05,
    data_type_not_supported = 0x06,
    data_type_inconsistent = 0x07,
    object_does_not_exist = 0x0A,
    success = 0xFF,
    _,
};

// ─── Area Identifiers ────────────────────────────────────────────────────────

pub const Area = enum(u8) {
    data_record = 0x01,
    system_info_200 = 0x03,
    system_flags_200 = 0x05,
    analog_input_200 = 0x06,
    analog_output_200 = 0x07,
    counter_s7 = 0x1C,
    timer_s7 = 0x1D,
    iec_counter_200 = 0x1E,
    iec_timer_200 = 0x1F,
    direct_access = 0x80,
    pe_inputs = 0x81,
    pa_outputs = 0x82,
    mk_flags = 0x83,
    db_datablocks = 0x84,
    di_db_instance = 0x85,
    local_data = 0x86,
    _,
};

// ─── Error Classes ───────────────────────────────────────────────────────────

pub const ErrorClass = struct {
    pub const no_error: u8 = 0x00;
    pub const application_relationship: u8 = 0x81;
    pub const object_definition: u8 = 0x82;
    pub const no_resource_available: u8 = 0x83;
    pub const error_on_service_processing: u8 = 0x84;
    pub const error_on_supplies: u8 = 0x85;
    pub const access_error: u8 = 0x87;
};

// ─── CPU Status ──────────────────────────────────────────────────────────────

pub const CpuStatus = struct {
    pub const unknown: u8 = 0x00;
    pub const stop: u8 = 0x04;
    pub const run: u8 = 0x08;
};

// ─── System State List (SZL) IDs ─────────────────────────────────────────────

pub const SzlId = struct {
    pub const catalog_code: u16 = 0x0011;
    pub const cpu_leds: u16 = 0x0074;
    pub const cpu_diagnostics: u16 = 0x00A0;
    pub const cpu_id: u16 = 0x001C;
    pub const comm_proc: u16 = 0x0131;
    pub const protection: u16 = 0x0232;
    pub const cpu_status: u16 = 0x0424;
};

// ─── Data Types ──────────────────────────────────────────────────────────────

pub const DataType = enum(u8) {
    none = 0x00,
    bit = 0x01,
    byte = 0x02,
    char = 0x03,
    word = 0x04,
    int = 0x05,
    dword = 0x06,
    dint = 0x07,
    real = 0x08,
    date = 0x09,
    time_of_day = 0x0A,
    time = 0x0B,
    s5time = 0x0C,
    datetime = 0x0E,
    string = 0x13,
    counter = 0x1C,
    timer = 0x1D,
    iec_timer = 0x1E,
    iec_counter = 0x1F,
    hs_counter = 0x20,
    _,
};

// ─── Syntax ID ───────────────────────────────────────────────────────────────

pub const SyntaxId = struct {
    pub const s7_any: u8 = 0x10;
    pub const pbcr_id: u8 = 0x13;
    pub const alarm_lock_free: u8 = 0x15;
    pub const alarm_indicator: u8 = 0x16;
    pub const alarm_ack: u8 = 0x19;
    pub const alarm_query_request: u8 = 0x1A;
    pub const notifier_indicator: u8 = 0x1C;
    pub const nck: u8 = 0x82;
    pub const drive_es_any: u8 = 0xA2;
    pub const data_block_read: u8 = 0xB0;
    pub const s7_1200_sym: u8 = 0xB2;
};

// ─── Helper: write a big-endian u16 into a buffer at a position ──────────────

pub fn writeBE16(buf: []u8, pos: usize, val: u16) void {
    buf[pos] = @intCast((val >> 8) & 0xFF);
    buf[pos + 1] = @intCast(val & 0xFF);
}

// ─── Packet builder helpers (inspired by snap7-rs protocol.rs) ───────────────
// These build complete S7 PDUs (without TPKT+COTP wrapping) into a provided
// buffer and return the number of bytes written.

/// TPKT (4) + COTP DT (3) preamble.
/// Returns 7; caller should continue writing at offset 7.
pub fn writeTpktCotpDT(buf: []u8, total_len: u16) void {
    // TPKT
    buf[0] = tpkt_version;
    buf[1] = 0;
    writeBE16(buf, 2, total_len);
    // COTP Data Transfer
    buf[4] = 2; // Length indicator
    buf[5] = Cotp.data; // PDU type = DT
    buf[6] = Cotp.eot; // EOT
}

/// Writes a 12-byte S7 header (Ack_Data style, with 2-byte error field) at `buf[offset..]`.
/// Use for ROSCTR = Ack_Data (0x03).
pub fn writeS7Header(
    buf: []u8,
    offset: usize,
    rosctr: u8,
    pdu_ref: u16,
    param_len: u16,
    data_len: u16,
    err_code: u16,
) void {
    const p = buf[offset..];
    p[0] = s7_proto_id;
    p[1] = rosctr;
    p[2] = 0; // reserved
    p[3] = 0;
    writeBE16(p, 4, pdu_ref);
    writeBE16(p, 6, param_len);
    writeBE16(p, 8, data_len);
    writeBE16(p, 10, err_code);
}

/// Writes a 10-byte S7 header (no error field) at `buf[offset..]`.
/// Use for ROSCTR = Userdata (0x07) — error info is in the params block.
pub fn writeS7HeaderShort(
    buf: []u8,
    offset: usize,
    rosctr: u8,
    pdu_ref: u16,
    param_len: u16,
    data_len: u16,
) void {
    const p = buf[offset..];
    p[0] = s7_proto_id;
    p[1] = rosctr;
    p[2] = 0; // reserved
    p[3] = 0;
    writeBE16(p, 4, pdu_ref);
    writeBE16(p, 6, param_len);
    writeBE16(p, 8, data_len);
}

/// Writes the 12-byte Userdata *response* parameter block.
///   [00 01 12] [08] [method] [func_group] [sub_func] [seq] [pdu_ref] [last_data_unit] [error_code BE16]
/// Total: 12 bytes.  (Request params are 8 bytes with [04] instead of [08].)
pub fn writeUserdataParams(
    buf: []u8,
    offset: usize,
    method: u8,
    func_group: u8,
    sub_func: u8,
    seq: u8,
) void {
    const p = buf[offset..];
    p[0] = 0x00;
    p[1] = 0x01;
    p[2] = 0x12;
    p[3] = 0x08; // param data length = 8  → total param block = 12
    p[4] = method;
    p[5] = func_group;
    p[6] = sub_func;
    p[7] = seq;
    p[8] = 0x00; // PDU reference
    p[9] = 0x00; // Last data unit (0x00 = YES, no more fragments)
    p[10] = 0x00; // Error code hi
    p[11] = 0x00; // Error code lo
}

/// Writes a 4-byte Data item header: [return_code] [transport_size] [length_BE16].
pub fn writeDataHeader(
    buf: []u8,
    offset: usize,
    return_code: u8,
    transport_size: u8,
    length: u16,
) void {
    buf[offset] = return_code;
    buf[offset + 1] = transport_size;
    writeBE16(buf, offset + 2, length);
}

/// Write a PLC control response (ACK for plc_control/plc_stop).
/// Uses 12-byte S7 header (Ack_Data) + 1-byte param (function code).
/// Total: TPKT(4) + COTP(3) + S7Header(12) + Param(1) = 20 bytes.
pub fn writePlcControlResponse(buf: []u8, pdu_ref: u16, func: u8) void {
    const tpkt_len: u16 = 20;
    writeTpktCotpDT(buf, tpkt_len);
    writeS7Header(buf, 7, Rosctr.ack_data, pdu_ref, 1, 0, 0);
    buf[19] = func; // param: the function code being acknowledged
}

/// Write an error response for unsupported Job functions.
/// Same structure as PLC control response but with a non-zero error code.
/// Total: TPKT(4) + COTP(3) + S7Header(12) + Param(1) = 20 bytes.
pub fn writeErrorResponse(buf: []u8, pdu_ref: u16, func: u8, error_code: u16) void {
    const tpkt_len: u16 = 20;
    writeTpktCotpDT(buf, tpkt_len);
    writeS7Header(buf, 7, Rosctr.ack_data, pdu_ref, 1, 0, error_code);
    buf[19] = func;
}
