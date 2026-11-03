const std = @import("std");
const builtin = @import("builtin");
const wire = @import("wire.zig");
const transport = @import("channel.zig");
const endpoints = @import("endpoints.zig");

pub const Client = struct {
    channel: transport.Channel,
    notifications: wire.NotificationQueue = .{},
    writer: wire.Writer = .{},
    session: u32 = 0,
    sequence: u16 = 3,
    read_counter: u32 = 0,
    write_counter: u32 = 3,
    read_responses: u32 = 0,
    write_responses: u32 = 3,
    transaction: bool = false,
    failed: bool = false,
    status: u64 = 0,

    pub fn open(host: [:0]const u8, port: u16, certificate: [:0]const u8, tls_library: [:0]const u8) !*Client {
        if (port == 0) return error.InvalidPort;
        try transport.load(tls_library);
        if (builtin.os.tag == .windows) {
            var data: std.os.windows.ws2_32.WSADATA = undefined;
            if (std.os.windows.ws2_32.WSAStartup(0x202, &data) != 0) return error.SocketConfiguration;
        }
        errdefer cleanupSockets();
        const connection = try std.net.tcpConnectToAddress(try std.net.Address.parseIp4(host, port));
        const self = std.heap.page_allocator.create(Client) catch |err| {
            connection.close();
            return err;
        };
        errdefer std.heap.page_allocator.destroy(self);
        self.* = .{ .channel = transport.Channel.init(connection) };
        errdefer self.channel.deinit();
        try endpoints.configure(connection);
        const cr = [_]u8{ 3, 0, 0, 35, 30, 0xe0, 0, 0, 0, 1, 0, 0xc1, 2, 6, 0, 0xc2, 15, 'S', 'I', 'M', 'A', 'T', 'I', 'C', '-', 'R', 'O', 'O', 'T', '-', 'E', 'S', 0xc0, 1, 10 };
        try self.channel.sendFrame(&cr);
        if ((try self.channel.frame())[5] != 0xd0) return error.InvalidConnect;
        const writer = &self.writer;
        try writer.begin(1, 0x31, 0x5b3, 1, 0, 0x30);
        try writer.be32(0);
        try self.channel.send(try writer.finish());
        _ = try endpoints.checkReply(try self.channel.receiveReply(&self.notifications), 0x5b3, 1);
        try endpoints.clearFooter(&self.channel);
        try self.channel.handshake(false, certificate, null, host);
        var random: [4]u8 = undefined;
        std.crypto.random.bytes(&random);
        const identity = 0x10000000 | (std.mem.readInt(u32, &random, .little) & 0xfffffff);
        try self.channel.send(try wire.createRequest(writer, 2, identity));
        const creation = try endpoints.checkReply(try self.channel.receiveReply(&self.notifications), 0x4ca, 2);
        var reader: wire.Reader = .{ .data = creation.body };
        _ = try reader.vlq();
        if (try reader.vlq() != 2) return error.InvalidSession;
        const rid = try reader.vlq();
        if (rid == 0 or rid > std.math.maxInt(u32)) return error.InvalidSession;
        self.session = @intCast(rid);
        _ = try reader.vlq();
        var state: wire.State = .{};
        defer state.close();
        try wire.object(&reader, &state, 0);
        if (state.version.len == 0) return error.MissingVersion;
        try writer.begin(2, 0x31, 0x542, 3, self.session, 0x34);
        try writer.be32(self.session);
        try writer.put(&.{ 2, 2 });
        try writer.vlq(306);
        try writer.vlq(299);
        try writer.byte(1);
        try writer.put(state.version);
        try writer.byte(2);
        try writer.uint(2);
        try writer.byte(0);
        try writer.setupQualifier();
        try self.channel.send(try writer.finish());
        _ = try endpoints.checkReply(try self.channel.receiveReply(&self.notifications), 0x542, 3);
        return self;
    }
    fn cleanupSockets() void {
        if (builtin.os.tag == .windows) _ = std.os.windows.ws2_32.WSACleanup();
    }
    pub fn close(self: *Client) void {
        self.channel.deinit();
        cleanupSockets();
        std.heap.page_allocator.destroy(self);
    }
    pub fn authenticate(self: *Client, username: []const u8, password: []const u8) !void {
        if (self.failed or self.sequence != 3) return error.InvalidSequenceState;
        try endpoints.authenticateConnection(&self.channel, &self.notifications, self.session, password, username);
        self.sequence = 6;
        self.write_counter = 4;
        self.read_counter = 2;
        self.read_responses = 2;
        self.write_responses = 4;
    }
    fn begin(self: *Client, function: u16, is_read: bool) !u32 {
        if (self.failed or self.sequence == std.math.maxInt(u16)) return error.InvalidSequenceState;
        const counter = if (is_read) &self.read_counter else &self.write_counter;
        if (counter.* >= std.math.maxInt(u32) / 4) return error.Overflow;
        counter.* += 1;
        self.sequence += 1;
        self.status = 0;
        try self.writer.begin(2, 0x31, function, self.sequence, self.session, if (is_read) 0x34 else 0x36);
        return counter.*;
    }
    fn exchange(self: *Client, function: u16) !wire.Reader {
        try self.channel.send(try self.writer.finish());
        const message = try wire.Message.parse(try self.channel.receiveReply(&self.notifications));
        if (message.opcode != 0x32 or message.function != function or message.sequence != self.sequence) return error.UnexpectedReply;
        var reader: wire.Reader = .{ .data = message.body };
        self.status = try reader.vlq();
        const response_counter = if (function == 0x586 or function == 0x4bb) &self.read_responses else &self.write_responses;
        if (self.status != 0) {
            // Native exception replies carry a fixed-width detail and do not
            // advance the successful-response counter. zOMSp echoes integrity.
            if (reader.data.len - reader.offset == 8 and reader.data[reader.offset] == 0) {
                _ = try reader.u32be();
            } else {
                _ = try reader.vlq();
                response_counter.* += 1;
            }
            if (try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
            return error.RemoteStatus;
        }
        response_counter.* += 1;
        return reader;
    }
    fn finish(reader: *wire.Reader, expected: u64) !void {
        const integrity = try reader.vlq();
        // The native server varies bit zero independently of the echoed counter.
        if ((integrity & ~@as(u64, 1)) != (expected & ~@as(u64, 1)) or
            try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidIntegrity;
    }
    pub fn read(self: *Client, rid: u32, aid: u32) ![]const u8 {
        const counter = try self.begin(0x586, true);
        try self.writer.be32(rid);
        try self.writer.put(&.{ 0x20, 4, 1 });
        try self.writer.vlq(aid);
        try self.writer.qualifier(true, counter);
        var reader = try self.exchange(0x586);
        if (try reader.byte() != 0) return error.UnsupportedValue;
        const value = try reader.value(0);
        try finish(&reader, (@as(u64, self.read_responses) << 2) | 1);
        return value.raw;
    }
    pub fn write(self: *Client, rid: u32, aid: u32, value: []const u8) !void {
        const counter = try self.begin(0x4f2, false);
        try self.writer.be32(rid);
        try self.writer.byte(1);
        try self.writer.vlq(aid);
        try self.writer.put(value);
        try self.writer.qualifier(false, counter);
        var reader = try self.exchange(0x4f2);
        try finish(&reader, @as(u64, self.write_responses) << 1);
    }
    pub fn start(self: *Client) !void {
        if (self.transaction) return error.InvalidSequenceState;
        const counter = try self.begin(0x556, false);
        try self.writer.put(&.{ 2, 0, 1, 0 });
        try self.writer.vlq(counter);
        try self.writer.byte(0xa1);
        try self.writer.be32(0x7fffc001);
        try self.writer.vlq(1700);
        try self.writer.put(&.{ 0, 0, 0xa2, 0, 0, 0, 0 });
        var reader = try self.exchange(0x556);
        if ((try reader.value(0)).kind != 0x12) return error.InvalidSequenceState;
        try finish(&reader, @as(u64, self.write_responses) << 1);
        self.transaction = true;
    }
    pub fn end(self: *Client, abort: bool) !void {
        if (!self.transaction) return error.InvalidSequenceState;
        const counter = try self.begin(0x560, false);
        try self.writer.put(&.{ @intFromBool(abort), 1 });
        try self.writer.vlq(counter);
        try self.writer.be32(0);
        var reader = self.exchange(0x560) catch |err| {
            if (err == error.RemoteStatus) self.transaction = false;
            return err;
        };
        try finish(&reader, @as(u64, self.write_responses) << 1);
        self.transaction = false;
    }
    pub fn stream(self: *Client, rid: u32, aid: u32, bytes: []const u8) !void {
        if (!self.transaction or bytes.len == 0 or bytes.len > @import("streaming.zig").max_bytes) return error.InvalidValue;
        var offset: usize = 0;
        while (offset < bytes.len) {
            const chunk = bytes[offset..@min(bytes.len, offset + 32768)];
            const counter = try self.begin(0x57c, false);
            try self.writer.be32(rid);
            try self.writer.put(&.{ 0x20, 4, 3 });
            try self.writer.vlq(aid);
            try self.writer.vlq(offset);
            try self.writer.vlq(chunk.len);
            try self.writer.put(&wire.qualifier_bytes);
            try self.writer.put(&.{ 0, 1, 0, 0x14, 0 });
            try self.writer.vlq(chunk.len);
            try self.writer.put(chunk);
            try self.writer.vlq(counter);
            try self.writer.be32(0);
            var reader = try self.exchange(0x57c);
            try finish(&reader, @as(u64, self.write_responses) << 1);
            offset += chunk.len;
        }
    }
    pub fn find(self: *Client, root: u32, name: []const u8) !u32 {
        const counter = try self.begin(0x4bb, true);
        try self.writer.be32(root);
        try self.writer.put(&.{ 0, 1, 1, 0, 0, 1 });
        try self.writer.vlq(233);
        try self.writer.vlq(counter);
        try self.writer.put(&.{ 0, 0, 0, 0, 0 });
        var reader = try self.exchange(0x4bb);
        _ = try reader.u32be();
        if ((try reader.vlq() & ~@as(u64, 1)) != (@as(u64, self.read_responses) << 2)) return error.InvalidIntegrity;
        var stack: [8]u32 = undefined;
        var depth: usize = 0;
        var objects: usize = 0;
        var found: ?u32 = null;
        while (reader.data.len - reader.offset > 4) {
            switch (try reader.byte()) {
                0xa1 => {
                    if (depth == stack.len or objects == 128) return error.ObjectLimit;
                    stack[depth] = try reader.u32be();
                    depth += 1;
                    objects += 1;
                    _ = try reader.vlq();
                    _ = try reader.vlq();
                    _ = try reader.vlq();
                },
                0xa2 => {
                    if (depth == 0) return error.InvalidObject;
                    depth -= 1;
                },
                0xa3 => {
                    if (depth == 0) return error.InvalidObject;
                    const aid = try reader.vlq();
                    const value = try reader.value(0);
                    if (aid != 233 or value.kind != 0x15 or value.raw[0] != 0) continue;
                    var text: wire.Reader = .{ .data = value.raw, .offset = 2 };
                    const length = try text.vlq();
                    if (length > 4096) return error.ValueLimit;
                    if (!std.mem.eql(u8, try text.take(@intCast(length)), name)) continue;
                    if (found != null) return error.AmbiguousName;
                    found = stack[depth - 1];
                },
                0xa4 => {
                    _ = try reader.vlq();
                    _ = try reader.u32be();
                },
                else => return error.UnsupportedObjectField,
            }
        }
        if (depth != 0 or try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
        return found orelse error.ObjectNotFound;
    }
};
