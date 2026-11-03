const std = @import("std");
const backend = @import("backend.zig");
const subscriptions = @import("subscriptions.zig");
const application = @import("application.zig");
pub const limit = 65535;
pub const qualifier_bytes = [_]u8{ 0, 0, 4, 0xe8, 0x89, 0x69, 0, 0x12, 0, 0, 0, 0, 0x89, 0x6a, 0, 0x13, 0, 0x89, 0x6b, 0, 4, 0, 0 };
pub const Value = struct { kind: u8, number: u64 = 0, raw: []const u8 };
const Address = struct {
    rid: u32,
    aid: u32,
    path: [3]u32 = @splat(0),
    path_len: u8 = 0,
};

fn addresses(reader: *Reader, target: u32, count: usize, fields: u64, output: *[16]Address) !void {
    if (count == 0 or count > output.len) return error.ValueLimit;
    var consumed: u64 = 0;
    for (output[0..count]) |*address| {
        address.* = .{ .rid = target, .aid = 0 };
        if (target == 0) {
            if (try reader.vlq() != 0) return error.UnsupportedSymbolCrc;
            const rid = try reader.vlq();
            const parts = try reader.vlq();
            if (rid == 0 or rid > std.math.maxInt(u32) or parts == 0 or parts > 4) return error.InvalidAddress;
            address.rid = @intCast(rid);
            address.path_len = @intCast(parts - 1);
            consumed += 3 + parts;
        } else consumed += 1;
        const aid = try reader.vlq();
        if (aid == 0 or aid > std.math.maxInt(u32)) return error.InvalidAddress;
        address.aid = @intCast(aid);
        for (address.path[0..address.path_len]) |*part| {
            const field = try reader.vlq();
            if (field == 0 or field > std.math.maxInt(u32)) return error.InvalidAddress;
            part.* = @intCast(field);
        }
    }
    if (consumed != fields) return error.InvalidAddress;
}

pub const Reader = struct {
    data: []const u8,
    offset: usize = 0,

    pub fn take(self: *Reader, n: usize) ![]const u8 {
        if (n > self.data.len - self.offset) return error.Truncated;
        const result = self.data[self.offset..][0..n];
        self.offset += n;
        return result;
    }
    pub fn byte(self: *Reader) !u8 {
        return (try self.take(1))[0];
    }
    pub fn u32be(self: *Reader) !u32 {
        return std.mem.readInt(u32, (try self.take(4))[0..4], .big);
    }
    pub fn vlq(self: *Reader) !u64 {
        var result: u64 = 0;
        for (0..8) |_| {
            const b = try self.byte();
            result = (result << 7) | (b & 0x7f);
            if (b & 0x80 == 0) return result;
        }
        return (result << 8) | try self.byte();
    }
    fn signed(self: *Reader, bits: comptime_int) !u64 {
        var octet = try self.byte();
        var result: i128 = @as(i128, octet & 0x3f) - @as(i128, if (octet & 0x40 != 0) 64 else 0);
        const maximum = if (bits == 32) 5 else 9;
        var count: usize = 1;
        while (octet & 0x80 != 0) {
            if (count == maximum) return error.Overflow;
            octet = try self.byte();
            const width: u7 = if (bits == 64 and count == 8) 8 else 7;
            result = result * (@as(i128, 1) << width) + (octet & (if (width == 8) @as(u8, 0xff) else 0x7f));
            count += 1;
            if (width == 8) break;
        }
        if (result < std.math.minInt(std.meta.Int(.signed, bits)) or result > std.math.maxInt(std.meta.Int(.signed, bits))) return error.Overflow;
        return @bitCast(@as(i64, @intCast(result)));
    }
    pub fn value(self: *Reader, depth: usize) anyerror!Value {
        if (depth >= 8) return error.DepthLimit;
        const start = self.offset;
        const flags = try self.byte();
        const kind = try self.byte();
        if (flags != 0 and flags != 0x10 and flags != 0x20 and flags != 0x40) return error.UnsupportedValue;
        var number: u64 = 0;
        if (flags == 0x40) {
            var indices: [64]u32 = undefined;
            var count: usize = 0;
            while (true) {
                const index = try self.vlq();
                if (index == 0) break;
                if (index > std.math.maxInt(u32) or count == indices.len) return error.ValueLimit;
                if (std.mem.indexOfScalar(u32, indices[0..count], @intCast(index)) != null) return error.InvalidIndex;
                indices[count] = @intCast(index);
                count += 1;
                switch (kind) {
                    4 => _ = try self.vlq(),
                    8 => _ = try self.signed(32),
                    0x14, 0x15 => {
                        if (kind == 0x14 and try self.vlq() > 1) return error.UnsupportedValue;
                        const length = try self.vlq();
                        if (length > 4096) return error.ValueLimit;
                        _ = try self.take(@intCast(length));
                    },
                    0x16 => _ = try self.value(depth + 1),
                    else => return error.UnsupportedValue,
                }
            }
        } else if (flags != 0) {
            const count = try self.vlq();
            if (count > 4096) return error.ValueLimit;
            switch (kind) {
                1, 2, 6, 0x0a => _ = try self.take(@intCast(count)),
                3, 7, 0x0b => _ = try self.take(@intCast(count * 2)),
                4, 5, 0x13 => for (0..@intCast(count)) |_| {
                    _ = try self.vlq();
                },
                8 => for (0..@intCast(count)) |_| {
                    _ = try self.signed(32);
                },
                9, 0x11 => for (0..@intCast(count)) |_| {
                    _ = try self.signed(64);
                },
                0x0c, 0x0e, 0x12 => _ = try self.take(@intCast(count * 4)),
                0x0d, 0x0f, 0x10 => _ = try self.take(@intCast(count * 8)),
                else => return error.UnsupportedValue,
            }
        } else switch (kind) {
            0 => {},
            1, 2, 6, 0x0a => number = try self.byte(),
            3, 7, 0x0b => number = std.mem.readInt(u16, (try self.take(2))[0..2], .big),
            4, 5, 0x13 => number = try self.vlq(),
            8 => number = try self.signed(32),
            9, 0x11 => number = try self.signed(64),
            0x0c, 0x0e, 0x12 => number = try self.u32be(),
            0x0d, 0x0f, 0x10 => number = std.mem.readInt(u64, (try self.take(8))[0..8], .big),
            0x14 => {
                number = try self.vlq();
                if (number > 1) return error.UnsupportedValue;
                const length = try self.vlq();
                if (length > 4096) return error.ValueLimit;
                _ = try self.take(@intCast(length));
            },
            0x15 => {
                const length = try self.vlq();
                if (length > 4096) return error.ValueLimit;
                _ = try self.take(@intCast(length));
            },
            0x17 => {
                number = try self.u32be();
                if ((number > 0x90000000 and number < 0x9fffffff) or (number > 0x02000000 and number < 0x02ffffff)) {
                    _ = try self.take(8);
                    const transport_flags = try self.vlq();
                    if (transport_flags & ~@as(u64, 0x403) != 0 or transport_flags & 2 == 0) return error.UnsupportedValue;
                    var length = try self.vlq();
                    if (transport_flags & 0x400 != 0) length = try self.vlq();
                    if (length > 4096) return error.ValueLimit;
                    _ = try self.take(@intCast(length));
                    return .{ .kind = kind, .number = number, .raw = self.data[start..self.offset] };
                }
                var count: usize = 0;
                while (try self.vlq() != 0) {
                    if (count == 64) return error.ValueLimit;
                    _ = try self.value(depth + 1);
                    count += 1;
                }
            },
            else => return error.UnsupportedValue,
        }
        return .{ .kind = kind, .number = number, .raw = self.data[start..self.offset] };
    }
    pub fn finishRequest(self: *Reader, function: u16, initial: bool) !u32 {
        if (function == 0x542 and try self.byte() != 0) return error.InvalidIndex;
        if (function == 0x4d4 and try self.byte() != 0) return error.InvalidRequestFlags;
        if (!std.mem.eql(u8, try self.take(qualifier_bytes.len), &qualifier_bytes)) return error.UnsupportedQualifier;
        if ((function == 0x586 or function == 0x4f2) and try self.byte() != 0) return error.InvalidRequestFlags;
        if (function == 0x586 and try self.byte() != 1) return error.InvalidReadFlags;
        const integrity = if (initial) 0 else try self.vlq();
        if (integrity > 0xffffffff) return error.Overflow;
        if (try self.u32be() != 0 or self.offset != self.data.len) return error.InvalidTrailer;
        return @intCast(integrity);
    }
};

