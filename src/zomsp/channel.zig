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
    load_mutex.lock();
    defer load_mutex.unlock();
    if (zomsp_tls_load(path) != 0) return error.TlsLibraryUnavailable;
}
var load_mutex: std.Thread.Mutex = .{};

fn socketResult(result: i32) !usize {
    if (result >= 0) return @intCast(result);
    return switch (std.os.windows.ws2_32.WSAGetLastError()) {
        .WSAEWOULDBLOCK, .WSAEINTR => error.WouldBlock,
        .WSAECONNABORTED, .WSAECONNRESET, .WSAENETRESET, .WSAESHUTDOWN => error.ConnectionResetByPeer,
        .WSAETIMEDOUT => error.ConnectionTimedOut,
        .WSAENOTCONN => error.SocketNotConnected,
        .WSAENOBUFS => error.SystemResources,
        else => error.SocketIo,
    };
}
fn socketRead(stream: std.net.Stream, bytes: []u8) !usize {
    if (builtin.os.tag == .windows) return socketResult(std.os.windows.ws2_32.recv(stream.handle, bytes.ptr, @intCast(bytes.len), 0));
    return std.posix.recv(stream.handle, bytes, 0);
}
fn socketWrite(stream: std.net.Stream, bytes: []const u8) !usize {
    if (builtin.os.tag == .windows) return socketResult(std.os.windows.ws2_32.send(stream.handle, bytes.ptr, @intCast(bytes.len), 0));
    return std.posix.send(stream.handle, bytes, std.posix.MSG.NOSIGNAL);
}

pub fn validateServer(certificate: [:0]const u8, key: [:0]const u8) !void {
    const tls = zomsp_tls_new(1, certificate.ptr, key.ptr, "127.0.0.1") orelse return error.TlsConfiguration;
    zomsp_tls_free(tls);
}

pub const Channel = struct {
    stream: std.net.Stream,
    tls: ?*anyopaque = null,
    encrypted: [wire.limit]u8 = undefined,
    plaintext: [wire.limit]u8 = undefined,
    queued: usize = 0,
    consumed: usize = 0,
    frame_offset: usize = 0,
    cancel: ?*std.atomic.Value(bool) = null,
    wait_read: bool = true,
    deadline: i64,

    pub fn init(stream: std.net.Stream) Channel {
        return .{ .stream = stream, .deadline = std.time.milliTimestamp() + 10_000 };
    }
    pub fn deinit(self: *Channel) void {
        if (self.tls) |tls| zomsp_tls_free(tls);
        self.stream.close();
    }
    pub fn waitInput(self: *Channel, timeout_ms: i32) !void {
        try self.checkDeadline();
        var descriptors = [_]std.posix.pollfd{.{ .fd = self.stream.handle, .events = std.posix.POLL.IN, .revents = 0 }};
        if (builtin.os.tag == .windows) {
            _ = try socketResult(std.os.windows.poll(&descriptors, descriptors.len, timeout_ms));
        } else _ = try std.posix.poll(&descriptors, timeout_ms);
    }
    fn checkDeadline(self: *Channel) !void {
        if (self.cancel) |cancel| if (cancel.load(.acquire)) return error.Cancelled;
        if (std.time.milliTimestamp() > self.deadline) return error.Timeout;
    }
    fn read(self: *Channel, bytes: []u8) !usize {
        while (true) {
            try self.checkDeadline();
            return socketRead(self.stream, bytes) catch |err| switch (err) {
                error.WouldBlock => {
                    if (!self.wait_read) return err;
                    std.Thread.sleep(100 * std.time.ns_per_us);
                    continue;
                },
                else => return err,
            };
        }
    }
    pub fn frame(self: *Channel) ![]const u8 {
        while (self.frame_offset < 4) {
            try self.checkDeadline();
            const n = try self.read(self.encrypted[self.frame_offset..4]);
            if (n == 0) return error.EndOfStream;
            self.frame_offset += n;
        }
        const length = try protocol.frameSize(self.encrypted[0..4]);
        while (self.frame_offset < length) {
            try self.checkDeadline();
            const n = try self.read(self.encrypted[self.frame_offset..length]);
            if (n == 0) return error.EndOfStream;
            self.frame_offset += n;
        }
        _ = try protocol.classify(self.encrypted[0..length]);
        self.frame_offset = 0;
        return self.encrypted[0..length];
    }
    pub fn sendFrame(self: *Channel, bytes: []const u8) !void {
        try self.checkDeadline();
        _ = try protocol.classify(bytes);
        try self.writeAll(bytes);
    }
    fn writeAll(self: *Channel, bytes: []const u8) !void {
        var used: usize = 0;
        while (used < bytes.len) {
            try self.checkDeadline();
            const count = socketWrite(self.stream, bytes[used..]) catch |err| switch (err) {
                error.WouldBlock => {
                    std.Thread.sleep(std.time.ns_per_ms);
                    continue;
                },
                else => return err,
            };
            if (count == 0) return error.EndOfStream;
            used += count;
        }
    }
    pub fn sendData(self: *Channel, bytes: []const u8) !void {
        if (bytes.len > wire.limit - 7) return error.MessageLimit;
        var header = [_]u8{ 3, 0, 0, 0, 2, 0xf0, 0x80 };
        std.mem.writeInt(u16, header[2..4], @intCast(bytes.len + 7), .big);
        try self.checkDeadline();
        try self.writeAll(&header);
        try self.writeAll(bytes);
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
            self.feed() catch |err| switch (err) {
                error.WouldBlock, error.ConnectionTimedOut => continue,
                else => return err,
            };
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
        if (self.queued == self.consumed and self.frame_offset == 0) self.deadline = std.time.milliTimestamp() + 10_000;
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

    pub fn receiveReply(self: *Channel, notifications: *wire.NotificationQueue) ![]const u8 {
        const deadline = std.time.milliTimestamp() + 10_000;
        while (std.time.milliTimestamp() <= deadline) {
            const data = try self.receive();
            if (data.len >= 5 and data[4] == 0x33) {
                try notifications.push(data);
            } else return data;
        }
        return error.Timeout;
    }
};
