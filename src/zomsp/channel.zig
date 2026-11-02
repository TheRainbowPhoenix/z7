const std = @import("std");
const protocol = @import("protocol.zig");
const wire = @import("wire.zig");
const builtin = @import("builtin");

fn trace(direction: []const u8, data: []const u8) void {
    if (builtin.os.tag != .windows and std.posix.getenv("ZOMSP_WIRE_LOG") != null)
        std.log.info("OMSp {s}={s}", .{ direction, std.fmt.fmtSliceHexLower(data) });
}

extern fn zomsp_tls_load([*:0]const u8) c_int;
extern fn zomsp_tls_new(c_int, [*:0]const u8, ?[*:0]const u8, [*:0]const u8) ?*anyopaque;
extern fn zomsp_tls_free(*anyopaque) void;
extern fn zomsp_tls_handshake(*anyopaque) c_int;
extern fn zomsp_tls_finished(*anyopaque) c_int;
extern fn zomsp_tls_feed(*anyopaque, [*]const u8, c_int) c_int;
extern fn zomsp_tls_drain(*anyopaque, [*]u8, c_int) c_int;
extern fn zomsp_tls_read(*anyopaque, [*]u8, c_int) c_int;
extern fn zomsp_tls_write(*anyopaque, [*]const u8, c_int) c_int;

pub fn load(path: [*:0]const u8) !void {
    if (zomsp_tls_load(path) != 0) return error.TlsLibraryUnavailable;
}

pub const Channel = struct {
    stream: std.net.Stream,
    tls: ?*anyopaque = null,
    encrypted: [wire.limit]u8 = undefined,
    plaintext: [wire.limit]u8 = undefined,
    queued: usize = 0,
    consumed: usize = 0,
    deadline: i64,

    pub fn init(stream: std.net.Stream) Channel {
        return .{ .stream = stream, .deadline = std.time.milliTimestamp() + 10_000 };
    }
    pub fn deinit(self: *Channel) void {
        if (self.tls) |tls| zomsp_tls_free(tls);
        self.stream.close();
    }
    fn checkDeadline(self: *Channel) !void {
        if (std.time.milliTimestamp() > self.deadline) return error.Timeout;
    }
    fn exact(self: *Channel, bytes: []u8) !void {
        var used: usize = 0;
        while (used < bytes.len) {
            try self.checkDeadline();
            const count = try self.stream.read(bytes[used..]);
            if (count == 0) return error.EndOfStream;
            used += count;
        }
    }
    pub fn frame(self: *Channel) ![]const u8 {
        try self.exact(self.encrypted[0..4]);
        const length = try protocol.frameSize(self.encrypted[0..4]);
        try self.exact(self.encrypted[4..length]);
        _ = try protocol.classify(self.encrypted[0..length]);
        return self.encrypted[0..length];
    }
    pub fn sendFrame(self: *Channel, bytes: []const u8) !void {
        try self.checkDeadline();
        _ = try protocol.classify(bytes);
        try self.stream.writeAll(bytes);
    }
    pub fn sendData(self: *Channel, bytes: []const u8) !void {
        if (bytes.len > wire.limit - 7) return error.MessageLimit;
        var header = [_]u8{ 3, 0, 0, 0, 2, 0xf0, 0x80 };
        std.mem.writeInt(u16, header[2..4], @intCast(bytes.len + 7), .big);
        try self.checkDeadline();
        try self.stream.writeAll(&header);
        try self.stream.writeAll(bytes);
    }
    fn flush(self: *Channel) !void {
        const tls = self.tls orelse return error.NoTls;
        var bytes: [16384]u8 = undefined;
        for (0..64) |_| {
            const count = zomsp_tls_drain(tls, &bytes, bytes.len);
            if (count <= 0) return;
            try self.sendData(bytes[0..@intCast(count)]);
        }
        return error.OutputLimit;
    }
    fn feed(self: *Channel) !void {
        const packet = try self.frame();
        const header = @as(usize, packet[4]) + 5;
        if (packet[5] & 0xf0 != 0xf0 or header >= packet.len) return error.InvalidCotp;
        const bytes = packet[header..];
        if (zomsp_tls_feed(self.tls.?, bytes.ptr, @intCast(bytes.len)) != bytes.len) return error.TlsInput;
    }
    pub fn handshake(self: *Channel, server: bool, certificate: [:0]const u8, key: ?[:0]const u8, peer: [:0]const u8) !void {
        self.tls = zomsp_tls_new(@intFromBool(server), certificate.ptr, if (key) |path| path.ptr else null, peer.ptr) orelse return error.TlsConfiguration;
        for (0..128) |_| {
            const result = zomsp_tls_handshake(self.tls.?);
            try self.flush();
            if (result > 0 and zomsp_tls_finished(self.tls.?) == 1) return;
            if (result != -2) return error.TlsHandshake;
            try self.feed();
        }
        return error.HandshakeLimit;
    }
    pub fn send(self: *Channel, data: []const u8) !void {
        if (data.len > wire.limit) return error.MessageLimit;
        trace("send", data);
        const tls = self.tls orelse return self.sendData(data);
        var used: usize = 0;
        for (0..128) |_| {
            const result = zomsp_tls_write(tls, data[used..].ptr, @intCast(data.len - used));
            try self.flush();
            if (result > 0) {
                used += @intCast(result);
                if (used == data.len) return;
            } else if (result == -2) try self.feed() else return error.TlsWrite;
        }
        return error.OutputLimit;
    }
    pub fn receive(self: *Channel) ![]const u8 {
        self.deadline = std.time.milliTimestamp() + 10_000;
        for (0..256) |_| {
            if (self.consumed != 0) {
                std.mem.copyForwards(u8, self.plaintext[0 .. self.queued - self.consumed], self.plaintext[self.consumed..self.queued]);
                self.queued -= self.consumed;
                self.consumed = 0;
            }
            if (self.queued >= 4) {
                if (self.plaintext[0] != 0x72) return error.InvalidMessage;
                const size = @as(usize, std.mem.readInt(u16, self.plaintext[2..4], .big)) + 4;
                if (size > self.plaintext.len) return error.MessageLimit;
                if (self.queued >= size) {
                    self.consumed = size;
                    if (size == 4) continue;
                    trace("recv", self.plaintext[0..size]);
                    return self.plaintext[0..size];
                }
            }
            if (self.queued == self.plaintext.len) return error.MessageLimit;
            if (self.tls) |tls| {
                const count = zomsp_tls_read(tls, self.plaintext[self.queued..].ptr, @intCast(self.plaintext.len - self.queued));
                try self.flush();
                if (count > 0) self.queued += @intCast(count) else if (count == -2) try self.feed() else if (count == 0) return error.EndOfStream else return error.TlsRead;
            } else {
                const packet = try self.frame();
                const bytes = packet[@as(usize, packet[4]) + 5 ..];
                if (bytes.len > self.plaintext.len - self.queued) return error.MessageLimit;
                @memcpy(self.plaintext[self.queued..][0..bytes.len], bytes);
                self.queued += bytes.len;
            }
        }
        return error.InputLimit;
    }
};