pub const Writer = struct {
    data: [limit]u8 = undefined,
    used: usize = 0,
    pub fn put(self: *Writer, bytes: []const u8) !void {
        if (bytes.len > self.data.len - self.used) return error.MessageLimit;
        @memcpy(self.data[self.used..][0..bytes.len], bytes);
        self.used += bytes.len;
    }
    pub fn byte(self: *Writer, b: u8) !void {
        try self.put(&.{b});
    }
    pub fn be16(self: *Writer, v: u16) !void {
        var bytes: [2]u8 = undefined;
        std.mem.writeInt(u16, &bytes, v, .big);
        try self.put(&bytes);
    }
    pub fn be32(self: *Writer, v: u32) !void {
        var bytes: [4]u8 = undefined;
        std.mem.writeInt(u32, &bytes, v, .big);
        try self.put(&bytes);
    }
    pub fn be64(self: *Writer, v: u64) !void {
        var bytes: [8]u8 = undefined;
        std.mem.writeInt(u64, &bytes, v, .big);
        try self.put(&bytes);
    }
    pub fn vlq(self: *Writer, v: u64) !void {
        var bytes: [9]u8 = undefined;
        var at: usize = bytes.len - 1;
        var remaining = v;
        const wide = v > 0x00ffffffffffffff;
        bytes[at] = @truncate(remaining & (if (wide) @as(u64, 0xff) else 0x7f));
        if (wide) {
            remaining >>= 8;
            at -= 1;
            bytes[at] = @as(u8, @truncate(remaining & 0x7f)) | 0x80;
        }
        while (remaining >= 128) {
            remaining >>= 7;
            at -= 1;
            bytes[at] = @as(u8, @truncate(remaining & 0x7f)) | 0x80;
        }
        if (wide and at == 1) {
            at = 0;
            bytes[0] = 0x80;
        }
        try self.put(bytes[at..]);
    }
    pub fn uint(self: *Writer, v: u32) !void {
        try self.put(&.{ 0, 4 });
        try self.vlq(v);
    }
    pub fn rid(self: *Writer, v: u32) !void {
        try self.put(&.{ 0, 0x12 });
        try self.be32(v);
    }
    pub fn string(self: *Writer, text: []const u8) !void {
        if (text.len > 4096) return error.ValueLimit;
        try self.put(&.{ 0, 0x15 });
        try self.vlq(text.len);
        try self.put(text);
    }
    pub fn begin(self: *Writer, version: u8, opcode: u8, function: u16, sequence: u16, session: ?u32, flags: u8) !void {
        self.used = 0;
        try self.put(&.{ 0x72, version, 0, 0, opcode, 0, 0 });
        try self.be16(function);
        try self.be16(0);
        try self.be16(sequence);
        if (session) |rid_value| try self.be32(rid_value);
        try self.byte(flags);
    }
    pub fn finish(self: *Writer) ![]const u8 {
        if (self.used < 4) return error.Truncated;
        std.mem.writeInt(u16, self.data[2..4], @intCast(self.used - 4), .big);
        if (self.data[1] == 1) try self.put(&.{ 0x72, 1, 0, 0 });
        return self.data[0..self.used];
    }
    pub fn qualifier(self: *Writer, read: bool, integrity: u32) !void {
        try self.put(&qualifier_bytes);
        try self.byte(0);
        if (read) try self.byte(1);
        try self.vlq(integrity);
        try self.be32(0);
    }
    pub fn setupQualifier(self: *Writer) !void {
        try self.put(&qualifier_bytes);
        try self.be32(0);
    }
};

pub const Message = struct {
    version: u8,
    opcode: u8,
    function: u16,
    sequence: u16,
    session: u32,
    flags: u8,
    body: []const u8,
    pub fn parse(data: []const u8) !Message {
        if (data.len < 14 or data.len > limit or data[0] != 0x72 or data[1] < 1 or data[1] > 2) return error.InvalidMessage;
        const size = std.mem.readInt(u16, data[2..4], .big);
        if (size != data.len - 4) return error.InvalidLength;
        const request = data[4] == 0x31;
        if (!request and data[4] != 0x32) return error.UnsupportedOpcode;
        const prefix: usize = if (request) 18 else 14;
        if (data.len < prefix or data[5] != 0 or data[6] != 0 or data[9] != 0 or data[10] != 0) return error.InvalidMessage;
        return .{ .version = data[1], .opcode = data[4], .function = std.mem.readInt(u16, data[7..9], .big), .sequence = std.mem.readInt(u16, data[11..13], .big), .session = if (request) std.mem.readInt(u32, data[13..17], .big) else 0, .flags = data[prefix - 1], .body = data[prefix..] };
    }
};

pub const Notification = struct {
    version: u8,
    subscription: u32,
    payload: []const u8,

    pub fn parse(data: []const u8) !Notification {
        if (data.len < 9 or data.len > limit or data[0] != 0x72 or data[1] != 2 or data[4] != 0x33) return error.InvalidNotification;
        if (std.mem.readInt(u16, data[2..4], .big) != data.len - 4) return error.InvalidLength;
        return .{ .version = data[1], .subscription = std.mem.readInt(u32, data[5..9], .big), .payload = data[9..] };
    }
};

pub const NotificationQueue = struct {
    frames: [4][limit]u8 = undefined,
    lengths: [4]usize = @splat(0),
    head: usize = 0,
    count: usize = 0,

    pub fn push(self: *NotificationQueue, data: []const u8) !void {
        _ = try Notification.parse(data);
        if (self.count == self.frames.len) return error.NotificationQueueFull;
        const slot = (self.head + self.count) % self.frames.len;
        @memcpy(self.frames[slot][0..data.len], data);
        self.lengths[slot] = data.len;
        self.count += 1;
    }
    pub fn pop(self: *NotificationQueue, output: []u8) !?Notification {
        if (self.count == 0) return null;
        const length = self.lengths[self.head];
        if (output.len < length) return error.BufferTooSmall;
        @memcpy(output[0..length], self.frames[self.head][0..length]);
        self.head = (self.head + 1) % self.frames.len;
        self.count -= 1;
        return try Notification.parse(output[0..length]);
    }
};

pub const State = struct {
    session: u32 = 0x70001001,
    context: u32 = 0x70001002,
    client: u32 = 0x11e1a301,
    role: u32 = 2,
    version: []const u8 = &.{},
    tls_secret: ?[32]u8 = null,
    negotiated: bool = false,
    authentication: @import("authentication.zig").Session = .{},
    best_effort: bool = false,
    transaction: ?*backend.Transaction = null,
    transaction_rid: u32 = 0,
    transaction_serial: u16 = 0,
    read_counter: u32 = 0,
    write_counter: u32 = 3,
    backend: ?*backend.Backend = null,
    subscriptions: [subscriptions.max_subscriptions]subscriptions.Subscription = @splat(.{}),
    pub fn close(self: *State) void {
        self.deinit();
        if (self.tls_secret) |*secret| std.crypto.utils.secureZero(u8, secret);
        self.tls_secret = null;
        std.crypto.utils.secureZero(u8, &self.authentication.challenge);
    }
    pub fn deinit(self: *State) void {
        if (self.transaction) |transaction| {
            self.backend = transaction.source;
            self.transaction = null;
            self.transaction_rid = 0;
            transaction.close();
        }
    }
};

fn findSubscription(state: *State, rid: u32) ?*subscriptions.Subscription {
    for (&state.subscriptions) |*subscription| if (subscription.rid == rid and rid != 0) return subscription;
    return null;
}

fn passwordRequired(state: *const State) bool {
    return if (state.backend) |store| store.authentication.digest != null else false;
}

fn authenticate(state: *State, raw: []const u8) !u64 {
    if (raw.len != 23 or !std.mem.eql(u8, raw[0..3], &.{ 0x10, 2, 20 })) return error.InvalidProof;
    const store = state.backend orelse return error.AuthenticationDisabled;
    return state.authentication.verify(&store.authentication, raw[3..]);
}

fn readAttribute(writer: *Writer, state: *State, rid_value: u32, aid: u64) !u64 {
    if (rid_value == state.session) {
        switch (aid) {
            299 => try writer.uint(state.role),
            300 => try writer.rid(state.client),
            301 => try writer.string("zOMSp_native_reference_port"),
            303 => {
                state.authentication.issue();
                try writer.put(&.{ 0x10, 2, 20 });
                try writer.put(&state.authentication.challenge);
            },
            1842 => try writer.uint(if (state.authentication.authenticated) 1 else 4),
            1903 => try writer.uint(4096),
            1905 => try writer.put(&.{ 0, 8, 0x7f }),
            else => return 0xa03388000088ffe0,
        }
        return 0;
    }
    if (findSubscription(state, rid_value)) |subscription| {
        switch (aid) {
            1049 => try writer.uint(subscription.cycle_ms),
            1051 => try writer.put(&.{ 0, 2, @intFromBool(subscription.disabled) }),
            1053 => {
                try writer.put(&.{ 0, 7 });
                try writer.be16(@bitCast(subscription.credit_limit));
            },
            else => return 0xa03388000088ffe0,
        }
        return 0;
    }
    if (passwordRequired(state) and !state.authentication.authenticated) return error.AuthenticationRequired;
    const store = state.backend orelse return 0x8020ab00199afff4;
    if (aid > std.math.maxInt(u32)) return error.InvalidAddress;
    var bytes: [backend.max_value_bytes]u8 = undefined;
    const value = store.get(rid_value, @intCast(aid), &bytes) catch |err| switch (err) {
        error.ObjectNotFound => return 0x8020ab00199afff4,
        error.AttributeNotFound => return 0xa03388000088ffe0,
        else => return err,
    };
    var reader = Reader{ .data = value };
    _ = try reader.value(0);
    if (reader.offset != value.len) return error.InvalidValue;
    try writer.put(value);
    return 0;
}

