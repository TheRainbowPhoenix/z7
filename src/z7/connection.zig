const std = @import("std");
const vsr = @import("vsr");
const IO = vsr.io.IO;
const Storage = @import("storage.zig").Storage;
const Standard = @import("protocol.zig").Standard;
const TPKT = @import("protocol.zig").TPKT;
const S7Header = @import("protocol.zig").S7Header;

const log = std.log.scoped(.connection);

pub const Connection = struct {
    io: *IO,
    storage: *Storage,
    socket: std.posix.socket_t,

    // Message Buffers
    // Max S7 PDU is usually small (240-960 bytes), but ISO-on-TCP can be up to 64KB.
    // We'll allocate a reasonable buffer.
    rx_buffer: [4096]u8 align(4) = undefined,
    tx_buffer: [4096]u8 align(4) = undefined,

    // IO Completions
    read_completion: IO.Completion = undefined,
    write_completion: IO.Completion = undefined,
    close_completion: IO.Completion = undefined,

    // State
    closed: bool = false,

    pub fn init(io: *IO, storage: *Storage, socket: std.posix.socket_t) Connection {
        return .{
            .io = io,
            .storage = storage,
            .socket = socket,
        };
    }

    pub fn start(self: *Connection) void {
        self.start_read_header();
    }

    fn start_read_header(self: *Connection) void {
        if (self.closed) return;

        // Read TPKT Header (4 bytes)
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
            // TODO: Handle fragmentation properly, for now assume complete header read.
            log.err("Incomplete TPKT header", .{});
            self.close();
            return;
        }

        const tpkt = @as(*const TPKT, @ptrCast(self.rx_buffer[0..4].ptr));
        if (tpkt.version != 3) {
            log.err("Invalid TPKT version: {}", .{tpkt.version});
            self.close();
            return;
        }

        val_tpkt(self, std.mem.bigToNative(u16, tpkt.length));
    }

    fn val_tpkt(self: *Connection, length: u16) void {
        if (length > self.rx_buffer.len) {
            log.err("Packet too large: {}", .{length});
            self.close();
            return;
        }

        // Read rest of the packet
        const remaining = length - 4;
        if (remaining == 0) {
            // Is this possible?
            self.start_read_header();
            return;
        }

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
        const bytes_read = result catch |err| {
            log.err("Body receive error: {}", .{err});
            self.close();
            return;
        };

        if (bytes_read == 0) {
            self.close();
            return;
        }

        // Helper to re-access length from buffer
        const tpkt = @as(*const TPKT, @ptrCast(self.rx_buffer[0..4].ptr));
        const total_len = std.mem.bigToNative(u16, tpkt.length);

        // Process the PDU
        self.process_pdu(self.rx_buffer[0..total_len]);
    }

    fn process_pdu(self: *Connection, data: []u8) void {
        // Simple Parser
        // 0..4: TPKT
        // 4..x: COTP
        // x..y: S7 PDU

        if (data.len < 5) {
            self.close();
            return;
        }

        const cotp_len = data[4];
        const pdu_offset = 5 + cotp_len;

        if (data.len <= pdu_offset) {
            // Could be CR (Connect Request) which has no S7 PDU usually, or just parameters
            // Check COTP PDU Type
            const pdu_type = data[5];
            if (pdu_type == Standard.COTP_CONNECT_REQUEST) {
                self.handle_connect_request(data);
                return;
            }
            self.close(); // Unknown or malformed
            return;
        }

        const s7_data = data[pdu_offset..];
        self.handle_s7(s7_data);
    }

    fn handle_connect_request(self: *Connection, data: []u8) void {
        // Echo back a CC (Connect Confirm)
        // Dummy implementation: Copy input and change type to CC (0xD0)
        // Usually we need to negotiate, but let's just accept everything.

        @memcpy(self.tx_buffer[0..data.len], data);
        self.tx_buffer[5] = Standard.COTP_CONNECT_CONFIRM;

        self.send_response(data.len);
    }

    fn handle_s7(self: *Connection, data: []u8) void {
        if (data.len < 10) {
            self.close();
            return;
        }

        // Copy header to align(2) local variable
        const header = std.mem.bytesToValue(S7Header, data[0..@sizeOf(S7Header)]);

        const proto_id = header.proto_id;
        if (proto_id != 0x32) {
            self.close();
            return;
        }

        const rosctr = header.rosctr;
        // ROSCTR: 1=Job
        if (rosctr == 1) {
            // Handle Job
            // Parse Parameters
            const param_len = std.mem.bigToNative(u16, header.param_len);
            const data_len = std.mem.bigToNative(u16, header.data_len);

            if (10 + param_len + data_len > data.len) {
                self.close();
                return;
            }

            const params = data[10..][0..param_len];

            if (params.len > 0) {
                const func = params[0];
                if (func == 0xF0) { // Setup Comm
                    self.handle_setup_comm(&header);
                    return;
                } else if (func == 0x04) { // Read Var
                    self.handle_read_var(&header, params);
                    return;
                } else if (func == 0x05) { // Write Var
                    self.handle_write_var(&header, params, data[10 + param_len ..][0..data_len]);
                    return;
                }
            }
        }

        // Fallback: Return Error? or Just Ignore
        self.start_read_header();
    }

    fn handle_setup_comm(self: *Connection, req: *const S7Header) void {
        // Respond with Ack_Data (3)
        // We construct a simple response.
        // TPKT + COTP + S7 Header + Param + Data

        // 1. TPKT (4 bytes)
        // 2. COTP (3 bytes: len=2, pdu=F0 (Data), LastUnit=80)
        // 3. S7 Header (12 bytes for Ack_Data)
        // 4. Param (Setup Comm Response = 8 bytes)
        // 5. Data (0 bytes)

        const tpkt_len = 4 + 3 + 12 + 8 + 0;

        var ptr = &self.tx_buffer;
        // TPKT
        ptr[0] = 3;
        ptr[1] = 0;
        ptr[2] = @intCast((tpkt_len >> 8) & 0xFF);
        ptr[3] = @intCast(tpkt_len & 0xFF);

        // COTP (Data)
        ptr[4] = 2; // LI
        ptr[5] = 0xF0; // DT
        ptr[6] = 0x80; // EOT

        // S7 Header
        ptr[7] = 0x32; // Proto
        ptr[8] = 0x03; // ROSCTR = Ack_Data
        ptr[9] = 0x00;
        ptr[10] = 0x00; // Reserved
        ptr[11] = @intCast(req.pdu_ref >> 8); // PDU Ref
        ptr[12] = @intCast(req.pdu_ref & 0xFF);
        ptr[13] = 0x00;
        ptr[14] = 0x08; // Param Len = 8
        ptr[15] = 0x00;
        ptr[16] = 0x00; // Data Len = 0
        ptr[17] = 0x00;
        ptr[18] = 0x00; // Error = 0

        // Setup Comm Params (Negotiated)
        // F0 00 MaxAmqCaller MaxAmqCallee PduLength(2)
        const params = ptr[19..];
        params[0] = 0xF0;
        params[1] = 0x00;
        params[2] = 0x00;
        params[3] = 0x01; // MaxAmqCaller
        params[4] = 0x00;
        params[5] = 0x01; // MaxAmqCallee
        params[6] = 0x03;
        params[7] = 0xC0; // PDU Length = 960 (Big Endian)

        self.send_response(tpkt_len);
    }

    fn handle_read_var(self: *Connection, req: *const S7Header, params: []const u8) void {
        const item_count = params[1];
        // We only support reading 1 item for simplicity in this PoC
        if (item_count < 1) {
            self.close();
            return;
        }

        // Item Request Parsing (Starts at params[2])
        // 12 0A 10 [Unit] [Len] [DB] [Area] [Addr]
        // 0  1  2   3      4..5  6..7  8      9..11
        if (params.len < 14) {
            self.close();
            return;
        }

        const offset = 2;
        const db = std.mem.readInt(u16, params[offset + 6 .. offset + 8], .big);
        const area = params[offset + 8];
        const len_header = std.mem.readInt(u16, params[offset + 4 .. offset + 6], .big);
        const addr_bytes = params[offset + 9 .. offset + 12];
        const addr = (@as(u32, addr_bytes[0]) << 16) | (@as(u32, addr_bytes[1]) << 8) | @as(u32, addr_bytes[2]);

        // Byte address
        const start_byte = addr >> 3;

        // Read from Storage
        // TODO: Handle types/lengths correctly. Assuming byte access for simplicity.
        var data_buffer: [1024]u8 = undefined;
        const read_slice = self.storage.get_address(area, db, start_byte, len_header) catch {
            // Send Error Code
            // TODO: Construct error response
            self.close(); // For now fail hard
            return;
        };
        @memcpy(data_buffer[0..read_slice.len], read_slice);

        // Construct Read Var Response
        // TPKT(4) + COTP(3) + Header(12) + Param(2) + DataHeader(4) + Data(N)
        // Param: 04 [ItemCount]
        // DataItem: FF 04 [Len*8] [Data]

        const data_len: u16 = @intCast(4 + read_slice.len);
        const tpkt_len = 4 + 3 + 12 + 2 + data_len;

        var ptr = &self.tx_buffer;
        // TPKT...
        ptr[0] = 3;
        ptr[1] = 0;
        ptr[2] = @intCast((tpkt_len >> 8) & 0xFF);
        ptr[3] = @intCast(tpkt_len & 0xFF);

        // COTP
        ptr[4] = 2;
        ptr[5] = 0xF0;
        ptr[6] = 0x80;

        // Header
        ptr[7] = 0x32;
        ptr[8] = 0x03;
        ptr[9] = 0x00;
        ptr[10] = 0x00;
        ptr[11] = @intCast(req.pdu_ref >> 8);
        ptr[12] = @intCast(req.pdu_ref & 0xFF);
        ptr[13] = 0x00;
        ptr[14] = 0x02; // ParamLen=2
        ptr[15] = @intCast(data_len >> 8);
        ptr[16] = @intCast(data_len & 0xFF);
        ptr[17] = 0x00;
        ptr[18] = 0x00; // No Error

        // Param
        ptr[19] = 0x04;
        ptr[20] = 0x01;

        // Data Item
        ptr[21] = 0xFF; // Return Code = Success
        ptr[22] = 0x04; // Transport = Octet
        // Length in Bits
        const bits = read_slice.len * 8;
        ptr[23] = @intCast((bits >> 8) & 0xFF);
        ptr[24] = @intCast(bits & 0xFF);

        @memcpy(ptr[25..][0..read_slice.len], read_slice);

        self.send_response(tpkt_len);
    }

    fn handle_write_var(self: *Connection, req: *const S7Header, params: []const u8, data: []const u8) void {
        // Parsing params similar to Read
        const offset = 2;
        if (params.len < 14) {
            self.close();
            return;
        }

        const db = std.mem.readInt(u16, params[offset + 6 .. offset + 8], .big);
        const area = params[offset + 8];
        // const len_header = std.mem.readInt(u16, params[offset+4..offset+6], .big); // Length in elements
        const addr_bytes = params[offset + 9 .. offset + 12];
        const addr = (@as(u32, addr_bytes[0]) << 16) | (@as(u32, addr_bytes[1]) << 8) | @as(u32, addr_bytes[2]);
        const start_byte = addr >> 3;

        // Parsing Data Payload
        if (data.len < 4) {
            self.close();
            return;
        }
        const return_code = data[0];
        _ = return_code;
        const transport_size = data[1]; // 04=Byte
        _ = transport_size;
        const length_bits = std.mem.readInt(u16, data[2..4], .big);
        const length_bytes = length_bits / 8;

        if (data.len < 4 + length_bytes) {
            self.close();
            return;
        }
        const write_data = data[4..][0..length_bytes];

        // Write to Storage
        self.storage.lock() catch {}; // Try lock
        defer self.storage.unlock();

        const target_slice = self.storage.get_address(area, db, start_byte, @intCast(length_bytes)) catch {
            self.close();
            return;
        };
        @memcpy(target_slice, write_data);

        // Construct Write Response (Empty Data, just confirm)
        // Header + Param(04 01) + Data(FF)

        const tpkt_len = 4 + 3 + 12 + 2 + 1;
        var ptr = &self.tx_buffer;
        // Same Header as Read...
        // Just minimal response for PoC
        ptr[0] = 3;
        ptr[1] = 0;
        ptr[2] = @intCast((tpkt_len >> 8) & 0xFF);
        ptr[3] = @intCast(tpkt_len & 0xFF);
        ptr[4] = 2;
        ptr[5] = 0xF0;
        ptr[6] = 0x80;
        ptr[7] = 0x32;
        ptr[8] = 0x03;
        ptr[9] = 0x00;
        ptr[10] = 0x00;
        ptr[11] = @intCast(req.pdu_ref >> 8);
        ptr[12] = @intCast(req.pdu_ref & 0xFF);
        ptr[13] = 0x00;
        ptr[14] = 0x02;
        ptr[15] = 0x00;
        ptr[16] = 0x01; // Data Len = 1 (Result code)
        ptr[17] = 0x00;
        ptr[18] = 0x00;
        ptr[19] = 0x05;
        ptr[20] = 0x01; // Write Var (1 item)
        ptr[21] = 0xFF; // Success Code for Item 1

        self.send_response(tpkt_len);
    }

    fn send_response(self: *Connection, len: usize) void {
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
        _ = result catch |err| {
            log.err("Send error: {}", .{err});
            self.close();
            return;
        };

        // Loop back to read next request
        self.start_read_header();
    }

    pub fn close(self: *Connection) void {
        if (self.closed) return;
        self.closed = true;
        // Close socket via IO if IO has a close method, or posix
        // IO.close uses queue but passing socket_t.
        // Or directly close using posix if not using io completions for close.
        // vsr.io usually has clean shutdown.
        std.posix.close(self.socket);
    }
};
