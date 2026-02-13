const std = @import("std");
const builtin = @import("builtin");
const zCom = @import("zCom");
const IO = zCom.io.IO;
const Storage = @import("storage.zig").Storage;
const proto = @import("protocol.zig");
const firmware = @import("firmware.zig");
const types = @import("types.zig");
const TPKT = proto.TPKT;
const S7Header = proto.S7Header;

const log = std.log.scoped(.connection);

pub const Connection = struct {
    io: *IO,
    storage: *Storage,
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

    pub fn init(io: *IO, storage: *Storage, socket: std.posix.socket_t) Connection {
        return .{
            .io = io,
            .storage = storage,
            .socket = socket,
            .closed = true,
        };
    }

    pub fn reset(self: *Connection, socket: std.posix.socket_t) void {
        self.socket = socket;
        self.closed = false;
        self.pending_ops = 0;
        // Completions are reused and will be overwritten by submit()
    }

    pub fn start(self: *Connection) void {
        self.start_read_header();
    }

    // ── Read pipeline ────────────────────────────────────────────────────

    fn start_read_header(self: *Connection) void {
        if (self.closed) return;
        self.pending_ops += 1;
        self.io.recv(
            *Connection,
            self,
            on_read_header,
            &self.read_completion,
            self.socket,
            self.rx_buffer[0..4],
        );
    }

    fn on_read_header(self: *Connection, completion: *IO.Completion, result: IO.RecvError!usize) void {
        _ = completion;
        self.pending_ops -= 1;
        const bytes_read = result catch |err| {
            log.err("Receive error: {}", .{err});
            self.close();
            return;
        };

        if (bytes_read == 0) {
            self.close();
            return;
        }

        if (bytes_read < 4) {
            log.err("Incomplete TPKT header", .{});
            self.close();
            return;
        }

        const tpkt = std.mem.bytesToValue(TPKT, self.rx_buffer[0..@sizeOf(TPKT)]);
        if (tpkt.version != proto.tpkt_version) {
            log.err("Invalid TPKT version: {}", .{tpkt.version});
            self.close();
            return;
        }

        self.read_body(std.mem.bigToNative(u16, tpkt.length));
    }

    fn read_body(self: *Connection, length: u16) void {
        if (length > self.rx_buffer.len) {
            log.err("Packet too large: {}", .{length});
            self.close();
            return;
        }
        const remaining = length - 4;
        if (remaining == 0) {
            self.start_read_header();
            return;
        }
        self.pending_ops += 1;
        self.io.recv(
            *Connection,
            self,
            on_read_body,
            &self.read_completion,
            self.socket,
            self.rx_buffer[4..length],
        );
    }

    fn on_read_body(self: *Connection, completion: *IO.Completion, result: IO.RecvError!usize) void {
        _ = completion;
        self.pending_ops -= 1;
        const bytes_read = result catch |err| {
            log.err("Body receive error: {}", .{err});
            self.close();
            return;
        };
        if (bytes_read == 0) {
            self.close();
            return;
        }

        const tpkt = std.mem.bytesToValue(TPKT, self.rx_buffer[0..@sizeOf(TPKT)]);
        const total_len = std.mem.bigToNative(u16, tpkt.length);

        log.info("RX: {any}", .{std.fmt.fmtSliceHexLower(self.rx_buffer[0..total_len])});
        self.process_pdu(self.rx_buffer[0..total_len]);
    }

    // ── COTP / S7 dispatch ───────────────────────────────────────────────

    fn process_pdu(self: *Connection, data: []u8) void {
        if (data.len < 5) {
            self.close();
            return;
        }

        const cotp_len = data[4];
        const pdu_offset = 5 + cotp_len;

        if (data.len <= pdu_offset) {
            // Short packet – might be a COTP-only message (CR, DR, …)
            const pdu_type = data[5];
            if (pdu_type == proto.Cotp.connect_request) {
                self.handle_connect_request(data);
                return;
            }
            log.err("Unknown COTP PDU Type or short packet: 0x{x}", .{pdu_type});
            self.close();
            return;
        }

        self.handle_s7(data[pdu_offset..]);
    }

    // ── COTP Connection ──────────────────────────────────────────────────

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
        tx[4] = 17; // Length indicator (18 bytes – 1)
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

    // ── S7 Dispatch ──────────────────────────────────────────────────────

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
        const param_len = header.param_len;
        const data_len = header.data_len;

        if (10 + param_len + data_len > data.len) {
            self.close();
            return false; // considered handled as we closed, but no response was sent
        }

        const params = data[10..][0..param_len];
        if (params.len == 0) return false;

        const func: proto.Function = @enumFromInt(params[0]);
        switch (func) {
            .setup_comm => {
                self.handle_setup_comm(header);
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
                self.handle_plc_control(header, @intFromEnum(proto.Function.plc_stop));
                return true;
            },
            .plc_control => {
                log.info("PLC Control request (start)", .{});
                self.handle_plc_control(header, @intFromEnum(proto.Function.plc_control));
                return true;
            },
            else => {
                log.warn("Unhandled Job function: 0x{x}", .{params[0]});
                self.handle_error_response(header, params[0], 0x8104);
                return true;
            },
        }
    }

    fn dispatch_userdata(self: *Connection, header: *const S7Header, data: []u8) bool {
        const param_len = header.param_len;
        const data_len = header.data_len;

        // Our S7Header is 10 bytes. Some clients (e.g. raw scripts) may send
        // a 12-byte header with an extra 2-byte error/reserved field.
        // We detect this by checking for the params head marker (00 01 12)
        // at offset 10 (standard) and offset 12 (extended header).
        var params_off: usize = 10;
        if (data.len >= 15 and data[10] == 0x00 and data[11] == 0x01 and data[12] == 0x12) {
            params_off = 10;
        } else if (data.len >= 17 and data[12] == 0x00 and data[13] == 0x01 and data[14] == 0x12) {
            // Client sent 12-byte S7 header — params shifted by 2
            params_off = 12;
        }

        if (params_off + param_len + data_len > data.len) {
            self.close();
            return true;
        }

        const params = data[params_off..][0..param_len];
        const payload = data[params_off + param_len ..][0..data_len];

        // Params layout: [Head(3)] [Len(1)] [Method(1)] [Tg(1)] [SubFunc(1)] [Seq(1)]
        // Tg byte = (type << 4 | group) — e.g. 0x44 = type 4 (request) + group 4 (SZL)
        if (params.len < 8) {
            log.warn("Userdata params too short: {}", .{params.len});
            return false;
        }

        const tg = params[5]; // type_group combined byte
        const sub_func = params[6];
        const func_group = tg & 0x0F; // lower nibble = group

        if (func_group == 0x04) { // SZL (CPU functions)  proto.FunctionGroup.cpu_request
            if (sub_func == proto.CpuSubfunction.read_szl) {
                // SZL Read — extract ID and Index from data payload
                if (payload.len >= 8) {
                    const szl_id = std.mem.readInt(u16, payload[4..6], .big);
                    const szl_index = std.mem.readInt(u16, payload[6..8], .big);
                    log.info("SZL Read: id=0x{x:0>4} index=0x{x:0>4}", .{ szl_id, szl_index });
                    self.handle_szl_read(header, szl_id, szl_index);
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

    // ── Setup Communication ──────────────────────────────────────────────

    fn handle_setup_comm(self: *Connection, req: *const S7Header) void {
        // TPKT(4) + COTP(3) + S7 Header(12) + Param(8) = 27
        const tpkt_len: u16 = 4 + 3 + 12 + 8;
        var tx = &self.tx_buffer;

        proto.writeTpktCotpDT(tx, tpkt_len);
        proto.writeS7Header(tx, 7, proto.Rosctr.ack_data, req.pdu_ref, 8, 0, 0);

        // Setup Comm response params: F0 00 [AmqCall(2)] [AmqCalled(2)] [PduLen(2)]
        const p = tx[19..];
        p[0] = @intFromEnum(proto.Function.setup_comm); // 0xF0
        p[1] = 0x00;
        proto.writeBE16(p, 2, 1); // MaxAmQ calling
        proto.writeBE16(p, 4, 1); // MaxAmQ called
        proto.writeBE16(p, 6, 960); // PDU length

        self.send_response(tpkt_len);
    }

    // ── SZL Read (Userdata Response) ─────────────────────────────────────
    // Uses firmware.lookup() for table-driven SZL response data.

    fn handle_szl_read(self: *Connection, req: *const S7Header, szl_id: u16, szl_index: u16) void {
        // Look up pre-built firmware data for this SZL ID + Index.
        // The blob already contains: ReturnCode(1) TransportSize(1) DataLen(2) + SZL payload.
        const blob = firmware.lookup(szl_id, szl_index);
        const blob_len: u16 = @intCast(blob.len);

        const param_len: u16 = 12; // Response params are 12 bytes
        // TPKT(4) + COTP(3) + S7Header(10) + Params(12) + Blob
        const tpkt_len: u16 = 4 + 3 + 10 + param_len + blob_len;

        const tx = &self.tx_buffer;

        proto.writeTpktCotpDT(tx, tpkt_len);
        // Userdata uses 10-byte S7 header (no error field)
        proto.writeS7HeaderShort(tx, 7, proto.Rosctr.userdata, req.pdu_ref, param_len, blob_len);

        // Params (12 bytes at offset 17 = 7 + 10)
        proto.writeUserdataParams(
            tx,
            17,
            proto.ParamMethod.response,
            proto.FunctionGroup.cpu_response,
            proto.CpuSubfunction.read_szl,
            0x00,
        );

        // Firmware blob at offset 29 = 17 + 12
        // (blob includes data header: ReturnCode + TransportSize + DataLen + SZL payload)
        @memcpy(tx[29..][0..blob.len], blob);

        self.send_response(tpkt_len);
    }

    // ── Security (Password) ──────────────────────────────────────────────
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

    // ── Block Info ───────────────────────────────────────────────────────
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

    // ── PLC Control (Stop / Start) ──────────────────────────────────────
    // ACK for plc_stop (0x29) and plc_control (0x28, start).
    // Response: TPKT(4) + COTP(3) + S7Header(12) + Param(1) = 20.

    fn handle_plc_control(self: *Connection, req: *const S7Header, func: u8) void {
        const tx = &self.tx_buffer;
        proto.writePlcControlResponse(tx, req.pdu_ref, func);
        self.send_response(20);
    }

    // ── Error Response ──────────────────────────────────────────────────
    // Sent for unsupported/unknown Job function codes.
    // Error 0x8104 = "function not available".

    fn handle_error_response(self: *Connection, req: *const S7Header, func: u8, error_code: u16) void {
        const tx = &self.tx_buffer;
        proto.writeErrorResponse(tx, req.pdu_ref, func, error_code);
        self.send_response(20);
    }

    // ── Time Read (Userdata Response) ────────────────────────────────────
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

    // ── Time Set (Userdata Response) ─────────────────────────────────────
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

    // ── Read Variable ────────────────────────────────────────────────────

    fn handle_read_var(self: *Connection, req: *const S7Header, params: []const u8) void {
        const item_count = params[1];
        log.info("Read Var: {} items", .{item_count});

        var tx = &self.tx_buffer;
        // S7 Header (12 bytes for ack_data) + Param Header (2 bytes: function, count) = 14
        // Param Header starts at byte 19 (TPKT 4 + COTP 3 + S7 12)

        // Write Param Header
        tx[19] = @intFromEnum(proto.Function.read_var);
        tx[20] = item_count;

        var param_ptr: usize = 2; // skip function, count
        var tx_ptr: usize = 21;

        var i: usize = 0;
        while (i < item_count) : (i += 1) {
            if (param_ptr + 12 > params.len) break;
            const item_params = params[param_ptr..][0..12];

            const db = std.mem.readInt(u16, item_params[6..8], .big);
            const area = item_params[8];
            const len_header = std.mem.readInt(u16, item_params[4..6], .big);
            const addr_bytes = item_params[9..12];
            const addr = (@as(u32, addr_bytes[0]) << 16) | (@as(u32, addr_bytes[1]) << 8) | @as(u32, addr_bytes[2]);
            const start_byte = addr >> 3;

            log.info("  Item {}: area=0x{x} db={} start={} len={}", .{ i, area, db, start_byte, len_header });

            var data_buffer: [8192]u8 = undefined;
            const read_slice = self.storage.get_address(area, db, start_byte, len_header) catch |err| {
                log.err("Storage read failed for item {}: {}", .{ i, err });
                self.ptr_fill_error(tx, &tx_ptr, 0x05); // Invalid address or similar
                param_ptr += 12;
                continue;
            };

            const response_len = len_header;
            @memset(data_buffer[0..@min(8192, response_len)], 0);
            const actual_copy = @min(read_slice.len, response_len);
            const safe_copy = @min(actual_copy, 8192);
            @memcpy(data_buffer[0..safe_copy], read_slice[0..safe_copy]);

            // Data Item
            tx[tx_ptr] = @intFromEnum(proto.ReturnCode.success);
            tx[tx_ptr + 1] = @intFromEnum(proto.TransportSize.byte_word_dword);
            const bits: u16 = @intCast(response_len * 8);
            proto.writeBE16(tx, tx_ptr + 2, bits);
            @memcpy(tx[tx_ptr + 4 ..][0..response_len], data_buffer[0..response_len]);

            tx_ptr += 4 + response_len;
            param_ptr += 12;

            // Align to 2 bytes if more items coming
            if (i + 1 < item_count and tx_ptr % 2 != 0) {
                tx[tx_ptr] = 0;
                tx_ptr += 1;
            }
        }

        const param_len: u16 = 2;
        const data_len: u16 = @intCast(tx_ptr - 21);
        const tpkt_len: u16 = 4 + 3 + 12 + param_len + data_len;

        proto.writeTpktCotpDT(tx, tpkt_len);
        proto.writeS7Header(tx, 7, proto.Rosctr.ack_data, req.pdu_ref, param_len, data_len, 0);

        self.send_response(tpkt_len);
    }

    fn ptr_fill_error(self: *Connection, tx: []u8, tx_ptr: *usize, code: u8) void {
        _ = self;
        tx[tx_ptr.*] = code;
        tx[tx_ptr.* + 1] = 0; // transport size
        tx[tx_ptr.* + 2] = 0; // len
        tx[tx_ptr.* + 3] = 0; // len
        tx_ptr.* += 4;
    }

    // ── Write Variable ───────────────────────────────────────────────────

    fn handle_write_var(self: *Connection, req: *const S7Header, params: []const u8, data: []const u8) void {
        if (params.len < 14) {
            self.close();
            return;
        }

        const offset = 2;
        const db = std.mem.readInt(u16, params[offset + 6 .. offset + 8], .big);
        const area = params[offset + 8];
        const addr_bytes = params[offset + 9 .. offset + 12];
        const addr = (@as(u32, addr_bytes[0]) << 16) | (@as(u32, addr_bytes[1]) << 8) | @as(u32, addr_bytes[2]);
        const start_byte = addr >> 3;

        if (data.len < 4) {
            self.close();
            return;
        }
        const length_bits = std.mem.readInt(u16, data[2..4], .big);
        const length_bytes = length_bits / 8;

        if (data.len < 4 + length_bytes) {
            self.close();
            return;
        }
        const write_data = data[4..][0..length_bytes];

        self.storage.lock() catch {};
        defer self.storage.unlock();

        const target_slice = self.storage.get_address(area, db, start_byte, @intCast(length_bytes)) catch {
            self.close();
            return;
        };
        @memcpy(target_slice, write_data);

        // TPKT(4) + COTP(3) + Header(12) + Param(2) + Data(1) = 22
        const tpkt_len: u16 = 4 + 3 + 12 + 2 + 1;
        var tx = &self.tx_buffer;

        proto.writeTpktCotpDT(tx, tpkt_len);
        proto.writeS7Header(tx, 7, proto.Rosctr.ack_data, req.pdu_ref, 2, 1, 0);

        tx[19] = @intFromEnum(proto.Function.write_var);
        tx[20] = 0x01;
        tx[21] = @intFromEnum(proto.ReturnCode.success);

        self.send_response(tpkt_len);
    }

    // ── Send / Close ─────────────────────────────────────────────────────

    fn send_response(self: *Connection, len: usize) void {
        log.info("TX: {any}", .{std.fmt.fmtSliceHexLower(self.tx_buffer[0..len])});
        self.pending_ops += 1;
        self.io.send(
            *Connection,
            self,
            on_send,
            &self.write_completion,
            self.socket,
            self.tx_buffer[0..len],
        );
    }

    fn on_send(self: *Connection, completion: *IO.Completion, result: IO.SendError!usize) void {
        _ = completion;
        self.pending_ops -= 1;
        _ = result catch |err| {
            log.err("Send error: {}", .{err});
            self.close();
            return;
        };
        self.start_read_header();
    }

    pub fn close(self: *Connection) void {
        if (self.closed) return;
        self.closed = true;
        if (builtin.os.tag == .windows) {
            _ = std.os.windows.ws2_32.closesocket(self.socket);
        } else {
            std.posix.close(self.socket);
        }
    }
};