pub fn object(reader: *Reader, state: *State, depth: usize) anyerror!void {
    if (depth >= 8 or try reader.byte() != 0xa1) return error.InvalidObject;
    _ = try reader.u32be();
    const class = try reader.vlq();
    if ((depth == 0 and class != 0x11f) or (depth != 0 and class != 0xff)) return error.UnsupportedObject;
    _ = try reader.vlq();
    _ = try reader.vlq();
    var count: usize = 0;
    while (count < 64) : (count += 1) {
        const tag = try reader.byte();
        switch (tag) {
            0xa2 => return,
            0xa1 => {
                reader.offset -= 1;
                try object(reader, state, depth + 1);
            },
            0xa3 => {
                const aid = try reader.vlq();
                const value = try reader.value(0);
                if (aid == 299 and value.kind == 4 and value.number <= 0xffffffff) state.role = @intCast(value.number);
                if (aid == 300 and value.kind == 0x12) state.client = @intCast(value.number);
                if (aid == 306 and value.kind == 0x17) state.version = value.raw;
            },
            else => return error.UnsupportedObjectField,
        }
    }
    return error.ObjectLimit;
}

fn attribute(writer: *Writer, aid: u32) !void {
    try writer.byte(0xa3);
    try writer.vlq(aid);
}
fn openObject(writer: *Writer, rid_value: u32, class: u32, flags: u8) !void {
    try writer.byte(0xa1);
    try writer.be32(rid_value);
    try writer.vlq(class);
    try writer.vlq(flags);
    try writer.byte(0);
}

pub fn createRequest(writer: *Writer, sequence: u16, client: u32) ![]const u8 {
    try writer.begin(1, 0x31, 0x4ca, sequence, 0x120, 0x36);
    try writer.be32(0x11d);
    try writer.uint(0);
    try writer.be32(0);
    try openObject(writer, 0xd3, 0x11f, 0);
    try attribute(writer, 233);
    try writer.string("zOMSp_Client");
    try attribute(writer, 289);
    try writer.string("6::127.0.0.1:6.0:6.0:");
    for ([_]u32{ 296, 297, 298, 301 }) |aid| {
        try attribute(writer, aid);
        try writer.string("");
    }
    try attribute(writer, 299);
    try writer.uint(2);
    try attribute(writer, 300);
    try writer.rid(client);
    try openObject(writer, 0xd3, 0xff, 0);
    try attribute(writer, 233);
    try writer.string("SubscriptionContainer");
    try writer.put(&.{ 0xa2, 0xa2 });
    try writer.be32(0);
    return writer.finish();
}

pub fn createReply(writer: *Writer, request: Message, state: *State) ![]const u8 {
    try writer.begin(1, 0x32, 0x4ca, request.sequence, null, request.flags);
    try writer.byte(0);
    try writer.byte(2);
    try writer.vlq(state.session);
    try writer.vlq(state.context);
    try openObject(writer, 0x120, 0x11f, 1);
    try attribute(writer, 233);
    try writer.string("zOMSp");
    try attribute(writer, 299);
    try writer.uint(state.role);
    try attribute(writer, 301);
    try writer.string("zOMSp_native_reference_port");
    try attribute(writer, 303);
    try writer.put(&.{ 0x10, 2, 20 });
    state.authentication.issue();
    try writer.put(&state.authentication.challenge);
    try attribute(writer, 306);
    try writer.put(&.{ 0, 0x17 });
    try writer.be32(0x13a);
    for ([_]u32{ 315, 316, 317, 318 }) |aid| {
        try writer.vlq(aid);
        try writer.uint(if (aid < 317) (if (passwordRequired(state)) state.backend.?.authentication.profile else 0x400) else 0x802001);
    }
    for ([_]u32{ 319, 320 }) |aid| {
        try writer.vlq(aid);
        try writer.string("");
    }
    try writer.vlq(321);
    try writer.put(&.{ 0, 3, 0, 3, 0, 0xa2 });
    try writer.be32(0);
    return writer.finish();
}

pub fn reply(writer: *Writer, request: Message, state: *State) ![]const u8 {
    var candidate = state.*;
    const result = try replyInner(writer, request, &candidate);
    state.* = candidate;
    return result;
}

