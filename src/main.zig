const std = @import("std");
const mem = std.mem;
const net = std.net;
const os = std.os;

// --- Shared Memory Configuration ---
const SHM_NAME = "s7_plc_shm";
// Memory Map Offsets
const OFFSET_INPUTS: usize = 0;
const OFFSET_OUTPUTS: usize = 65536;
const OFFSET_MERKERS: usize = 131072;
const OFFSET_TIMERS: usize = 196608;
const OFFSET_COUNTERS: usize = 262144;
const OFFSET_DB_START: usize = 327680;
const DB_SIZE: usize = 65536;
const MAX_DBS: usize = 128;
const TOTAL_SIZE: usize = OFFSET_DB_START + (MAX_DBS * DB_SIZE);

// --- Windows API Definitions ---
const DWORD = u32;
const HANDLE = *anyopaque;
const INVALID_HANDLE_VALUE = @as(HANDLE, @ptrFromInt(@as(usize, @bitCast(@as(isize, -1)))));
const GENERIC_READ: DWORD = 0x80000000;
const GENERIC_WRITE: DWORD = 0x40000000;
const FILE_SHARE_READ: DWORD = 0x00000001;
const FILE_SHARE_WRITE: DWORD = 0x00000002;
const FILE_SHARE_DELETE: DWORD = 0x00000004;
const OPEN_EXISTING: DWORD = 3;
const OPEN_ALWAYS: DWORD = 4;
const FILE_ATTRIBUTE_NORMAL: DWORD = 0x80;
const PAGE_READWRITE: DWORD = 0x04;
const FILE_MAP_ALL_ACCESS: DWORD = 0xF001F;
const WINAPI: std.builtin.CallingConvention = .winapi;

extern "kernel32" fn CreateFileW(lpFileName: [*:0]const u16, dwDesiredAccess: DWORD, dwShareMode: DWORD, lpSecurityAttributes: ?*anyopaque, dwCreationDisposition: DWORD, dwFlagsAndAttributes: DWORD, hTemplateFile: ?HANDLE) callconv(WINAPI) HANDLE;
extern "kernel32" fn CreateFileMappingW(hFile: HANDLE, lpFileMappingAttributes: ?*anyopaque, flProtect: DWORD, dwMaximumSizeHigh: DWORD, dwMaximumSizeLow: DWORD, lpName: ?[*:0]const u16) callconv(WINAPI) ?HANDLE;
extern "kernel32" fn MapViewOfFile(hFileMappingObject: HANDLE, dwDesiredAccess: DWORD, dwFileOffsetHigh: DWORD, dwFileOffsetLow: DWORD, dwNumberOfBytesToMap: usize) callconv(WINAPI) ?*anyopaque;
extern "kernel32" fn UnmapViewOfFile(lpBaseAddress: ?*anyopaque) callconv(WINAPI) i32;
extern "kernel32" fn CloseHandle(hObject: HANDLE) callconv(WINAPI) i32;

const Storage = struct {
    ptr: [*]u8,
    len: usize,

    pub fn init() !Storage {
        const path_w = std.unicode.utf8ToUtf16LeStringLiteral(SHM_NAME);
        const hFile = CreateFileW(path_w, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, null, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, null);
        if (hFile == INVALID_HANDLE_VALUE) return error.OpenFileFailed;

        const hMap = CreateFileMappingW(hFile, null, PAGE_READWRITE, 0, @as(u32, @intCast(TOTAL_SIZE)), null) orelse return error.CreateMappingFailed;
        const ptr = MapViewOfFile(hMap, FILE_MAP_ALL_ACCESS, 0, 0, TOTAL_SIZE) orelse return error.MapViewFailed;

        _ = CloseHandle(hMap);
        _ = CloseHandle(hFile);

        return Storage{ .ptr = @ptrCast(ptr), .len = TOTAL_SIZE };
    }

    pub fn get_address(self: *Storage, area: u8, db_num: u16, start: u32, len_bytes: u32) ![]u8 {
        var base: usize = 0;
        switch (area) {
            0x81 => base = OFFSET_INPUTS,
            0x82 => base = OFFSET_OUTPUTS,
            0x83 => base = OFFSET_MERKERS,
            0x84 => {
                if (db_num >= MAX_DBS) return error.OutOfBounds;
                base = OFFSET_DB_START + (@as(usize, db_num) * DB_SIZE);
            },
            else => return error.InvalidArea,
        }
        const offset = base + start;
        if (offset + len_bytes > self.len) return error.OutOfBounds;
        return self.ptr[offset..][0..len_bytes];
    }
};

