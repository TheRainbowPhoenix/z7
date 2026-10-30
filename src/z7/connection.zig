const std = @import("std");
const builtin = @import("builtin");
const zCom = @import("zCom");
const IO = zCom.io.IO;
const Storage = @import("storage.zig").Storage;
const proto = @import("protocol.zig");
const constants = @import("constants.zig");
const ErrorCode = constants.ErrorCode;
const firmware = @import("firmware.zig");
const types = @import("types.zig");
const alarms = @import("alarms.zig");
const SendQueue = @import("send_queue.zig").Queue;
const variable_write = @import("variable_write.zig");
const assert = std.debug.assert;
const TPKT = proto.TPKT;
const S7Header = proto.S7Header;

const exports = @import("exports.zig");

const log = std.log.scoped(.connection);

fn fire_event(event_type: u8, detail: []const u8) void {
    if (exports.event_callback) |cb| {
        cb(event_type, detail.ptr, detail.len);
    }
}

pub const Connection = struct {
    io: *IO,
    storage: *Storage,
    alarm_store: *alarms.Store,
    socket: std.posix.socket_t,

    // Message Buffers
    rx_buffer: [16384]u8 align(4) = undefined,
    tx_buffer: [16384]u8 align(4) = undefined,

    // IO Completions
    read_completion: IO.Completion = undefined,
    write_completion: IO.Completion = undefined,
    close_completion: IO.Completion = undefined,

    // State
    closed: bool = false,
    pending_ops: usize = 0,
    read_pending: bool = false,
    write_pending: bool = false,
    rx_received: usize = 0,
    rx_target: usize = 4,
    send_queue: SendQueue = .{},
    pdu_limit: u16 = 960,
    alarm_subscribed: bool = false,
    alarm_cursor: u64 = 0,
    alarm_sequence: u8 = 0,

    pub fn init(io: *IO, storage: *Storage, alarm_store: *alarms.Store, socket: std.posix.socket_t) Connection {
        return .{
            .io = io,
            .storage = storage,
            .alarm_store = alarm_store,
            .socket = socket,
            .closed = true,
        };
    }

    pub fn reset(self: *Connection, socket: std.posix.socket_t) void {
        assert(self.pending_ops == 0);
        self.socket = socket;
        self.closed = false;
        self.pending_ops = 0;
        self.read_pending = false;
        self.write_pending = false;
        self.rx_received = 0;
        self.rx_target = 4;
        self.send_queue = .{};
        self.pdu_limit = 960;
        self.alarm_subscribed = false;
        self.alarm_cursor = 0;
        self.alarm_sequence = 0;
        // Completions are reused and will be overwritten by submit()
    }

    pub fn start(self: *Connection) void {
        self.start_read_header();
    }

    // Read pipeline

    fn start_read_header(self: *Connection) void {
        if (self.closed or self.read_pending or self.send_queue.free() == 0) return;
        self.rx_received = 0;
        self.rx_target = 4;
        self.receive_more();
    }

    fn receive_more(self: *Connection) void {
        assert(!self.read_pending);
        assert(self.rx_received < self.rx_target);
        assert(self.rx_target <= self.rx_buffer.len);
        if (self.closed) return;
        self.read_pending = true;
        self.pending_ops += 1;
        self.io.recv(
            *Connection,
            self,
            on_receive,
            &self.read_completion,
            self.socket,
            self.rx_buffer[self.rx_received..self.rx_target],
        );
    }

    fn on_receive(self: *Connection, completion: *IO.Completion, result: IO.RecvError!usize) void {
        _ = completion;
        assert(self.read_pending);
        self.read_pending = false;
        assert(self.pending_ops > 0);
        self.pending_ops -= 1;
        if (self.closed) return;
        const bytes_read = result catch |err| {
            log.err("Receive error: {}", .{err});
            self.close();
            return;
        };

        if (bytes_read == 0 or bytes_read > self.rx_target - self.rx_received) {
            self.close();
            return;
        }

        self.rx_received += bytes_read;
        if (self.rx_received < self.rx_target) {
            self.receive_more();
            return;
        }

        if (self.rx_target == 4) {
            const header = self.rx_buffer[0..4];
            const length = std.mem.readInt(u16, header[2..4], .big);
            if (header[0] != proto.tpkt_version or header[1] != 0 or length < 7 or length > self.rx_buffer.len) {
                self.close();
                return;
            }
            self.rx_target = length;
            self.receive_more();
            return;
        }

        self.process_pdu(self.rx_buffer[0..self.rx_target]);
        self.start_read_header();
    }

    // COTP / S7 dispatch

    fn process_pdu(self: *Connection, data: []u8) void {
        if (data.len < 7) {
            self.close();
            return;
        }

        const cotp_len = data[4];
        const pdu_offset = 5 + @as(usize, cotp_len);
        if (cotp_len < 2 or pdu_offset > data.len) {
            self.close();
            return;
        }

        if (data.len == pdu_offset) {
            // Short packet - might be a COTP-only message (CR, DR, …)
            const pdu_type = data[5];
            if (pdu_type == proto.Cotp.connect_request) {
                self.handle_connect_request(data);
                return;
            }
            log.err("Unknown COTP PDU Type or short packet: 0x{x}", .{pdu_type});
            self.close();
            return;
        }

        if (cotp_len != 2 or data[5] != proto.Cotp.data or data[6] != proto.Cotp.eot) {
            self.close();
            return;
        }
        self.handle_s7(data[pdu_offset..]);
    }

    // COTP Connection

    fn handle_connect_request(self: *Connection, data: []u8) void {
        if (data.len < 11) {
            self.close();
            return;
        }
        const src_ref_hi = data[8];
        const src_ref_lo = data[9];

        var tx = &self.tx_buffer;

        // TPKT
        tx[0] = proto.tpkt_version;
        tx[1] = 0;
        tx[2] = 0;
        tx[3] = 22; // total length
        // COTP CC
        tx[4] = 17; // Length indicator (18 bytes - 1)
        tx[5] = proto.Cotp.connect_confirm; // 0xD0
        tx[6] = src_ref_hi; // Dst-Ref = client's Src-Ref
        tx[7] = src_ref_lo;
        tx[8] = 0x00; // Our Src-Ref
        tx[9] = 0x01;
        tx[10] = 0x00; // Class 0

        // Copy TSAP / option parameters from CR
        if (data.len >= 22) {
            @memcpy(tx[11..22], data[11..22]);
        } else {
            @memset(tx[11..22], 0);
        }

        self.send_response(22);
    }

    // S7 Dispatch

    fn handle_s7(self: *Connection, data: []u8) void {
        if (data.len < 10) {
            self.close();
            return;
        }

        const raw_header = std.mem.bytesToValue(S7Header, data[0..@sizeOf(S7Header)]);
        var header = raw_header;
        header.pdu_ref = std.mem.bigToNative(u16, raw_header.pdu_ref);
        header.param_len = std.mem.bigToNative(u16, raw_header.param_len);
        header.data_len = std.mem.bigToNative(u16, raw_header.data_len);

        if (header.proto_id != proto.s7_proto_id) {
            log.err("Invalid S7 proto id: 0x{x}", .{header.proto_id});
            self.close();
            return;
        }

        const rosctr = header.rosctr;

        if (rosctr == proto.Rosctr.job) {
            if (!self.dispatch_job(&header, data)) {
                self.start_read_header();
            }
        } else if (rosctr == proto.Rosctr.userdata) {
            if (!self.dispatch_userdata(&header, data)) {
                self.start_read_header();
            }
        } else {
            log.warn("Unhandled ROSCTR: {}", .{rosctr});
            self.start_read_header();
        }
    }

    fn dispatch_job(self: *Connection, header: *const S7Header, data: []u8) bool {
        const param_len: usize = header.param_len;
        const data_len: usize = header.data_len;

        if (10 + param_len + data_len > data.len) {
            self.close();
            return false; // considered handled as we closed, but no response was sent
        }

        const params = data[10..][0..param_len];
        if (params.len == 0) return false;

        const func: proto.Function = @enumFromInt(params[0]);
        switch (func) {
            .setup_comm => {
                self.handle_setup_comm(header, params);
                return true;
            },
            .read_var => {
                self.handle_read_var(header, params);
                return true;
            },
            .write_var => {
                self.handle_write_var(header, params, data[10 + param_len ..][0..data_len]);
                return true;
            },
            .plc_stop => {
                log.info("PLC Stop request", .{});
                fire_event(1, "plc_stop_request");
                self.handle_plc_control(header, @intFromEnum(proto.Function.plc_stop));
                return true;
            },
            .plc_control => {
                log.info("PLC Control request (start)", .{});
                fire_event(2, "plc_start_request");
                self.handle_plc_control(header, @intFromEnum(proto.Function.plc_control));
                return true;
            },
            .request_download, .download, .download_end, .start_upload, .upload, .end_upload => {
                // Return "Need Password" error to avoid hanging
                self.handle_error_response(header, params[0], @intFromEnum(ErrorCode.INCORRECT_PASSWORD_2)); // 0xD602
                return true;
            },
            else => {
                log.warn("Unhandled Job function: 0x{x}", .{params[0]});
                self.handle_error_response(header, params[0], @intFromEnum(ErrorCode.SERVICE_NOT_IMPLEMENTED_OR_FRAME_ERROR));
                return true;
            },
        }
    }

    fn dispatch_userdata(self: *Connection, header: *const S7Header, data: []u8) bool {
        const param_len: usize = header.param_len;
        const data_len: usize = header.data_len;

        // Accept the legacy twelve-byte header used by some raw clients as well.
        var params_off: usize = 10;
        if (data.len >= 15 and data[10] == 0x00 and data[11] == 0x01 and data[12] == 0x12) {
            params_off = 10;
        } else if (data.len >= 17 and data[12] == 0x00 and data[13] == 0x01 and data[14] == 0x12) {
            // Client sent 12-byte S7 header - params shifted by 2
            params_off = 12;
        }

        if (params_off + param_len + data_len > data.len) {
            self.close();
            return true;
        }

        const params = data[params_off..][0..param_len];
        const payload = data[params_off + param_len ..][0..data_len];

        // Params layout: [Head(3)] [Len(1)] [Method(1)] [Tg(1)] [SubFunc(1)] [Seq(1)]
        // Tg byte = (type << 4 | group) - e.g. 0x44 = type 4 (request) + group 4 (SZL)
        if (params.len < 8) {
            log.warn("Userdata params too short: {}", .{params.len});
            return false;
        }

        const tg = params[5]; // type_group combined byte
        const sub_func = params[6];
        const func_group = tg & 0x0F; // lower nibble = group

        if (func_group == 0x04) { // SZL (CPU functions)  proto.FunctionGroup.cpu_request
            if (sub_func != proto.CpuSubfunction.read_szl) {
                self.handle_alarm_request(header, params, payload, params_off + param_len + data_len == data.len);
                return true;
            }
            if (sub_func == proto.CpuSubfunction.read_szl) {
                // SZL Read - extract ID and Index from data payload
                if (payload.len >= 4) {
                    // Pass full params to handle_read_szl_request so it can echo seq
                    self.handle_read_szl_request(header, params, payload);
                    return true;
                }
            }
        } else if (func_group == 0x07) { // Time proto.FunctionGroup.time_request
            if (sub_func == proto.TimeSubfunction.read_clock) {
                log.info("Time Read request", .{});
                self.handle_time_read(header);
                return true;
            } else if (sub_func == proto.TimeSubfunction.set_clock) {
                log.info("Time Set request", .{});
                self.handle_time_set(header);
                return true;
            }
        } else if (func_group == 0x05) { // Security (password)
            log.info("Security request: sub=0x{x}", .{sub_func});
            self.handle_security(header, sub_func);
            return true;
        } else if (func_group == 0x03) { // Block info
            log.info("Block info request: sub=0x{x}", .{sub_func});
            self.handle_block_info(header, sub_func, params, payload);
            return true;
        }

        log.warn("Unknown Userdata: tg=0x{x:0>2} group=0x{x} sub=0x{x}", .{ tg, func_group, sub_func });
        return false;
    }

    fn alarm_reply(self: *Connection, reference: u16, subfunction: u8, sequence: u8, group: u8, code: u16, payload: []const u8) void {
        const overhead = 10 + 12 + 4;
        assert(self.pdu_limit >= 240);
        var response_code = code;
        var response_payload = payload;
        if (payload.len > @as(usize, self.pdu_limit) - overhead) {
            response_code = 0x8301;
            response_payload = &.{};
        }
        const length: u16 = @intCast(7 + overhead + response_payload.len);
        const tx = &self.tx_buffer;
        proto.writeTpktCotpDT(tx, length);
        proto.writeS7HeaderShort(tx, 7, proto.Rosctr.userdata, reference, 12, @intCast(4 + response_payload.len));
        proto.writeUserdataParams(tx, 17, proto.ParamMethod.response, group, subfunction, sequence);
        proto.writeBE16(tx, 27, response_code);
        proto.writeDataHeader(tx, 29, if (response_code == 0) 0xff else 0x0a, if (response_code == 0) 9 else 0, @intCast(response_payload.len));
        @memcpy(tx[33..][0..response_payload.len], response_payload);
        self.send_response(length);
    }

    fn alarm_error(self: *Connection, req: *const S7Header, params: []const u8, code: u16) void {
        assert(params.len >= 8);
        self.alarm_reply(req.pdu_ref, params[6], params[7], 0x84, code, &.{});
    }

    fn handle_alarm_request(self: *Connection, req: *const S7Header, params: []const u8, data: []const u8, exact_length: bool) void {
        assert(params.len >= 8);
        const payload = alarms.parse_envelope(params, data, exact_length, self.pdu_limit) catch |err| {
            self.alarm_error(req, params, if (err == error.Unsupported) 0x8702 else 0x0112);
            return;
        };
        switch (params[6]) {
            proto.CpuSubfunction.message_service => {
                const subscribed = alarms.parse_subscription(payload) catch |err| {
                    self.alarm_error(req, params, if (err == error.Unsupported) 0x8702 else 0x0112);
                    return;
                };
                const cursor = if (subscribed and !self.alarm_subscribed) self.alarm_store.cursor() else self.alarm_cursor;
                const response = [_]u8{ 0, 0, payload[10], 0, 0 };
                self.alarm_reply(req.pdu_ref, params[6], params[7], 0x84, 0, &response);
                if (!self.closed) {
                    self.alarm_cursor = cursor;
                    self.alarm_subscribed = subscribed;
                }
            },
            proto.CpuSubfunction.alarm_ack => {
                const request = alarms.parse_ack(payload) catch {
                    self.alarm_error(req, params, 0x0112);
                    return;
                };
                const timestamp = alarms.timestamp_from_ms(std.time.milliTimestamp()) catch {
                    self.alarm_error(req, params, 0x8402);
                    return;
                };
                var response: [2 + alarms.ack_capacity]u8 = undefined;
                response[0] = 0;
                response[1] = @intCast(request.count);
                self.alarm_store.acknowledge(&request, response[2..], timestamp) catch {
                    self.alarm_error(req, params, 0x8301);
                    return;
                };
                self.alarm_reply(req.pdu_ref, params[6], params[7], 0x84, 0, response[0 .. 2 + request.count]);
            },
            proto.CpuSubfunction.alarm_query => {
                const query = alarms.parse_query(payload) catch |err| {
                    self.alarm_error(req, params, if (err == error.Unsupported) 0x8702 else 0x0112);
                    return;
                };
                var response: [alarms.query_capacity]u8 = undefined;
                const length = self.alarm_store.query(query, &response);
                // No truncated snapshots: small-PDU clients can query individual IDs.
                self.alarm_reply(req.pdu_ref, params[6], params[7], 0x84, 0, response[0..length]);
            },
            else => self.alarm_error(req, params, 0x8702),
        }
    }

    /// Called only by the IO owner. Keep one queue slot available for a peer response.
    pub fn poll_alarms(self: *Connection) void {
        if (self.closed or !self.alarm_subscribed or self.send_queue.free() <= 1) return;
        const event = self.alarm_store.next(&self.alarm_cursor) catch {
            // A slow reader must reconnect/query rather than silently lose transitions.
            self.close();
            return;
        } orelse return;
        var payload: [22]u8 = undefined;
        const bytes = alarms.encode_event(event, &payload);
        self.alarm_sequence +%= 1; // Wire sequence numbers are eight-bit counters.
        self.alarm_reply(0, if (event.acknowledgement) 0x0c else 0x05, self.alarm_sequence, 0x04, 0, bytes);
    }

    // Setup Communication

    fn handle_setup_comm(self: *Connection, req: *const S7Header, params: []const u8) void {
        if (params.len != 8 or params[1] != 0 or std.mem.readInt(u16, params[2..4], .big) == 0 or
            std.mem.readInt(u16, params[4..6], .big) == 0 or std.mem.readInt(u16, params[6..8], .big) < 240)
        {
            self.handle_error_response(req, 0xf0, 0x0112);
            return;
        }
        self.pdu_limit = @min(960, std.mem.readInt(u16, params[6..8], .big));
        const tx = &self.tx_buffer;
        proto.writeSetupCommResponse(tx, req.pdu_ref, 1, 1, self.pdu_limit);
        self.send_response(27);
    }

    // SZL Read (Userdata Response)
    // TPKT(4) + COTP(3) + S7 Header(10 or 12) + Param(12) + Data(4+Payload)

    fn handle_read_szl_request(self: *Connection, req: *const S7Header, params: []const u8, data: []const u8) void {
        if (data.len < 4) {
            log.warn("SZL Request data too short", .{});
            return;
        }

        // Standard S7 clients (e.g. pystep7) send a 4-byte data header before the
        // SZL request: ReturnCode(1) + TransportSize(1) + DataLength(2), then SZL ID + Index.
        // Raw scripts may send just the 4-byte SZL ID + Index directly.
        // Detect: if first byte is 0xFF (success return code) and data is >= 8 bytes,
        // skip the 4-byte data header.
        const szl_off: usize = if (data.len >= 8 and data[0] == 0xFF) 4 else 0;
        if (szl_off + 4 > data.len) {
            log.warn("SZL Request data too short after header skip", .{});
            return;
        }

        const szl_id = std.mem.readInt(u16, data[szl_off..][0..2], .big);
        const szl_index = std.mem.readInt(u16, data[szl_off + 2 ..][0..2], .big);
        log.info("SZL Read: id=0x{x:0>4} index=0x{x:0>4}", .{ szl_id, szl_index });

        // Lookup prepared data blob (includes Data Header + SZL Payload)
        const blob = firmware.lookup(szl_id, szl_index);
        const blob_len: u16 = @intCast(blob.len);

        // TPKT(4) + COTP(3) + S7 Header(10) + Param(12) + Data(blob_len)
        const tpkt_len: u16 = 4 + 3 + 10 + 12 + blob_len;

        var tx = &self.tx_buffer;

        proto.writeTpktCotpDT(tx, tpkt_len);
        proto.writeS7HeaderShort(tx, 7, proto.Rosctr.userdata, req.pdu_ref, 12, blob_len);

        // Params
        // Echo sequence from request params if available.
        // req params: [Head(3)] [Len(1)] [Method(1)] [Tg(1)] [Sub(1)] [Seq(1)]
        // So params[7] is seq.
        // We can safely access params[7] because dispatch_userdata ensures params.len >= 8.
        const seq = if (params.len >= 8) params[7] else 0x00;

        proto.writeUserdataParams(tx, 17, proto.ParamMethod.response, // 0x12
            proto.FunctionGroup.cpu_response, proto.CpuSubfunction.read_szl, seq);

        // Data (blob)
        @memcpy(tx[29..][0..blob.len], blob);

        self.send_response(tpkt_len);
    }

    // Security (Password)
    // Simple ACK for enter/cancel password.

    fn handle_security(self: *Connection, req: *const S7Header, sub_func: u8) void {
        const data_total_len: u16 = 4; // Just data header, no payload
        const param_len: u16 = 12;
        const tpkt_len: u16 = 4 + 3 + 10 + param_len + data_total_len;

        const tx = &self.tx_buffer;

        proto.writeTpktCotpDT(tx, tpkt_len);
        proto.writeS7HeaderShort(tx, 7, proto.Rosctr.userdata, req.pdu_ref, param_len, data_total_len);

        proto.writeUserdataParams(
            tx,
            17,
            proto.ParamMethod.response,
            0x85, // security response = 0x85
            sub_func,
            0x00,
        );

        proto.writeDataHeader(
            tx,
            29,
            @intFromEnum(proto.ReturnCode.success),
            @intFromEnum(proto.TransportSize.octet_string),
            0,
        );

        self.send_response(tpkt_len);
    }

    // Block Info
    // Stub for block list/info requests.

    fn handle_block_info(self: *Connection, req: *const S7Header, sub_func: u8, params: []const u8, payload: []const u8) void {
        // Extract block number from ASCII in payload if available
        // Payload format: [DataHdr(4)] [Prefix(1)] [Type(1)] [NumberASCII(5)]
        var block_number: u16 = 1;
        if (payload.len >= 11) {
            const num_bytes = payload[6..11];
            var parsed: u16 = 0;
            for (num_bytes) |b| {
                if (b >= '0' and b <= '9') {
                    parsed = parsed * 10 + (b - '0');
                }
            }
            if (parsed > 0) block_number = parsed;
        }

        const info = types.BlockInfo{ .number = block_number, .block_type = if (payload.len >= 6) payload[5] else 0x41 };

        const record_len = 61;
        const sub_header_len = 9;
        const data_payload_len: u16 = sub_header_len + record_len;
        const data_total_len: u16 = 4 + data_payload_len;
        const param_len: u16 = 12;
        const tpkt_len: u16 = 4 + 3 + 10 + param_len + data_total_len;

        const tx = &self.tx_buffer;

        proto.writeTpktCotpDT(tx, tpkt_len);
        proto.writeS7HeaderShort(tx, 7, proto.Rosctr.userdata, req.pdu_ref, param_len, data_total_len);

        const seq = if (params.len >= 8) params[7] else 0x00;
        proto.writeUserdataParams(
            tx,
            17,
            proto.ParamMethod.response,
            0x83, // block info response group
            sub_func,
            seq,
        );
        // Copy low byte of pdu_ref to userdata params if it's there
        tx[17 + 8] = @intCast(req.pdu_ref & 0xFF);

        proto.writeDataHeader(
            tx,
            29,
            @intFromEnum(proto.ReturnCode.success),
            @intFromEnum(proto.TransportSize.octet_string),
            data_payload_len,
        );

        // Middle sub-header (9 bytes from offset 33 to 41)
        // [4] Cst_b (0x30) [5] BlkType [6-7] Cst_w1 [8-9] Cst_w2 [10-11] Cst_pp [12] Unknown
        @memset(tx[33..42], 0);
        tx[33] = 0x30; // '0'
        tx[34] = info.block_type;

        // Block record (61 bytes starting at offset 42)
        info.write(tx[42..][0..record_len]);

        self.send_response(tpkt_len);
    }

    // PLC Control (Stop / Start)
    // ACK for plc_stop (0x29) and plc_control (0x28, start).
    // Response: TPKT(4) + COTP(3) + S7Header(12) + Param(1) = 20.

    fn handle_plc_control(self: *Connection, req: *const S7Header, func: u8) void {
        const tx = &self.tx_buffer;
        proto.writePlcControlResponse(tx, req.pdu_ref, func);
        self.send_response(20);
    }

    // Error Response
    // Sent for unsupported/unknown Job function codes.
    // Error 0x8104 = "function not available".

    fn handle_error_response(self: *Connection, req: *const S7Header, func: u8, error_code: u16) void {
        const tx = &self.tx_buffer;
        proto.writeErrorResponse(tx, req.pdu_ref, func, error_code);
        self.send_response(20);
    }

    // Time Read (Userdata Response)
    // Responds with a hardcoded timestamp.

    fn handle_time_read(self: *Connection, req: *const S7Header) void {
        // Time payload: 10 bytes (BCD encoded S7 DateTime)
        //   [reserved] [year_hi] [year_lo] [month] [day] [hour] [min] [sec] [ms_hi] [ms_lo_dow]
        const time_payload = [10]u8{
            0x00, // reserved
            0x19, // Year hi (20xx)
            0x26, // Year lo (26)
            0x02, // Month 02
            0x13, // Day 13
            0x00, // Hour 00
            0x00, // Min 00
            0x00, // Sec 00
            0x00, // ms hi
            0x01, // ms lo + DOW (Friday=6 → but just 1 for now)
        };

        const data_payload_len: u16 = time_payload.len;
        const data_total_len: u16 = 4 + data_payload_len;
        const param_len: u16 = 12; // Response params are 12 bytes
        // TPKT(4) + COTP(3) + S7Header(10) + Params(12) + Data
        const tpkt_len: u16 = 4 + 3 + 10 + param_len + data_total_len;

        var tx = &self.tx_buffer;

        proto.writeTpktCotpDT(tx, tpkt_len);
        proto.writeS7HeaderShort(tx, 7, proto.Rosctr.userdata, req.pdu_ref, param_len, data_total_len);

        // Params (12 bytes at offset 17)
        proto.writeUserdataParams(
            tx,
            17,
            proto.ParamMethod.response,
            proto.FunctionGroup.time_response,
            proto.TimeSubfunction.read_clock,
            0x00,
        );

        // Data header (4 bytes at offset 29)
        proto.writeDataHeader(
            tx,
            29,
            @intFromEnum(proto.ReturnCode.success),
            @intFromEnum(proto.TransportSize.octet_string),
            data_payload_len,
        );

        // Time payload at offset 33
        @memcpy(tx[33..][0..time_payload.len], &time_payload);

        self.send_response(tpkt_len);
    }

    // Time Set (Userdata Response)
    // Simple ACK for set_plc_time.

    fn handle_time_set(self: *Connection, req: *const S7Header) void {
        // Client expects: length > 30 and param_error_code (at offset 27) == 0.
        // Minimal response: TPKT(4) + COTP(3) + S7(10) + Params(12) + DataHeader(4) = 33
        const data_total_len: u16 = 4; // Just data header, no payload
        const param_len: u16 = 12;
        const tpkt_len: u16 = 4 + 3 + 10 + param_len + data_total_len;

        const tx = &self.tx_buffer;

        proto.writeTpktCotpDT(tx, tpkt_len);
        proto.writeS7HeaderShort(tx, 7, proto.Rosctr.userdata, req.pdu_ref, param_len, data_total_len);

        proto.writeUserdataParams(
            tx,
            17,
            proto.ParamMethod.response,
            proto.FunctionGroup.time_response,
            proto.TimeSubfunction.set_clock,
            0x00,
        );

        proto.writeDataHeader(
            tx,
            29,
            @intFromEnum(proto.ReturnCode.success),
            @intFromEnum(proto.TransportSize.octet_string),
            0, // no payload
        );

        self.send_response(tpkt_len);
    }

    // Read Variable

    fn handle_read_var(self: *Connection, req: *const S7Header, params: []const u8) void {
        if (params.len < 2) {
            self.handle_error_response(req, @intFromEnum(proto.Function.read_var), @intFromEnum(ErrorCode.SERVICE_NOT_IMPLEMENTED_OR_FRAME_ERROR));
            return;
        }
        const item_count = params[1];
        if (item_count == 0 or params.len != 2 + @as(usize, item_count) * 12 or
            @as(usize, item_count) * 4 > self.pdu_limit - 14)
        {
            self.handle_error_response(req, @intFromEnum(proto.Function.read_var), @intFromEnum(ErrorCode.SERVICE_NOT_IMPLEMENTED_OR_FRAME_ERROR));
            return;
        }
        log.debug("Read Var: {} items", .{item_count});

        const tx = &self.tx_buffer;
        tx[19] = @intFromEnum(proto.Function.read_var);
        tx[20] = item_count;

        var tx_ptr: usize = 21;
        var i: usize = 0;
        while (i < item_count) : (i += 1) {
            const item = params[2 + i * 12 ..][0..12];
            self.read_var_item(item, &tx_ptr, @intCast(item_count - i - 1));
        }

        const param_len: u16 = 2;
        const data_len: u16 = @intCast(tx_ptr - 21);
        const tpkt_len: u16 = 4 + 3 + 12 + param_len + data_len;

        proto.writeTpktCotpDT(tx, tpkt_len);
        proto.writeS7Header(tx, 7, proto.Rosctr.ack_data, req.pdu_ref, param_len, data_len, 0);

        self.send_response(tpkt_len);
    }

    fn read_var_item(self: *Connection, item: *const [12]u8, offset: *usize, remaining: u8) void {
        const budget: usize = 7 + @as(usize, self.pdu_limit);
        const reserved: usize = @as(usize, remaining) * 4;
        assert(offset.* >= 21);
        assert(offset.* + 4 + reserved <= budget);
        const tx = &self.tx_buffer;
        if (!std.mem.eql(u8, item[0..3], &.{ 0x12, 10, 0x10 })) {
            self.ptr_fill_error(tx, offset, @intFromEnum(proto.ReturnCode.invalid_address));
            return;
        }
        const length = std.mem.readInt(u16, item[4..6], .big);
        const padding: usize = if (remaining > 0) length % 2 else 0;
        if (@as(usize, length) + padding > budget - offset.* - 4 - reserved) {
            self.ptr_fill_error(tx, offset, @intFromEnum(proto.ReturnCode.data_type_inconsistent));
            return;
        }
        const db = std.mem.readInt(u16, item[6..8], .big);
        const address = (@as(u32, item[9]) << 16) | (@as(u32, item[10]) << 8) | item[11];
        const bytes = self.storage.get_address(item[8], db, address >> 3, length) catch {
            self.ptr_fill_error(tx, offset, @intFromEnum(proto.ReturnCode.invalid_address));
            return;
        };
        if (bytes.len != length) {
            self.ptr_fill_error(tx, offset, @intFromEnum(proto.ReturnCode.invalid_address));
            return;
        }
        proto.writeDataHeader(tx, offset.*, 0xff, 4, @intCast(@as(u32, length) * 8));
        @memcpy(tx[offset.* + 4 ..][0..length], bytes);
        offset.* += 4 + @as(usize, length);
        if (padding == 1) {
            tx[offset.*] = 0;
            offset.* += 1;
        }
        assert(offset.* + reserved <= budget);
    }

    fn ptr_fill_error(self: *Connection, tx: []u8, tx_ptr: *usize, code: u8) void {
        _ = self;
        assert(tx_ptr.* <= tx.len);
        assert(tx.len - tx_ptr.* >= 4);
        tx[tx_ptr.*] = code;
        tx[tx_ptr.* + 1] = 0; // transport size
        tx[tx_ptr.* + 2] = 0; // len
        tx[tx_ptr.* + 3] = 0; // len
        tx_ptr.* += 4;
    }

    // Write Variable

    fn handle_write_var(self: *Connection, req: *const S7Header, params: []const u8, data: []const u8) void {
        if (10 + params.len + data.len > self.pdu_limit) {
            self.handle_error_response(req, 5, 0x0112);
            return;
        }
        const plan = variable_write.parse(params, data) catch {
            self.handle_error_response(req, 5, 0x0112);
            return;
        };
        self.storage.lock() catch {
            self.handle_error_response(req, 5, 0x8301);
            return;
        };
        defer self.storage.unlock();
        const tx = &self.tx_buffer;
        for (plan.items[0..plan.count], 0..) |*item, index| tx[21 + index] = self.write_var_item(item);
        const length: u16 = @intCast(21 + plan.count);
        proto.writeTpktCotpDT(tx, length);
        proto.writeS7Header(tx, 7, proto.Rosctr.ack_data, req.pdu_ref, 2, @intCast(plan.count), 0);
        tx[19] = 5;
        tx[20] = @intCast(plan.count);
        self.send_response(length);
    }

    fn write_var_item(self: *Connection, item: *const variable_write.Item) u8 {
        if (item.result != 0xff) return item.result;
        const byte_offset = item.address >> 3;
        const length: u32 = @intCast(item.bytes.len);
        // Each mapped area and each DB has its own 64 KiB boundary.
        if (byte_offset > Storage.DB_SIZE or length > Storage.DB_SIZE - byte_offset) return 5;
        if (item.area == 0x84 and item.db >= self.storage.max_dbs) return 0x0a;
        const target = self.storage.get_address(item.area, item.db, byte_offset, length) catch return 5;
        if (target.len != item.bytes.len) return 5;
        if (item.bit) {
            assert(target.len == 1);
            assert(item.bytes[0] <= 1);
            const mask = @as(u8, 1) << @as(u3, @intCast(item.address & 7));
            if (item.bytes[0] == 1) target[0] |= mask else target[0] &= ~mask;
        } else {
            @memcpy(target, item.bytes);
        }
        return 0xff;
    }

    // Send / Close

    fn send_response(self: *Connection, len: usize) void {
        if (self.closed) return;
        if (len < 7 or len > self.tx_buffer.len) {
            self.close();
            return;
        }
        log.debug("TX: {any}", .{std.fmt.fmtSliceHexLower(self.tx_buffer[0..len])});
        self.send_queue.push(self.tx_buffer[0..len]) catch {
            self.close();
            return;
        };
        self.send_next();
    }

    fn send_next(self: *Connection) void {
        if (self.closed or self.write_pending) return;
        const bytes = self.send_queue.pending() orelse return;
        self.write_pending = true;
        self.pending_ops += 1;
        self.io.send(
            *Connection,
            self,
            on_send,
            &self.write_completion,
            self.socket,
            bytes,
        );
    }

    fn on_send(self: *Connection, completion: *IO.Completion, result: IO.SendError!usize) void {
        _ = completion;
        assert(self.write_pending);
        self.write_pending = false;
        assert(self.pending_ops > 0);
        self.pending_ops -= 1;
        if (self.closed) return;
        const length = result catch |err| {
            log.err("Send error: {}", .{err});
            self.close();
            return;
        };
        self.send_queue.advance(length) catch {
            self.close();
            return;
        };
        self.send_next();
        self.start_read_header();
    }

    pub fn close(self: *Connection) void {
        if (self.closed) return;
        self.closed = true;
        self.alarm_subscribed = false;
        fire_event(4, "client_disconnected");
        // io_uring holds a socket reference while recv is pending. Closing only the
        // descriptor would leave that read alive; shutdown makes it complete first.
        std.posix.shutdown(self.socket, .both) catch {};
        if (builtin.os.tag == .windows) {
            _ = std.os.windows.ws2_32.closesocket(self.socket);
        } else {
            std.posix.close(self.socket);
        }
    }
};
