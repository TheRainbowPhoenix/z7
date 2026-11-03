const std = @import("std");
const builtin = @import("builtin");
const wire = @import("wire.zig");
const transport = @import("channel.zig");
const endpoints = @import("endpoints.zig");
pub const ExploreOptions = extern struct {
    flags: u32 = 3,
    reserved: u32 = 0,
    aids: ?[*]const u32 = null,
    aid_count: usize = 0,
    filters: ?[*]const u8 = null,
    filters_length: usize = 0,
};
pub const Reference = extern struct { handle: u32, rid: u32, aid: u32, path_length: u32 = 0, path: [3]u32 = @splat(0), reserved: u32 = 0 };

pub const Client = struct {
    channel: transport.Channel,
    notifications: wire.NotificationQueue = .{},
    writer: wire.Writer = .{},
    session: u32 = 0,
    context: u32 = 0,
    sequence: u16 = 3,
    read_counter: u32 = 0,
    write_counter: u32 = 3,
    read_responses: u32 = 0,
    write_responses: u32 = 3,
    response_model: enum { unknown, echo, native } = .unknown,
    last_integrity: u32 = 0,
    transaction: bool = false,
    best_effort: bool = false,
    application_sequence: u8 = 0,
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
        const context = try reader.vlq();
        if (context == 0 or context > std.math.maxInt(u32)) return error.InvalidSession;
        self.context = @intCast(context);
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
        self.last_integrity = counter.*;
        try self.writer.begin(2, 0x31, function, self.sequence, self.session, if (is_read) 0x34 else 0x36);
        return counter.*;
    }
    fn exchange(self: *Client, function: u16) !wire.Reader {
        try self.channel.send(try self.writer.finish());
        const message = try wire.Message.parse(try self.channel.receiveReply(&self.notifications));
        if (message.opcode != 0x32 or message.function != function or message.sequence != self.sequence) return error.UnexpectedReply;
        var reader: wire.Reader = .{ .data = message.body };
        self.status = try reader.vlq();
        const response_counter = if (function == 0x586 or function == 0x4bb or function == 0x524) &self.read_responses else &self.write_responses;
        if (self.status != 0) {
            // Native exception replies carry a fixed-width detail without an
            // integrity token. The request counter was already consumed by begin.
            if (reader.data.len - reader.offset == 8 and reader.data[reader.offset] == 0) {
                _ = try reader.u32be();
                if (self.response_model == .echo) return error.InvalidIntegrity;
                self.response_model = .native;
            } else {
                if (function == 0x556) _ = try reader.value(0);
                if (function == 0x56b or function == 0x4bb) _ = try reader.u32be();
                if (function == 0x524 and try reader.vlq() != 0) return error.InvalidTrailer;
                _ = try reader.vlq();
                response_counter.* += 1;
            }
            if (try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
            return error.RemoteStatus;
        }
        response_counter.* += 1;
        return reader;
    }
    fn checkIntegrity(self: *Client, actual: u64, expected: u64) !void {
        // OMS_ServerSession_CheckRequestSequence: combined = request ID + integrity.
        const echo_match = actual == expected;
        const native_match = actual == @as(u64, self.sequence) + self.last_integrity;
        switch (self.response_model) {
            .echo => if (!echo_match) return error.InvalidIntegrity,
            .native => if (!native_match) return error.InvalidIntegrity,
            .unknown => {
                if (!echo_match and !native_match) return error.InvalidIntegrity;
                if (echo_match != native_match) self.response_model = if (echo_match) .echo else .native;
            },
        }
    }
    fn finish(self: *Client, reader: *wire.Reader, expected: u64) !void {
        const integrity = try reader.vlq();
        try self.checkIntegrity(integrity, expected);
        if (try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidIntegrity;
    }
    pub fn read(self: *Client, rid: u32, aid: u32) ![]const u8 {
        return self.readPath(rid, &.{aid});
    }
    pub fn readPath(self: *Client, rid: u32, path: []const u32) ![]const u8 {
        const counter = try self.begin(0x586, true);
        try self.writer.be32(rid);
        try self.writer.put(&.{ 0x20, 4 });
        try self.writer.vlq(path.len);
        for (path) |part| try self.writer.vlq(part);
        try self.writer.qualifier(true, counter);
        var reader = try self.exchange(0x586);
        if (try reader.byte() != 0) return error.UnsupportedValue;
        const value = try reader.value(0);
        try self.finish(&reader, (@as(u64, self.read_responses) << 2) | 1);
        return value.raw;
    }
    pub fn writePath(self: *Client, rid: u32, path: []const u32, value: []const u8) !void {
        const counter = try self.begin(0x57c, false);
        try self.writer.be32(rid);
        try self.writer.put(&.{ 0x20, 4 });
        try self.writer.vlq(path.len);
        for (path) |part| try self.writer.vlq(part);
        try self.writer.put(&wire.qualifier_bytes);
        try self.writer.put(&.{ 0, 1 });
        try self.writer.put(value);
        try self.writer.vlq(counter);
        try self.writer.be32(0);
        var reader = try self.exchange(0x57c);
        try self.finish(&reader, @as(u64, self.write_responses) << 1);
    }
    pub fn write(self: *Client, rid: u32, aid: u32, value: []const u8) !void {
        const counter = try self.begin(0x4f2, false);
        try self.writer.be32(rid);
        try self.writer.byte(1);
        try self.writer.vlq(aid);
        try self.writer.put(value);
        try self.writer.qualifier(false, counter);
        var reader = try self.exchange(0x4f2);
        try self.finish(&reader, @as(u64, self.write_responses) << 1);
    }
    pub fn start(self: *Client) !void {
        if (self.transaction or self.best_effort or self.application_sequence != 0) return error.InvalidSequenceState;
        const counter = try self.begin(0x556, false);
        try self.writer.put(&.{ 2, 0, 1, 0 });
        try self.writer.vlq(counter);
        try self.writer.byte(0xa1);
        try self.writer.be32(0x7fffc001);
        try self.writer.vlq(1700);
        try self.writer.put(&.{ 0, 0, 0xa2, 0, 0, 0, 0 });
        var reader = try self.exchange(0x556);
        if ((try reader.value(0)).kind != 0x12) return error.InvalidSequenceState;
        try self.finish(&reader, @as(u64, self.write_responses) << 1);
        self.transaction = true;
    }
    pub fn end(self: *Client, abort: bool) !void {
        if (!self.transaction and !self.best_effort and self.application_sequence == 0) return error.InvalidSequenceState;
        const counter = try self.begin(0x560, false);
        try self.writer.put(&.{ @intFromBool(abort), @intFromBool(self.transaction) });
        try self.writer.vlq(counter);
        try self.writer.be32(0);
        var reader = self.exchange(0x560) catch |err| {
            if (err == error.RemoteStatus and self.application_sequence == 0) {
                self.transaction = false;
                self.best_effort = false;
            }
            return err;
        };
        try self.finish(&reader, @as(u64, self.write_responses) << 1);
        if (self.application_sequence != 0) self.application_sequence = 0 else {
            self.transaction = false;
            self.best_effort = false;
        }
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
            try self.finish(&reader, @as(u64, self.write_responses) << 1);
            offset += chunk.len;
        }
    }
    pub fn create(self: *Client, parent: u32, descriptor: []const u8, assigned: *[8]u32) !usize {
        const counter = try self.begin(0x4ca, false);
        try self.writer.be32(parent);
        try self.writer.put(&.{ 0, 4, 0 });
        try self.writer.be32(0);
        try self.writer.vlq(counter);
        try self.writer.put(descriptor);
        try self.writer.be32(0);
        var reader = try self.exchange(0x4ca);
        const count = try reader.vlq();
        if (count == 0 or count > assigned.len) return error.ObjectLimit;
        for (assigned[0..@intCast(count)]) |*rid| {
            const value = try reader.vlq();
            if (value == 0 or value > std.math.maxInt(u32)) return error.InvalidObject;
            rid.* = @intCast(value);
        }
        try self.finish(&reader, @as(u64, self.write_responses) << 1);
        return @intCast(count);
    }
    pub fn delete(self: *Client, rid: u32) !void {
        const counter = try self.begin(0x4d4, false);
        try self.writer.be32(rid);
        try self.writer.byte(0);
        try self.writer.put(&wire.qualifier_bytes);
        try self.writer.vlq(counter);
        try self.writer.be32(0);
        var reader = try self.exchange(0x4d4);
        if (try reader.u32be() != rid) return error.UnexpectedReply;
        try self.finish(&reader, @as(u64, self.write_responses) << 1);
    }
    pub fn notification(self: *Client, output: []u8, wait: bool) !usize {
        if (self.failed) return error.InvalidSequenceState;
        if (self.notifications.count != 0) {
            const length = self.notifications.lengths[self.notifications.head];
            _ = try self.notifications.pop(output);
            return length;
        }
        if (!wait) return 0;
        const raw = try self.channel.receive();
        _ = try wire.Notification.parse(raw);
        if (output.len < raw.len) return error.BufferTooSmall;
        @memcpy(output[0..raw.len], raw);
        return raw.len;
    }
    pub fn beginBestEffort(self: *Client) !void {
        if (self.transaction or self.best_effort or self.application_sequence != 0) return error.InvalidSequenceState;
        const counter = try self.begin(0x556, false);
        try self.writer.put(&.{ 1, 0, 0 });
        try self.writer.vlq(counter);
        try self.writer.be32(0);
        var reader = try self.exchange(0x556);
        if ((try reader.value(0)).kind != 0) return error.InvalidSequenceState;
        try self.finish(&reader, @as(u64, self.write_responses) << 1);
        self.best_effort = true;
    }
    pub fn beginApplication(self: *Client, kind: u8, parameter: u32) !void {
        if (self.best_effort or self.application_sequence != 0) return error.InvalidSequenceState;
        const counter = try self.begin(0x556, false);
        try self.writer.byte(kind);
        try self.writer.rid(parameter);
        try self.writer.vlq(counter);
        try self.writer.be32(0);
        var reader = try self.exchange(0x556);
        if ((try reader.value(0)).kind != 0) return error.InvalidSequenceState;
        try self.finish(&reader, @as(u64, self.write_responses) << 1);
        self.application_sequence = kind;
    }
    pub fn getLink(self: *Client, rid: u32, aid: u32, targets: *[16]u32) !usize {
        const counter = try self.begin(0x524, true);
        try self.writer.be32(rid);
        try self.writer.vlq(aid);
        try self.writer.put(&.{ 0, 0 });
        try self.writer.vlq(counter);
        try self.writer.be32(0);
        var reader = try self.exchange(0x524);
        const count = try reader.vlq();
        if (count > targets.len) return error.ValueLimit;
        for (targets[0..@intCast(count)]) |*target| target.* = try reader.u32be();
        try self.finish(&reader, (@as(u64, self.read_responses) << 2) | 1);
        return @intCast(count);
    }
    pub fn explore(self: *Client, rid: u32, options: ExploreOptions, parent: *u32) ![]const u8 {
        const filters: []const u8 = if (options.filters) |raw| raw[0..options.filters_length] else &.{0};
        const counter = try self.begin(0x4bb, true);
        try self.writer.be32(rid);
        try self.writer.put(&.{ 0, @intFromBool(options.flags & 1 != 0), @intFromBool(options.flags & 2 != 0), @intFromBool(options.flags & 4 != 0) });
        try self.writer.put(filters);
        try self.writer.vlq(options.aid_count);
        if (options.aids) |aids| for (aids[0..options.aid_count]) |aid| try self.writer.vlq(aid);
        try self.writer.vlq(counter);
        try self.writer.put(&.{ 0, 0, 0, 0, 0 });
        var reader = try self.exchange(0x4bb);
        parent.* = try reader.u32be();
        const integrity = try reader.vlq();
        try self.checkIntegrity(integrity, (@as(u64, self.read_responses) << 2) | 1);
        if (reader.data.len - reader.offset < 4) return error.InvalidIntegrity;
        const objects = try reader.take(reader.data.len - reader.offset - 4);
        if (try reader.u32be() != 0) return error.InvalidTrailer;
        try @import("model.zig").objects(objects, null, null);
        return objects;
    }
    pub fn invoke(self: *Client, rid: u32, method: u32, arguments: []const u8) ![]const u8 {
        const counter = try self.begin(0x56b, false);
        try self.writer.be32(rid);
        try self.writer.be32(method);
        try self.writer.put(arguments);
        try self.writer.vlq(counter);
        try self.writer.be32(0);
        var reader = try self.exchange(0x56b);
        const result_start = reader.offset;
        _ = try reader.value(0);
        try wire.invokeArguments(&reader);
        const result = reader.data[result_start..reader.offset];
        if (result.len > 8192) return error.ValueLimit;
        try self.finish(&reader, @as(u64, self.write_responses) << 1);
        return result;
    }
    pub fn subscribe(self: *Client, references: []const Reference, cycle: u32, credits: i16) !u32 {
        var descriptor: wire.Writer = .{};
        try descriptor.byte(0xa1);
        try descriptor.be32(0x7fffc001);
        try descriptor.vlq(1001);
        try descriptor.put(&.{ 0, 0, 0xa3 });
        try descriptor.vlq(1048);
        try descriptor.put(&.{ 0x20, 4 });
        var words: usize = 3;
        for (references) |reference| words += 6 + reference.path_length;
        try descriptor.vlq(words);
        try descriptor.vlq(0x80000000);
        try descriptor.byte(0);
        try descriptor.vlq(references.len);
        for (references) |reference| {
            try descriptor.vlq(0x80100001 + reference.path_length);
            try descriptor.vlq(reference.handle);
            try descriptor.byte(0);
            try descriptor.vlq(reference.rid);
            try descriptor.byte(0);
            try descriptor.vlq(reference.aid);
            for (reference.path[0..reference.path_length]) |part| try descriptor.vlq(part);
        }
        try descriptor.byte(0xa3);
        try descriptor.vlq(1049);
        try descriptor.uint(cycle);
        try descriptor.byte(0xa3);
        try descriptor.vlq(1053);
        try descriptor.put(&.{ 0, 7 });
        try descriptor.be16(@bitCast(credits));
        try descriptor.byte(0xa2);
        var assigned: [8]u32 = undefined;
        if (try self.create(self.context, descriptor.data[0..descriptor.used], &assigned) != 1) return error.InvalidObject;
        return assigned[0];
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
        try self.checkIntegrity(try reader.vlq(), (@as(u64, self.read_responses) << 2) | 1);
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