fn handleClient(stream: net.Stream, storage: *Storage) !void {
    defer stream.close();
    var reader = stream.reader();
    const writer = stream.writer();
    var buffer: [4096]u8 = undefined;

    while (true) {
        const n = try reader.read(buffer[0..4]);
        if (n < 4) return;
        if (buffer[0] != 3) return;
        const packet_len = mem.readInt(u16, buffer[2..][0..2], .big);

        const needed = packet_len - 4;
        if (needed > buffer.len - 4) return;
        const n2 = try reader.readAll(buffer[4..packet_len]);
        if (n2 < needed) return;

        const packet = buffer[0..packet_len];
        try processPacket(packet, writer, storage);
    }
}

fn processPacket(packet: []u8, writer: anytype, storage: *Storage) !void {
    if (packet.len < 7) return;
    const cotp_len = packet[4];
    const pdu_type = packet[5];

    if (pdu_type == 0xE0) {
        try writer.writeAll(&[_]u8{ 0x03, 0x00, 0x00, 0x0B, 0x06, 0xD0, 0x00, 0x01, 0x00, 0x00, 0x00 });
        return;
    }

    if (pdu_type == 0xF0) {
        const s7_start = 4 + @as(usize, cotp_len) + 1;
        if (s7_start + 10 > packet.len) return;
        const s7_data = packet[s7_start..];

        if (s7_data[0] != 0x32) return;
        const rosctr = s7_data[1];
        const pdu_ref = mem.readInt(u16, s7_data[4..][0..2], .big);
        const param_len = mem.readInt(u16, s7_data[6..][0..2], .big);
        // data_len unused unless needed, ignoring but reading anyway to check structure if needed
        _ = mem.readInt(u16, s7_data[8..][0..2], .big);

        if (rosctr == 1) {
            if (s7_data.len < 10 + param_len) return;
            const params = s7_data[10 .. 10 + param_len];
            const func = params[0];

            if (func == 0xF0) {
                const total_len: u16 = 4 + 3 + 12 + 8;
                var resp: [32]u8 = undefined;
                var fbs = std.io.fixedBufferStream(&resp);
                const w = fbs.writer();

                try w.writeAll(&[_]u8{ 0x03, 0x00 });
                try w.writeInt(u16, total_len, .big);
                try w.writeAll(&[_]u8{ 0x02, 0xF0, 0x80 });
                try w.writeAll(&[_]u8{ 0x32, 0x03, 0x00, 0x00 });
                try w.writeInt(u16, pdu_ref, .big);
                try w.writeInt(u16, 8, .big);
                try w.writeInt(u16, 0, .big);
                try w.writeInt(u16, 0, .big);
                try w.writeAll(&[_]u8{ 0xF0, 0x00, 0x00, 0x01, 0x00, 0x01, 0x03, 0xC0 });

                try writer.writeAll(fbs.getWritten());
            } else if (func == 0x04) {
                const item_count = params[1];
                var read_data_len: u16 = 0;

                var req_offset: usize = 2;
                var i: u8 = 0;
                while (i < item_count) : (i += 1) {
                    if (req_offset + 12 > params.len) break;
                    const len = mem.readInt(u16, params[req_offset + 4 ..][0..2], .big);
                    read_data_len += 4;
                    read_data_len += len;
                    if (len % 2 != 0 and i < item_count - 1) {
                        read_data_len += 1;
                    }
                    req_offset += 12;
                }

                const total_size = 4 + 3 + 12 + 2 + read_data_len;
                var resp_buffer: [4096]u8 = undefined;
                var fbs = std.io.fixedBufferStream(&resp_buffer);
                const w = fbs.writer();

                try w.writeAll(&[_]u8{ 0x03, 0x00 });
                try w.writeInt(u16, @as(u16, @intCast(total_size)), .big);
                try w.writeAll(&[_]u8{ 0x02, 0xF0, 0x80 });

                try w.writeAll(&[_]u8{ 0x32, 0x03, 0x00, 0x00 });
                try w.writeInt(u16, pdu_ref, .big);
                try w.writeInt(u16, 2, .big);
                try w.writeInt(u16, read_data_len, .big);
                try w.writeInt(u16, 0, .big);

                try w.writeByte(0x04);
                try w.writeByte(item_count);

                req_offset = 2;
                i = 0;
                while (i < item_count) : (i += 1) {
                    if (req_offset + 12 > params.len) break;

                    const len_req = mem.readInt(u16, params[req_offset + 4 ..][0..2], .big);
                    const db = mem.readInt(u16, params[req_offset + 6 ..][0..2], .big);
                    const area = params[req_offset + 8];
                    const addr_raw = mem.readInt(u24, params[req_offset + 9 ..][0..3], .big);

                    const byte_start = addr_raw >> 3;

                    var data_ok = false;
                    var val_buf: [1024]u8 = undefined;
                    const read_len = if (len_req > 1024) 1024 else len_req;

                    if (storage.get_address(area, db, byte_start, read_len)) |slice| {
                        @memcpy(val_buf[0..read_len], slice);
                        data_ok = true;
                    } else |_| {
                        data_ok = false;
                    }

                    try w.writeByte(0xFF);
                    try w.writeByte(0x04);
                    try w.writeInt(u16, read_len * 8, .big);

                    if (data_ok) {
                        try w.writeAll(val_buf[0..read_len]);
                    } else {
                        try w.writeByteNTimes(0, read_len);
                    }

                    if (read_len % 2 != 0 and i < item_count - 1) {
                        try w.writeByte(0);
                    }

                    req_offset += 12;
                }

                try writer.writeAll(fbs.getWritten());
            } else if (func == 0x05) {
                const item_count = params[1];
                const req_data_start = 10 + param_len;
                if (req_data_start > s7_data.len) return;
                const req_data = s7_data[req_data_start..];

                var p_off: usize = 2;
                var d_off: usize = 0;

                var i: u8 = 0;
                while (i < item_count) : (i += 1) {
                    if (p_off + 12 > params.len) break;
                    // len_req unused? Used for checking data size maybe? Yes.
                    _ = mem.readInt(u16, params[p_off + 4 ..][0..2], .big);
                    const db = mem.readInt(u16, params[p_off + 6 ..][0..2], .big);
                    const area = params[p_off + 8];
                    const addr_raw = mem.readInt(u24, params[p_off + 9 ..][0..3], .big);
                    const byte_start = addr_raw >> 3;

                    if (d_off + 4 > req_data.len) break;
                    const d_len_bits = mem.readInt(u16, req_data[d_off + 2 ..][0..2], .big);
                    const d_len_bytes = d_len_bits / 8;

                    if (d_off + 4 + d_len_bytes > req_data.len) break;
                    const data_content = req_data[d_off + 4 .. d_off + 4 + d_len_bytes];

                    if (storage.get_address(area, db, byte_start, d_len_bytes)) |slice| {
                        @memcpy(slice, data_content);
                    } else |_| {}

                    p_off += 12;
                    var d_total = 4 + d_len_bytes;
                    if (d_len_bytes % 2 != 0) d_total += 1;
                    d_off += d_total;
                }

                const resp_data_len = item_count;
                const total_size = 4 + 3 + 12 + 2 + resp_data_len;

                var resp_buffer: [256]u8 = undefined;
                var fbs = std.io.fixedBufferStream(&resp_buffer);
                const w = fbs.writer();

                try w.writeAll(&[_]u8{ 0x03, 0x00 });
                try w.writeInt(u16, @as(u16, @intCast(total_size)), .big);
                try w.writeAll(&[_]u8{ 0x02, 0xF0, 0x80 });

                try w.writeAll(&[_]u8{ 0x32, 0x03, 0x00, 0x00 });
                try w.writeInt(u16, pdu_ref, .big);
                try w.writeInt(u16, 2, .big);
                try w.writeInt(u16, @as(u16, @intCast(resp_data_len)), .big);
                try w.writeInt(u16, 0, .big);

                try w.writeByte(0x05);
                try w.writeByte(item_count);
                try w.writeByteNTimes(0xFF, item_count);

                try writer.writeAll(fbs.getWritten());
            }
        }
    }
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();

    std.debug.print("Initializing S7 Shared Memory '{s}'...\n", .{SHM_NAME});
    var store = try Storage.init();
    std.debug.print("Storage Engine Ready. Size: {} bytes\n", .{store.len});

    const port = 102;
    const address = try net.Address.parseIp4("0.0.0.0", port);
    var server = try address.listen(.{ .reuse_address = true });
    defer server.deinit();

    std.debug.print("S7 Server listening on port {}\n", .{port});

    while (true) {
        const connection = try server.accept();
        std.debug.print("Client connected from: {}\n", .{connection.address});
        const thread = try std.Thread.spawn(.{}, handleClient, .{ connection.stream, &store });
        thread.detach();
    }
}