fn replyInner(writer: *Writer, request: Message, state: *State) ![]const u8 {
    if (request.opcode != 0x31) return error.InvalidMessage;
    var reader = Reader{ .data = request.body };
    if (request.function == 0x4ca and request.version == 1) {
        if (try reader.u32be() != 0x11d) return error.UnsupportedObject;
        _ = try reader.value(0);
        _ = try reader.u32be();
        try object(&reader, state, 0);
        if (try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
        return createReply(writer, request, state);
    }
    if (request.version != 2 or request.session != state.session) return error.InvalidSession;
    if (passwordRequired(state) and !state.authentication.authenticated and request.function != 0x542 and request.function != 0x4f2 and request.function != 0x586 and request.function != 0x54c and request.function != 0x57c and request.function != 0x4d4) return error.AuthenticationRequired;
    if (request.function == 0x556 or request.function == 0x560) {
        if (!state.negotiated) return error.NotNegotiated;
        var sequence_type: u8 = 0;
        var directives: []const u8 = &.{};
        var abort = false;
        if (request.function == 0x556) {
            if (state.best_effort or state.transaction != null) return error.InvalidSequenceState;
            sequence_type = try reader.byte();
            const value = try reader.value(0);
            if (sequence_type == 1) {
                if (value.kind != 0) return error.UnsupportedSequence;
            } else if (sequence_type == 2) {
                if (value.raw[0] != 0 or value.kind != 1 or value.number != 0) return error.UnsupportedSequence;
            } else return error.UnsupportedSequence;
        } else {
            const flag = try reader.byte();
            if (flag > 1 or (!state.best_effort and state.transaction == null)) return error.InvalidSequenceState;
            abort = flag != 0;
            if (try reader.signed(32) != @as(u64, if (state.transaction != null) 1 else 0)) return error.UnsupportedSequence;
        }
        const counter = try reader.vlq();
        if (counter > std.math.maxInt(u32) / 2 or counter != @as(u64, state.write_counter) + 1) return error.InvalidIntegrity;
        if (sequence_type == 2) {
            var descriptor: CreatePlan = .{};
            try descriptor.parse(&reader, 0, 0);
            if (descriptor.node_count != 1 or descriptor.nodes[0].class != 1700) return error.UnsupportedSequence;
            for (descriptor.values[0..descriptor.value_count]) |field| {
                if (field.aid == 1702) {
                    if (directives.len != 0 or field.value.len < 3 or field.value.len > backend.max_value_bytes or field.value[0] != 0x40 or field.value[1] != 0x16) return error.UnsupportedActivation;
                    const store = state.backend orelse return error.UnsupportedActivation;
                    if (store.activator == null) return error.UnsupportedActivation;
                    directives = field.value;
                } else if (field.aid != 233 or field.value.len < 2 or field.value[0] != 0 or field.value[1] != 0x15) return error.UnsupportedActivation;
            }
        }
        if (try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
        const supported = sequence_type != 2 or (state.backend != null and state.backend.?.transactions_enabled);
        var status: u64 = if (supported) 0 else 0xa201a3002ae3ff19;
        if (request.function == 0x560 and !abort) if (state.transaction) |transaction| {
            if (transaction.directives_length != 0) {
                const activator = transaction.source.activator orelse return error.UnsupportedActivation;
                const call: application.Invocation = .{ .target = state.transaction_rid, .method = 0x560, .session = state.session, .client = state.client, .role = state.role };
                const image = std.mem.asBytes(transaction.shadow.data);
                status = activator.callback(activator.user, &call, &transaction.directives, transaction.directives_length, image.ptr, image.len);
            }
        };
        try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
        try writer.vlq(status);
        if (request.function == 0x556) {
            if (sequence_type == 2 and supported) {
                if (state.transaction_serial == 0x7ff) return error.ObjectLimit;
                try writer.rid(0x70001800 + @as(u32, state.transaction_serial) + 1);
            } else try writer.put(&.{ 0, 0 });
        }
        try writer.vlq(counter << 1);
        try writer.be32(0);
        const response = try writer.finish();
        if (supported) {
            if (sequence_type == 2) {
                const transaction = try backend.Transaction.open(state.backend.?, std.heap.page_allocator);
                @memcpy(transaction.directives[0..directives.len], directives);
                transaction.directives_length = directives.len;
                state.transaction = transaction;
                state.transaction_serial += 1;
                state.transaction_rid = 0x70001800 + @as(u32, state.transaction_serial);
                state.backend = &transaction.shadow;
            } else if (request.function == 0x556) state.best_effort = true else if (state.transaction) |transaction| {
                if (!abort and status == 0) try transaction.commit();
                state.deinit();
            } else state.best_effort = false;
        }
        state.write_counter = @intCast(counter);
        return response;
    }
    const target = try reader.u32be();
    if (passwordRequired(state) and !state.authentication.authenticated and target != state.session) return error.AuthenticationRequired;
    if (state.transaction != null and (request.function == 0x542 or request.function == 0x4f2 or request.function == 0x57c or request.function == 0x4ca or request.function == 0x4d4) and
        (target == state.session or target == state.context or findSubscription(state, target) != null)) return error.UnsupportedTransactionTarget;
    if (!state.negotiated and request.function != 0x542) return error.NotNegotiated;
    if (!state.negotiated and target != state.session) return error.InvalidSession;
    if (request.function == 0x56b) {
        if (state.transaction != null) return error.UnsupportedTransactionInvoke;
        const method_id = try reader.u32be();
        const arguments_start = reader.offset;
        try invokeArguments(&reader);
        const arguments = reader.data[arguments_start..reader.offset];
        if (arguments.len > application.invoke_bytes) return error.ValueLimit;
        const integrity = try reader.vlq();
        if (integrity > std.math.maxInt(u32) / 2 or integrity != @as(u64, state.write_counter) + 1) return error.InvalidIntegrity;
        if (try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
        var status: u64 = 0x8020ab00199afff4;
        var result_buffer: [application.invoke_bytes]u8 = undefined;
        var result_length: usize = 0;
        if (state.backend) |store| {
            if (store.methods.find(target, method_id)) |method| {
                const target_info = store.info(target) catch |err| switch (err) {
                    error.ObjectNotFound => null,
                    else => return err,
                };
                if (target_info != null) {
                    const invocation: application.Invocation = .{ .target = target, .method = method_id, .session = state.session, .client = state.client, .role = state.role };
                    status = method.callback(method.user, &invocation, arguments.ptr, arguments.len, &result_buffer, result_buffer.len, &result_length);
                    if (status & 0x8000000000000000 == 0) {
                        if (result_length > result_buffer.len) return error.InvalidHandlerReply;
                        var result_reader: Reader = .{ .data = result_buffer[0..result_length] };
                        _ = try result_reader.value(0);
                        try invokeArguments(&result_reader);
                        if (result_reader.offset != result_length) return error.InvalidHandlerReply;
                    }
                }
            }
        }
        try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
        try writer.vlq(status);
        if (status & 0x8000000000000000 == 0) try writer.put(result_buffer[0..result_length]) else try writer.put(&.{ 0, 0, 0, 0 });
        try writer.vlq(integrity << 1);
        try writer.be32(0);
        const result = try writer.finish();
        state.write_counter = @intCast(integrity);
        return result;
    }
    if (request.function == 0x4bb) return explore(writer, request, state, target, &reader);
    if (request.function == 0x524) {
        const aid = try reader.vlq();
        if (aid == 0 or aid > std.math.maxInt(u32) or (try reader.value(0)).kind != 0) return error.InvalidAddress;
        const integrity = try reader.vlq();
        if (integrity > std.math.maxInt(u32) / 4 or integrity != @as(u64, state.read_counter) + 1) return error.InvalidIntegrity;
        if (try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
        var buffer: [backend.max_value_bytes]u8 = undefined;
        var targets: []const u8 = &.{};
        var status: u64 = 0xa02681000081ffc1;
        const virtual_object = target == state.session or target == state.context or findSubscription(state, target) != null;
        if (!virtual_object) {
            if (state.backend) |store| {
                const value = store.snapshot(target, @intCast(aid), &buffer) catch |err| switch (err) {
                    error.ObjectNotFound => null,
                    error.AttributeNotFound => null,
                    else => return err,
                };
                if (value) |snapshot| {
                    if (snapshot.flags == 2) {
                        const raw = snapshot.value;
                        if (raw.len < 3 or raw[0] != 0x10 or raw[1] != 0x12 or raw[2] > 16 or raw.len != 3 + @as(usize, raw[2]) * 4) return error.InvalidLayout;
                        targets = raw[3..];
                        status = 0;
                    }
                } else {
                    _ = store.info(target) catch |err| switch (err) {
                        error.ObjectNotFound => {
                            status = 0x8020ab00199afff4;
                        },
                        else => return err,
                    };
                }
            } else status = 0x8020ab00199afff4;
        }
        try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
        try writer.vlq(status);
        try writer.vlq(targets.len / 4);
        try writer.put(targets);
        try writer.vlq((integrity << 2) | 1);
        try writer.be32(0);
        const response = try writer.finish();
        state.read_counter = @intCast(integrity);
        return response;
    }
    if (request.function == 0x4ca) {
        if (!state.negotiated) return error.UnsupportedObject;
        _ = try reader.value(0);
        if (try reader.u32be() != 0) return error.InvalidRequestFlags;
        const integrity = try reader.vlq();
        if (integrity > std.math.maxInt(u32) / 2 or integrity != @as(u64, state.write_counter) + 1) return error.InvalidIntegrity;
        const object_start = reader.offset;
        if (try reader.byte() != 0xa1) return error.InvalidObject;
        _ = try reader.u32be();
        const class = try reader.vlq();
        if (class == 1001 and state.transaction != null) return error.UnsupportedSequence;
        if (class != 1001) {
            reader.offset = object_start;
            var plan: CreatePlan = .{};
            try plan.parse(&reader, target, 0);
            if (try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
            const store = state.backend orelse return error.ObjectNotFound;
            var assigned: [8]u32 = undefined;
            try store.createBatch(plan.nodes[0..plan.node_count], plan.values[0..plan.value_count], assigned[0..plan.node_count]);
            try writer.begin(2, 0x32, 0x4ca, request.sequence, null, request.flags);
            try writer.byte(0);
            try writer.vlq(plan.node_count);
            for (assigned[0..plan.node_count]) |rid| try writer.vlq(rid);
            try writer.vlq(integrity << 1);
            try writer.be32(0);
            const response = try writer.finish();
            state.write_counter = @intCast(integrity);
            return response;
        }
        if (target != state.context or try reader.vlq() != 0 or try reader.vlq() != 0) return error.UnsupportedObject;
        var selected: ?*subscriptions.Subscription = null;
        for (&state.subscriptions, 0..) |*subscription, index| {
            if (subscription.rid == 0) {
                selected = subscription;
                subscription.rid = state.context + 1 + @as(u32, @intCast(index));
                break;
            }
        }
        const subscription = selected orelse return error.SubscriptionLimit;
        var closed = false;
        for (0..32) |_| {
            const tag = try reader.byte();
            if (tag == 0xa2) {
                closed = true;
                break;
            }
            if (tag != 0xa3) return error.UnsupportedObjectField;
            const aid = try reader.vlq();
            const value = try reader.value(0);
            try subscription.set(aid, value, Reader);
        }
        if (!closed or try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
        var any_reference = false;
        for (&subscription.references) |*reference| if (reference.handle != 0) {
            any_reference = true;
        };
        subscription.pending_empty = any_reference;
        state.write_counter = @intCast(integrity);
        try writer.begin(2, 0x32, 0x4ca, request.sequence, null, request.flags);
        try writer.put(&.{ 0, 1 });
        try writer.vlq(subscription.rid);
        try writer.vlq(integrity << 1);
        try writer.be32(0);
        return writer.finish();
    }
    var updates: [16]backend.Update = undefined;
    var update_buffers: [16][backend.max_value_bytes]u8 = undefined;
    var update_count: usize = 0;
    var parsed_integrity: ?u32 = null;
    var authentication_status: ?u64 = null;
    var delete_object: ?u32 = null;
    try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
    try writer.byte(0);
    switch (request.function) {
        0x542 => {
            const count = try reader.vlq();
            if (count == 0 or count > 16) return error.ValueLimit;
            var items: [16]Address = undefined;
            try addresses(&reader, target, @intCast(count), try reader.vlq(), &items);
            if (state.transaction != null) for (items[0..@intCast(count)]) |item| {
                if (item.rid == state.session or item.rid == state.context or findSubscription(state, item.rid) != null) return error.UnsupportedTransactionTarget;
            };
            var seen: u16 = 0;
            for (0..@intCast(count)) |_| {
                const index = try reader.vlq();
                if (index == 0 or index > count) return error.InvalidIndex;
                const bit = @as(u16, 1) << @as(u4, @intCast(index - 1));
                if (seen & bit != 0) return error.InvalidIndex;
                seen |= bit;
                const value = try reader.value(0);
                const address = items[@intCast(index - 1)];
                if (passwordRequired(state) and !state.authentication.authenticated and address.rid != state.session) return error.AuthenticationRequired;
                if (findSubscription(state, address.rid)) |subscription| {
                    if (address.path_len != 0) return error.UnsupportedAddress;
                    try subscription.set(address.aid, value, Reader);
                    continue;
                }
                if (address.rid != state.session) {
                    var raw = value.raw;
                    var generation: ?u64 = null;
                    if (address.path_len != 0) {
                        const store = state.backend orelse return error.ObjectNotFound;
                        var original: [backend.max_value_bytes]u8 = undefined;
                        const snapshot = try store.snapshot(address.rid, address.aid, &original);
                        generation = snapshot.generation;
                        var replacement: Writer = .{};
                        try replaceValue(&replacement, snapshot.value, address.path[0..address.path_len], raw);
                        if (replacement.used > backend.max_value_bytes) return error.ValueLimit;
                        @memcpy(update_buffers[update_count][0..replacement.used], replacement.data[0..replacement.used]);
                        raw = update_buffers[update_count][0..replacement.used];
                    }
                    updates[update_count] = .{ .rid = address.rid, .aid = address.aid, .value = raw, .generation = generation };
                    update_count += 1;
                    continue;
                }
                if (address.path_len != 0) return error.UnsupportedAddress;
                if (address.aid == 299 and value.kind == 4) {
                    if (value.number != 1 and value.number != 2 and value.number != 32) return error.InvalidRole;
                    state.role = @intCast(value.number);
                }
            }
            try writer.byte(0);
        },
        0x54c => {
            const count = try reader.vlq();
            if (count == 0 or count > 16) return error.ValueLimit;
            var items: [16]Address = undefined;
            try addresses(&reader, target, @intCast(count), try reader.vlq(), &items);
            var errors: [16]u64 = @splat(0);
            var values: Writer = .{};
            for (0..@intCast(count)) |index| {
                const address = items[index];
                const before = values.used;
                try values.vlq(index + 1);
                errors[index] = try readAddress(&values, state, address);
                if (errors[index] != 0) {
                    values.used = before;
                    if (target == 0) {
                        try values.vlq(index + 1);
                        try values.put(&.{ 0, 0 });
                    }
                }
            }
            var failed: u64 = 0;
            for (errors[0..@intCast(count)]) |status| {
                if (status != 0) failed = status;
            }
            if (target == 0) {
                try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
                try writer.vlq(if (failed == 0) 0 else 0x2027800000a40013);
                try writer.put(values.data[0..values.used]);
                try writer.byte(0);
                for (errors[0..@intCast(count)], 0..) |status, index| if (status != 0) {
                    try writer.vlq(index + 1);
                    try writer.vlq(status);
                };
                try writer.byte(0);
            } else {
                if (failed == 0) try writer.put(values.data[0..values.used]) else {
                    try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
                    try writer.vlq(if (failed == 0x8020ab00199afff4) failed else 0xa0278800004fffe0);
                    if (failed != 0x8020ab00199afff4) for (0..@intCast(count)) |index| {
                        try writer.vlq(index + 1);
                        try writer.put(&.{ 0, 0 });
                    };
                }
                try writer.byte(0);
                try writer.byte(0);
            }
        },
        0x586 => {
            const address = try streamedAddress(&reader, target);
            try writer.byte(0);
            var value_writer: Writer = .{};
            var status = try readAttribute(&value_writer, state, target, address.aid);
            if (status == 0) {
                const raw = nestedValue(value_writer.data[0..value_writer.used], address.path[0..address.path_len]) catch null;
                if (raw) |value| try writer.put(value) else status = 0xa03388000088ffe0;
            }
            if (status != 0) {
                try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
                try writer.vlq(status);
                try writer.put(&.{ 0, 0, 0 });
            }
        },
        0x4f2 => {
            if (try reader.vlq() != 1) return error.UnsupportedAttribute;
            const aid = try reader.vlq();
            const value = try reader.value(0);
            if (findSubscription(state, target)) |subscription| {
                try subscription.set(aid, value, Reader);
            } else if (target == state.session) {
                if (aid == 1846) {
                    const store = state.backend orelse return error.AuthenticationDisabled;
                    authentication_status = try state.authentication.verifyModern(&store.authentication, state.tls_secret orelse return error.TlsRequired, value.raw);
                } else if (aid == 304) {
                    authentication_status = try authenticate(state, value.raw);
                } else {
                    if (aid != 299) return error.UnsupportedAttribute;
                    if (value.kind != 4 or !(value.number == state.role or (state.role == 2 and value.number == 32))) return error.InvalidRole;
                    state.role = @intCast(value.number);
                }
            } else {
                if (aid > std.math.maxInt(u32)) return error.InvalidAddress;
                updates[0] = .{ .rid = target, .aid = @intCast(aid), .value = value.raw };
                update_count = 1;
            }
        },
        0x57c => {
            const address = try streamedAddress(&reader, target);
            if (!std.mem.eql(u8, try reader.take(qualifier_bytes.len), &qualifier_bytes)) return error.UnsupportedQualifier;
            if (try reader.byte() != 0 or try reader.byte() != 1) return error.InvalidRequestFlags;
            const value = try reader.value(0);
            if (findSubscription(state, target)) |subscription| {
                if (address.path_len != 0) return error.UnsupportedAddress;
                try subscription.set(address.aid, value, Reader);
            } else if (target == state.session) {
                if (address.aid == 1846 and address.path_len == 0) {
                    const store = state.backend orelse return error.AuthenticationDisabled;
                    authentication_status = try state.authentication.verifyModern(&store.authentication, state.tls_secret orelse return error.TlsRequired, value.raw);
                } else if (address.aid == 304 and address.path_len == 0) {
                    authentication_status = try authenticate(state, value.raw);
                } else {
                    if (address.aid != 299 or address.path_len != 0) return error.UnsupportedAttribute;
                    if (value.kind != 4 or !(value.number == state.role or (state.role == 2 and value.number == 32))) return error.InvalidRole;
                    state.role = @intCast(value.number);
                }
            } else {
                updates[0] = .{ .rid = target, .aid = address.aid, .value = value.raw };
                if (address.path_len != 0) {
                    const store = state.backend orelse return error.ObjectNotFound;
                    var original: [backend.max_value_bytes]u8 = undefined;
                    const snapshot = try store.snapshot(target, address.aid, &original);
                    var replacement: Writer = .{};
                    try replaceValue(&replacement, snapshot.value, address.path[0..address.path_len], value.raw);
                    if (replacement.used > backend.max_value_bytes) return error.ValueLimit;
                    @memcpy(update_buffers[0][0..replacement.used], replacement.data[0..replacement.used]);
                    updates[0].value = update_buffers[0][0..replacement.used];
                    updates[0].generation = snapshot.generation;
                }
                update_count = 1;
            }
            const counter = try reader.vlq();
            if (counter > std.math.maxInt(u32) or try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
            parsed_integrity = @intCast(counter);
        },
        0x4d4 => {
            if (findSubscription(state, target)) |subscription| subscription.* = .{} else if (target != state.session) delete_object = target;
            try writer.be32(target);
        },
        else => return error.UnsupportedRequest,
    }
    const read = request.function == 0x54c or request.function == 0x586;
    const integrity = parsed_integrity orelse try reader.finishRequest(request.function, request.function == 0x542 and !state.negotiated);
    if (request.function == 0x542 and !state.negotiated and integrity == 0) {
        state.negotiated = true;
    } else {
        const counter = if (read) &state.read_counter else &state.write_counter;
        if (counter.* == std.math.maxInt(u32) or integrity != counter.* + 1) return error.InvalidIntegrity;
        counter.* = integrity;
    }
    if (authentication_status) |status| {
        try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
        try writer.vlq(status);
    }
    const response_integrity = if (read) (@as(u64, integrity) << 2) | 1 else @as(u64, integrity) << 1;
    if (response_integrity > std.math.maxInt(u32)) return error.Overflow;
    try writer.vlq(response_integrity);
    try writer.be32(0);
    const response = try writer.finish();
    if (delete_object) |rid| {
        const store = state.backend orelse return error.ObjectNotFound;
        try store.removeApplication(rid);
    }
    if (update_count != 0) {
        const store = state.backend orelse return error.ObjectNotFound;
        try store.write(updates[0..update_count]);
    }
    return response;
}

fn readAddress(writer: *Writer, state: *State, address: Address) !u64 {
    if (address.path_len == 0) return readAttribute(writer, state, address.rid, address.aid);
    var value_writer: Writer = .{};
    const status = try readAttribute(&value_writer, state, address.rid, address.aid);
    if (status != 0) return status;
    const value = nestedValue(value_writer.data[0..value_writer.used], address.path[0..address.path_len]) catch return 0xa03388000088ffe0;
    try writer.put(value);
    return 0;
}

fn streamedAddress(reader: *Reader, target: u32) !Address {
    if (target == 0 or try reader.byte() != 0x20 or try reader.byte() != 4) return error.InvalidAddress;
    const count = try reader.vlq();
    if (count == 0 or count > 4) return error.InvalidAddress;
    const aid = try reader.vlq();
    if (aid == 0 or aid > std.math.maxInt(u32)) return error.InvalidAddress;
    var address: Address = .{ .rid = target, .aid = @intCast(aid), .path_len = @intCast(count - 1) };
    for (address.path[0..address.path_len]) |*part| {
        const id = try reader.vlq();
        if (id == 0 or id > std.math.maxInt(u32)) return error.InvalidAddress;
        part.* = @intCast(id);
    }
    return address;
}

const CreatePlan = struct {
    nodes: [8]backend.CreateNode = undefined,
    values: [32]backend.InitialValue = undefined,
    node_count: usize = 0,
    value_count: usize = 0,

    fn parse(self: *CreatePlan, reader: *Reader, parent: u32, depth: usize) anyerror!void {
        if (depth >= 8 or self.node_count == self.nodes.len) return error.ObjectLimit;
        if (try reader.byte() != 0xa1) return error.InvalidObject;
        const temporary = try reader.u32be();
        const class = try reader.vlq();
        if (class == 0 or class > std.math.maxInt(u32) or try reader.vlq() != 0 or try reader.vlq() != 0) return error.UnsupportedObject;
        const index = self.node_count;
        self.node_count += 1;
        self.nodes[index] = .{ .temporary = temporary, .parent = parent, .class = @intCast(class), .first = self.value_count, .count = 0 };
        var children = false;
        while (true) {
            const tag = try reader.byte();
            switch (tag) {
                0xa2 => return,
                0xa1 => {
                    children = true;
                    reader.offset -= 1;
                    try self.parse(reader, temporary, depth + 1);
                },
                0xa3 => {
                    if (children or self.value_count == self.values.len) return error.ValueLimit;
                    const aid = try reader.vlq();
                    if (aid == 0 or aid > std.math.maxInt(u32)) return error.InvalidAddress;
                    const value = try reader.value(0);
                    self.values[self.value_count] = .{ .aid = @intCast(aid), .value = value.raw };
                    self.value_count += 1;
                    self.nodes[index].count += 1;
                },
                else => return error.UnsupportedObjectField,
            }
        }
    }
};

const ExploreFilter = struct {
    operation: u8 = 0,
    address_count: u8 = 0,
    address: [4]u32 = @splat(0),
    value: []const u8 = &.{},
};

fn exploreFilters(reader: *Reader, output: *[10]ExploreFilter) ![]const ExploreFilter {
    var indices: [10]u32 = undefined;
    var count: usize = 0;
    while (true) {
        const index = try reader.vlq();
        if (index == 0) return output[0..count];
        if (index > std.math.maxInt(u32) or count == output.len) return error.ValueLimit;
        if (std.mem.indexOfScalar(u32, indices[0..count], @intCast(index)) != null) return error.InvalidIndex;
        indices[count] = @intCast(index);
        const value = try reader.value(0);
        if (value.kind != 0x17 or value.number != 1246 or value.raw[0] != 0) return error.UnsupportedFilter;
        var fields: Reader = .{ .data = value.raw[6..] };
        var filter: ExploreFilter = .{};
        var seen: u8 = 0;
        while (true) {
            const aid = try fields.vlq();
            if (aid == 0) break;
            if (aid != 1247 and aid != 1249 and aid != 1250 and aid != 1251) return error.UnsupportedFilter;
            const bit: u8 = switch (aid) {
                1247 => 1,
                1249 => 2,
                1250 => 4,
                1251 => 8,
                else => unreachable,
            };
            if (seen & bit != 0) return error.InvalidValue;
            seen |= bit;
            const field = try fields.value(0);
            switch (aid) {
                1247 => {
                    if (field.raw[0] != 0 or field.kind != 8 or field.number < 1 or (field.number > 8 and field.number != 11) or field.number == 7) return error.UnsupportedFilter;
                    filter.operation = @intCast(field.number);
                },
                1249 => {
                    if (field.raw[0] != 0 or field.kind != 4 or field.number > filter.address.len) return error.UnsupportedFilter;
                    filter.address_count = @intCast(field.number);
                },
                1250 => {
                    if (field.raw[0] != 0x10 or field.kind != 4) return error.UnsupportedFilter;
                    var addresses_reader: Reader = .{ .data = field.raw[2..] };
                    if (try addresses_reader.vlq() != 32) return error.UnsupportedFilter;
                    for (0..32) |slot| {
                        const address = try addresses_reader.vlq();
                        if (address > std.math.maxInt(u32)) return error.InvalidAddress;
                        if (slot < filter.address.len) filter.address[slot] = @intCast(address);
                    }
                },
                1251 => filter.value = field.raw,
                else => unreachable,
            }
        }
        if (seen != 15 or (filter.operation != 8 and filter.operation != 11 and filter.address_count == 0)) return error.UnsupportedFilter;
        for (filter.address[0..filter.address_count]) |aid| if (aid == 0) return error.InvalidAddress;
        output[count] = filter;
        count += 1;
    }
}

fn compareFilter(filter: ExploreFilter, actual: []const u8) !bool {
    var left_reader: Reader = .{ .data = actual };
    var right_reader: Reader = .{ .data = filter.value };
    const left = try left_reader.value(0);
    const right = try right_reader.value(0);
    if (left.raw[0] != 0 or right.raw[0] != 0 or left.kind != right.kind) return filter.operation == 2;
    const numeric = struct {
        fn number(value: Value) !i128 {
            return switch (value.kind) {
                1, 2, 3, 4, 5, 0x0a, 0x0b, 0x0c, 0x0d, 0x10, 0x12, 0x13 => @as(i128, value.number),
                6 => @as(i8, @bitCast(@as(u8, @truncate(value.number)))),
                7 => @as(i16, @bitCast(@as(u16, @truncate(value.number)))),
                8 => @as(i32, @bitCast(@as(u32, @truncate(value.number)))),
                9, 0x11 => @as(i64, @bitCast(value.number)),
                else => error.UnsupportedFilter,
            };
        }
    };
    const order: std.math.Order = if (left.kind == 0x15 or left.kind == 0) blk: {
        if (filter.operation > 2) return error.UnsupportedFilter;
        break :blk if (std.mem.eql(u8, actual, filter.value)) .eq else .lt;
    } else blk: {
        const first = try numeric.number(left);
        const second = try numeric.number(right);
        break :blk if (first < second) .lt else if (first > second) .gt else .eq;
    };
    return switch (filter.operation) {
        1 => order == .eq,
        2 => order != .eq,
        3 => order == .lt,
        4 => order != .gt,
        5 => order == .gt,
        6 => order != .lt,
        else => error.UnsupportedFilter,
    };
}

fn matchesExplore(state: *State, model: ?*const backend.Layout, rid_value: u32, class: u32, filters: []const ExploreFilter) !bool {
    for (filters) |filter| {
        if (filter.operation == 11) {
            if (!state.best_effort or filter.address_count != 0 or !std.mem.eql(u8, filter.value, &.{ 0, 0 })) return error.UnsupportedFilter;
            continue;
        }
        if (filter.operation == 8) {
            if (filter.address_count != 0) return error.UnsupportedFilter;
            var reader: Reader = .{ .data = filter.value };
            const value = try reader.value(0);
            if (value.raw[0] != 0 or value.kind != 0x12) return error.UnsupportedFilter;
            if (value.number != class) return false;
            continue;
        }
        var buffer: Writer = .{};
        const raw = if (model) |layout| blk: {
            for (&layout.values) |*entry| {
                if (entry.rid != rid_value or entry.aid != filter.address[0]) continue;
                if (entry.length < 2 or entry.length > backend.max_value_bytes or entry.flags > 1) return error.InvalidLayout;
                break :blk entry.value[0..entry.length];
            }
            return false;
        } else blk: {
            if (try readAttribute(&buffer, state, rid_value, filter.address[0]) != 0) return false;
            break :blk buffer.data[0..buffer.used];
        };
        const nested = nestedValue(raw, filter.address[1..filter.address_count]) catch |err| switch (err) {
            error.AttributeNotFound, error.UnsupportedValue => return false,
            else => return err,
        };
        if (!try compareFilter(filter, nested)) return false;
    }
    return true;
}

fn exploreFields(writer: *Writer, model: *const backend.Layout, object_info: *const backend.Object, aids: []const u32) !void {
    try openObject(writer, object_info.rid, object_info.class, 0);
    for (&model.values) |*entry| {
        if (entry.rid != object_info.rid or entry.flags == 2) continue;
        if (entry.length < 2 or entry.length > backend.max_value_bytes or entry.flags > 1) return error.InvalidLayout;
        if (aids.len != 0 and std.mem.indexOfScalar(u32, aids, entry.aid) == null) continue;
        var reader: Reader = .{ .data = entry.value[0..entry.length] };
        _ = try reader.value(0);
        if (reader.offset != reader.data.len) return error.InvalidValue;
        try attribute(writer, entry.aid);
        try writer.put(reader.data);
    }
}

fn exploreInfo(model: *const backend.Layout, rid_value: u32) !*const backend.Object {
    for (&model.objects) |*entry| if (entry.rid == rid_value and rid_value != 0) {
        if (entry.flags > 1) return error.InvalidLayout;
        return entry;
    };
    return error.ObjectNotFound;
}

fn exploreObject(writer: *Writer, state: *State, model: *const backend.Layout, rid_value: u32, aids: []const u32, recursive: bool, recursive_filter: bool, filters: []const ExploreFilter, depth: usize) anyerror!void {
    if (depth >= 8) return error.DepthLimit;
    const object_info = try exploreInfo(model, rid_value);
    if (object_info.class == 255 or object_info.flags == 1) return;
    const matched = try matchesExplore(state, model, rid_value, object_info.class, filters);
    if (matched) try exploreFields(writer, model, object_info, aids);
    if (recursive and (matched or recursive_filter)) for (&model.objects) |*child| {
        if (child.rid != 0 and child.parent == rid_value) try exploreObject(writer, state, model, child.rid, aids, true, recursive_filter, if (recursive_filter) filters else &.{}, depth + 1);
    };
    if (matched) try writer.byte(0xa2);
}

fn exploreAncestors(writer: *Writer, state: *State, model: *const backend.Layout, target: u32, aids: []const u32, recursive: bool) !void {
    var ancestors: [8]*const backend.Object = undefined;
    var count: usize = 0;
    var parent = (try exploreInfo(model, target)).parent;
    while (parent != 0) {
        if (parent == target or count == ancestors.len - 1) return error.DepthLimit;
        for (ancestors[0..count]) |entry| if (entry.rid == parent) return error.InvalidLayout;
        const entry = try exploreInfo(model, parent);
        if (entry.class == 255 or entry.flags == 1) return;
        ancestors[count] = entry;
        count += 1;
        parent = entry.parent;
    }
    if (count == 0) return;
    var index = count;
    while (index > 0) {
        index -= 1;
        try exploreFields(writer, model, ancestors[index], aids);
    }
    try exploreObject(writer, state, model, target, aids, recursive, false, &.{}, count);
    for (0..count) |_| try writer.byte(0xa2);
}

fn explore(writer: *Writer, request: Message, state: *State, target: u32, reader: *Reader) ![]const u8 {
    if (try reader.vlq() != 0) return error.UnsupportedExplore;
    const recursive = try reader.byte();
    const recursive_filter = try reader.byte();
    const with_parent = try reader.byte();
    if (recursive > 1 or recursive_filter > 1 or with_parent > 1) return error.UnsupportedExplore;
    var filter_buffer: [10]ExploreFilter = undefined;
    const filters = try exploreFilters(reader, &filter_buffer);
    if (with_parent != 0 and filters.len != 0) return error.UnsupportedExplore;
    const count = try reader.vlq();
    if (count > 64) return error.ValueLimit;
    var aids: [64]u32 = undefined;
    for (aids[0..@intCast(count)]) |*aid| {
        const id = try reader.vlq();
        if (id == 0 or id > std.math.maxInt(u32)) return error.InvalidAddress;
        aid.* = @intCast(id);
    }
    const integrity = try reader.vlq();
    if (integrity > std.math.maxInt(u32) / 4 or integrity != @as(u64, state.read_counter) + 1) return error.InvalidIntegrity;
    if (try reader.byte() != 0 or try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
    var parent: u32 = 0;
    var model: ?*backend.Layout = null;
    defer if (model) |copy| std.heap.page_allocator.destroy(copy);
    var found = target == state.session;
    if (found) parent = 285 else if (state.backend) |store| {
        model = try store.snapshotLayout(std.heap.page_allocator);
        for (&model.?.objects) |*entry| if (entry.rid == target and target != 0) {
            found = true;
            parent = entry.parent;
            break;
        };
    }
    try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
    try writer.vlq(if (found) 0 else 0x8020ab001a23fff4);
    try writer.be32(parent);
    try writer.vlq((integrity << 2) | 1);
    if (target == state.session and with_parent == 0 and try matchesExplore(state, null, target, 287, filters)) {
        try openObject(writer, state.session, 287, 0);
        for ([_]u32{ 299, 300, 301, 1842, 1903, 1905 }) |aid| {
            if (count != 0 and std.mem.indexOfScalar(u32, aids[0..@intCast(count)], aid) == null) continue;
            try attribute(writer, aid);
            if (try readAttribute(writer, state, state.session, aid) != 0) return error.UnsupportedAttribute;
        }
        try writer.byte(0xa2);
    } else if (found and target != state.session) {
        if (with_parent != 0) try exploreAncestors(writer, state, model.?, target, aids[0..@intCast(count)], recursive != 0) else try exploreObject(writer, state, model.?, target, aids[0..@intCast(count)], recursive != 0, recursive_filter != 0, filters, 0);
    }
    try writer.be32(0);
    const result = try writer.finish();
    state.read_counter = @intCast(integrity);
    return result;
}

fn invokeArguments(reader: *Reader) !void {
    for (0..2) |_| {
        var indices: [16]u32 = undefined;
        var count: usize = 0;
        while (true) {
            const index = try reader.vlq();
            if (index == 0) break;
            if (index > std.math.maxInt(u32) or count == indices.len) return error.ValueLimit;
            if (std.mem.indexOfScalar(u32, indices[0..count], @intCast(index)) != null) return error.InvalidIndex;
            indices[count] = @intCast(index);
            count += 1;
            _ = try reader.value(0);
        }
    }
}

fn nestedValue(raw: []const u8, path: []const u32) ![]const u8 {
    if (path.len == 0) return raw;
    var reader: Reader = .{ .data = raw };
    if (try reader.byte() != 0 or try reader.byte() != 0x17) return error.UnsupportedValue;
    _ = try reader.u32be();
    for (0..64) |_| {
        const aid = try reader.vlq();
        if (aid == 0) break;
        const value = try reader.value(0);
        if (aid == path[0]) return nestedValue(value.raw, path[1..]);
    }
    return error.AttributeNotFound;
}

fn replaceValue(writer: *Writer, raw: []const u8, path: []const u32, replacement: []const u8) anyerror!void {
    if (path.len == 0) {
        if (!backend.sameType(raw, replacement)) return error.TypeMismatch;
        return writer.put(replacement);
    }
    var reader: Reader = .{ .data = raw };
    if (try reader.byte() != 0 or try reader.byte() != 0x17) return error.UnsupportedValue;
    _ = try reader.u32be();
    try writer.put(raw[0..reader.offset]);
    var found = false;
    for (0..64) |_| {
        const aid = try reader.vlq();
        try writer.vlq(aid);
        if (aid == 0) {
            if (!found or reader.offset != raw.len) return error.AttributeNotFound;
            return;
        }
        const value = try reader.value(0);
        if (aid == path[0]) {
            if (found) return error.InvalidValue;
            try replaceValue(writer, value.raw, path[1..], replacement);
            found = true;
        } else try writer.put(value.raw);
    }
    return error.ValueLimit;
}

pub fn pollNotification(writer: *Writer, state: *State, now_us: i64) !?[]const u8 {
    if (state.transaction != null) return null;
    if (now_us < 0 or now_us > std.math.maxInt(i64) - 60_000_000) return error.InvalidTime;
    for (&state.subscriptions) |*subscription| {
        if (subscription.rid == 0 or subscription.disabled or now_us < subscription.next_due) continue;
        if (subscription.credits == 0) {
            if (subscription.cycle_ms != 0) {
                if (subscription.blocked and subscription.missed != std.math.maxInt(u16)) subscription.missed += 1;
                subscription.blocked = true;
                subscription.next_due = now_us + @as(i64, subscription.cycle_ms) * 1000;
            }
            continue;
        }
        writer.used = 0;
        try writer.put(&.{ 0x72, 2, 0, 0, 0x33 });
        try writer.be32(subscription.rid);
        try writer.put(&.{ 4, 0 });
        try writer.be16(subscription.missed);
        try writer.be16(0);
        try writer.byte(if (subscription.credit_limit == -1) 0 else subscription.credit_count +% 1);
        try writer.vlq(subscription.sequence);
        try writer.be64(@intCast(@max(0, now_us)));
        const phase_offset = writer.used;
        try writer.byte(if (subscription.pending_empty) 1 else 2);
        var delivered: usize = 0;
        var generations: [16]struct { reference: *subscriptions.Reference, generation: u64 } = undefined;
        if (!subscription.pending_empty) {
            const store = state.backend orelse continue;
            for (&subscription.references) |*reference| {
                if (reference.handle == 0) continue;
                var buffer: [backend.max_value_bytes]u8 = undefined;
                const snapshot = store.snapshot(reference.rid, reference.aid, &buffer) catch |err| switch (err) {
                    error.ObjectNotFound, error.AttributeNotFound, error.StoreBusy => continue,
                    else => return err,
                };
                if (reference.generation == snapshot.generation) continue;
                const value = nestedValue(snapshot.value, reference.path[0..reference.path_len]) catch continue;
                var check = Reader{ .data = value };
                _ = try check.value(0);
                if (check.offset != value.len) return error.InvalidValue;
                try writer.byte(0x92);
                try writer.be32(reference.handle);
                try writer.put(value);
                generations[delivered] = .{ .reference = reference, .generation = snapshot.generation };
                delivered += 1;
                if (delivered == generations.len) break;
            }
            if (delivered == 0 and subscription.cycle_ms == 0) {
                subscription.next_due = now_us + @as(i64, subscription.cycle_ms) * 1000;
                continue;
            }
            if (delivered == 0 and !subscription.ready) writer.data[phase_offset] = 1;
        }
        try writer.byte(0);
        try writer.be32(0);
        const result = try writer.finish();
        for (generations[0..delivered]) |item| item.reference.generation = item.generation;
        if (subscription.sequence == std.math.maxInt(u32)) return error.NotificationLimit;
        subscription.sequence += 1;
        subscription.pending_empty = false;
        if (delivered != 0) subscription.ready = true;
        subscription.blocked = false;
        subscription.missed = 0;
        subscription.next_due = now_us + @as(i64, subscription.cycle_ms) * 1000;
        if (subscription.credits > 0) {
            subscription.credits -= 1;
            subscription.credit_count +%= 1;
        }
        return result;
    }
    return null;
}

test "VLQ bounds, recursive values, and compact native V2 replies" {
    var overflow = Reader{ .data = &.{ 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff } };
    try std.testing.expectError(error.Truncated, overflow.vlq());
    var truncated = Reader{ .data = &.{ 0, 0x15, 3, 65 } };
    try std.testing.expectError(error.Truncated, truncated.value(0));
    var writer: Writer = .{};
    const data = try createRequest(&writer, 2, 0x11e1a301);
    const request = try Message.parse(data[0 .. data.len - 4]);
    var output: Writer = .{};
    var state: State = .{};
    const response = try reply(&output, request, &state);
    const decoded = try Message.parse(response[0 .. response.len - 4]);
    try std.testing.expectEqual(@as(u8, 0x32), decoded.opcode);
    try std.testing.expectEqual(@as(u32, 0x11e1a301), state.client);
}

test "native multi-read capture, truncated qualifier, and duplicate integrity" {
    const hex = "72020036310000054c0000000470001001347000100103038e328e6f8e71000004e88969001200000000896a001300896b000400000100000000";
    var bytes: [hex.len / 2]u8 = undefined;
    _ = try std.fmt.hexToBytes(&bytes, hex);
    var state: State = .{ .negotiated = true };
    var output: Writer = .{};
    const response = try reply(&output, try Message.parse(&bytes), &state);
    const message = try Message.parse(response);
    var reader: Reader = .{ .data = message.body };
    try std.testing.expectEqual(@as(u64, 0), try reader.vlq());
    try std.testing.expectEqual(@as(u64, 1), try reader.vlq());
    try std.testing.expectEqual(@as(u64, 4), (try reader.value(0)).number);
    try std.testing.expectEqual(@as(u64, 2), try reader.vlq());
    try std.testing.expectEqual(@as(u64, 4096), (try reader.value(0)).number);
    try std.testing.expectEqual(@as(u64, 3), try reader.vlq());
    try std.testing.expectEqual(@as(u8, 8), (try reader.value(0)).kind);
    try std.testing.expectError(error.InvalidIntegrity, reply(&output, try Message.parse(&bytes), &state));
    for (1..5) |missing| {
        var truncated = bytes;
        const length = truncated.len - missing;
        std.mem.writeInt(u16, truncated[2..4], @intCast(length - 4), .big);
        state = .{ .negotiated = true };
        try std.testing.expectError(error.Truncated, reply(&output, try Message.parse(truncated[0..length]), &state));
    }
}

test "native 64-bit status format and ninth-byte boundaries" {
    const examples = [_]struct { value: u64, hex: []const u8 }{
        .{ .value = 0xa03388000088ffe0, .hex = "d08cf180808291ffe0" },
        .{ .value = 0x8020ab00199afff4, .hex = "c08895b080e6b5fff4" },
        .{ .value = 0x100000000000000, .hex = "80c080808080808000" },
        .{ .value = 0xffffffffffffffff, .hex = "ffffffffffffffffff" },
    };
    for (examples) |example| {
        var expected: [9]u8 = undefined;
        _ = try std.fmt.hexToBytes(&expected, example.hex);
        var writer: Writer = .{};
        try writer.vlq(example.value);
        try std.testing.expectEqualSlices(u8, &expected, writer.data[0..writer.used]);
        var reader: Reader = .{ .data = &expected };
        try std.testing.expectEqual(example.value, try reader.vlq());
        for (0..expected.len) |n| {
            reader = .{ .data = expected[0..n] };
            try std.testing.expectError(error.Truncated, reader.vlq());
        }
    }
}

test "native SetVariable reply and rejected writes leave state unchanged" {
    const capture = "7202003531000004f20000000470001001367000100101822b000420000004e88969001200000000896a001300896b00040000000400000000";
    var request: [capture.len / 2]u8 = undefined;
    _ = try std.fmt.hexToBytes(&request, capture);
    var writer: Writer = .{};
    var state: State = .{ .negotiated = true };
    const response = try reply(&writer, try Message.parse(&request), &state);
    const parsed = try Message.parse(response);
    try std.testing.expectEqualSlices(u8, &.{ 0, 8, 0, 0, 0, 0 }, parsed.body);
    try std.testing.expectEqual(@as(u32, 32), state.role);
    state = .{ .negotiated = true };
    request[request.len - 1] = 1;
    try std.testing.expectError(error.InvalidTrailer, reply(&writer, try Message.parse(&request), &state));
    try std.testing.expectEqual(@as(u32, 2), state.role);
    try std.testing.expectEqual(@as(u32, 3), state.write_counter);
}

test "native unsolicited notification has no request/reply header" {
    const hex = "7202001b3311e1a302040000000000000000065f4a4c7366a6010000000000";
    var bytes: [hex.len / 2]u8 = undefined;
    _ = try std.fmt.hexToBytes(&bytes, hex);
    const notification = try Notification.parse(&bytes);
    try std.testing.expectEqual(@as(u32, 0x11e1a302), notification.subscription);
    try std.testing.expectEqualSlices(u8, bytes[9..], notification.payload);
    for (0..bytes.len) |n| {
        if (n < 9) try std.testing.expectError(error.InvalidNotification, Notification.parse(bytes[0..n])) else try std.testing.expectError(error.InvalidLength, Notification.parse(bytes[0..n]));
    }
}

test "notification demultiplexer preserves order and rejects queue overflow" {
    const hex = "7202001b3311e1a302040000000000000000065f4a4c7366a6010000000000";
    var frame: [hex.len / 2]u8 = undefined;
    _ = try std.fmt.hexToBytes(&frame, hex);
    var queue: NotificationQueue = .{};
    for (0..4) |index| {
        std.mem.writeInt(u32, frame[5..9], @intCast(index + 1), .big);
        try queue.push(&frame);
    }
    try std.testing.expectError(error.NotificationQueueFull, queue.push(&frame));
    var small: [8]u8 = undefined;
    try std.testing.expectError(error.BufferTooSmall, queue.pop(&small));
    var output: [limit]u8 = undefined;
    for (0..4) |index| try std.testing.expectEqual(@as(u32, @intCast(index + 1)), (try queue.pop(&output)).?.subscription);
    try std.testing.expect(try queue.pop(&output) == null);
}

test "native signed VLQ preserves negative values and rejects overflow" {
    const cases = [_]struct { bytes: []const u8, value: i64 }{
        .{ .bytes = &.{0x7f}, .value = -1 },
        .{ .bytes = &.{0x40}, .value = -64 },
        .{ .bytes = &.{ 0xff, 0x3f }, .value = -65 },
        .{ .bytes = &.{ 0x80, 0x40 }, .value = 64 },
        .{ .bytes = &.{ 0x87, 0xff, 0xff, 0xff, 0x7f }, .value = 2147483647 },
        .{ .bytes = &.{ 0xf8, 0x80, 0x80, 0x80, 0 }, .value = -2147483648 },
    };
    for (cases) |case| {
        var reader: Reader = .{ .data = case.bytes };
        try std.testing.expectEqual(case.value, @as(i64, @bitCast(try reader.signed(32))));
    }
    var overflow: Reader = .{ .data = &.{ 0x88, 0x80, 0x80, 0x80, 0 } };
    try std.testing.expectError(error.Overflow, overflow.signed(32));
    var truncated: Reader = .{ .data = &.{0x80} };
    try std.testing.expectError(error.Truncated, truncated.signed(32));
}

test "Explore filters compare signed values and reject unsupported orderings" {
    var filter: ExploreFilter = .{ .operation = 3, .address_count = 1, .address = @splat(0), .value = &.{ 0, 8, 0 } };
    try std.testing.expect(try compareFilter(filter, &.{ 0, 8, 0x7f }));
    filter.operation = 5;
    try std.testing.expect(!try compareFilter(filter, &.{ 0, 8, 0x7f }));
    filter.operation = 6;
    try std.testing.expect(try compareFilter(filter, &.{ 0, 8, 0 }));
    filter.value = &.{ 0, 0x15, 1, 'x' };
    filter.operation = 1;
    try std.testing.expect(try compareFilter(filter, &.{ 0, 0x15, 1, 'x' }));
    filter.operation = 2;
    try std.testing.expect(try compareFilter(filter, &.{ 0, 0x15, 1, 'y' }));
    filter.operation = 3;
    try std.testing.expectError(error.UnsupportedFilter, compareFilter(filter, &.{ 0, 0x15, 1, 'x' }));
}

test "notification sequence VLQ keeps timestamp and phase aligned" {
    for ([_]u32{ 127, 128, 498, 16384 }) |sequence| {
        var state: State = .{};
        state.subscriptions[0] = .{ .rid = 0x70001046, .sequence = sequence, .pending_empty = true };
        var writer: Writer = .{};
        const packet = (try pollNotification(&writer, &state, 123456)).?;
        var reader: Reader = .{ .data = packet, .offset = 16 };
        try std.testing.expectEqual(@as(u64, sequence), try reader.vlq());
        const timestamp = try reader.take(8);
        try std.testing.expectEqual(@as(u64, 123456), std.mem.readInt(u64, timestamp[0..8], .big));
        try std.testing.expectEqual(@as(u8, 1), try reader.byte());
        try std.testing.expectEqualSlices(u8, &.{ 0, 0, 0, 0, 0 }, try reader.take(5));
        try std.testing.expectEqual(packet.len, reader.offset);
    }
}
