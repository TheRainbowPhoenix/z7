const std = @import("std");
pub const limit = 65535;
pub const qualifier_bytes = [_]u8{ 0, 0, 4, 0xe8, 0x89, 0x69, 0, 0x12, 0, 0, 0, 0, 0x89, 0x6a, 0, 0x13, 0, 0x89, 0x6b, 0, 4, 0, 0 };
pub const Value = struct { kind: u8, number: u64 = 0, raw: []const u8 };

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
    pub fn value(self: *Reader, depth: usize) anyerror!Value {
        if (depth >= 8) return error.DepthLimit;
        const start = self.offset;
        const flags = try self.byte();
        const kind = try self.byte();
        if (flags != 0 and !(flags == 0x10 and kind == 2)) return error.UnsupportedValue;
        var number: u64 = 0;
        if (flags == 0x10) {
            const count = try self.vlq();
            if (count > 4096) return error.ValueLimit;
            _ = try self.take(@intCast(count));
        } else switch (kind) {
            0 => {},
            1, 2 => number = try self.byte(),
            3 => number = std.mem.readInt(u16, (try self.take(2))[0..2], .big),
            4, 8, 0x13 => number = try self.vlq(),
            0x12 => number = try self.u32be(),
            0x15 => {
                const length = try self.vlq();
                if (length > 4096) return error.ValueLimit;
                _ = try self.take(@intCast(length));
            },
            0x17 => {
                number = try self.u32be();
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
        if (!std.mem.eql(u8, try self.take(qualifier_bytes.len), &qualifier_bytes)) return error.UnsupportedQualifier;
        if ((function == 0x586 or function == 0x4f2 or function == 0x4d4) and try self.byte() != 0) return error.InvalidRequestFlags;
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

pub const State = struct {
    session: u32 = 0x70001001,
    context: u32 = 0x70001002,
    client: u32 = 0x11e1a301,
    role: u32 = 2,
    version: []const u8 = &.{},
    negotiated: bool = false,
    read_counter: u32 = 0,
    write_counter: u32 = 3,
};

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
    var challenge: [20]u8 = undefined;
    std.crypto.random.bytes(&challenge);
    try writer.put(&challenge);
    try attribute(writer, 306);
    try writer.put(&.{ 0, 0x17 });
    try writer.be32(0x13a);
    for ([_]u32{ 315, 316, 317, 318 }) |aid| {
        try writer.vlq(aid);
        try writer.uint(if (aid < 317) 0x400 else 0x802001);
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
    if (request.function == 0x4ca) {
        if (try reader.u32be() != 0x11d) return error.UnsupportedObject;
        _ = try reader.value(0);
        _ = try reader.u32be();
        try object(&reader, state, 0);
        if (try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
        return createReply(writer, request, state);
    }
    if (request.version != 2 or request.session != state.session) return error.InvalidSession;
    const target = try reader.u32be();
    if (target != state.session and request.function != 0x586) return error.InvalidSession;
    if (!state.negotiated and request.function != 0x542) return error.NotNegotiated;
    try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
    try writer.byte(0);
    switch (request.function) {
        0x542 => {
            const count = try reader.vlq();
            if (count == 0 or count > 16 or try reader.vlq() != count) return error.ValueLimit;
            var aids: [16]u64 = undefined;
            var seen: u16 = 0;
            for (aids[0..@intCast(count)]) |*aid| aid.* = try reader.vlq();
            for (0..@intCast(count)) |_| {
                const index = try reader.vlq();
                if (index == 0 or index > count) return error.InvalidIndex;
                const bit = @as(u16, 1) << @as(u4, @intCast(index - 1));
                if (seen & bit != 0) return error.InvalidIndex;
                seen |= bit;
                const value = try reader.value(0);
                if (aids[@intCast(index - 1)] == 299 and value.kind == 4) {
                    if (value.number != 1 and value.number != 2 and value.number != 32) return error.InvalidRole;
                    state.role = @intCast(value.number);
                }
            }
            try writer.byte(0);
        },
        0x54c => {
            const count = try reader.vlq();
            if (count == 0 or count > 16 or try reader.vlq() != count) return error.ValueLimit;
            for (0..@intCast(count)) |index| {
                const aid = try reader.vlq();
                try writer.vlq(index + 1);
                if (aid == 1905) {
                    try writer.put(&.{ 0, 8, 0x7f });
                    continue;
                }
                try writer.uint(switch (aid) {
                    299 => state.role,
                    1842 => 4,
                    1903 => 4096,
                    else => return error.UnsupportedAttribute,
                });
            }
            try writer.put(&.{ 0, 0 });
        },
        0x586 => {
            const array = try reader.take(3);
            if (!std.mem.eql(u8, array, &.{ 0x20, 4, 1 })) return error.InvalidAddress;
            const aid = try reader.vlq();
            const status: u64 = if (target != state.session) 0x8020ab00199afff4 else switch (aid) {
                299, 300, 301, 1842, 1903, 1905 => 0,
                else => 0xa03388000088ffe0,
            };
            if (status != 0) {
                try writer.begin(2, 0x32, request.function, request.sequence, null, request.flags);
                try writer.vlq(status);
                try writer.put(&.{ 0, 0, 0 });
            } else {
                try writer.byte(0);
                switch (aid) {
                    299 => try writer.uint(state.role),
                    300 => try writer.rid(state.client),
                    301 => try writer.string("zOMSp_native_reference_port"),
                    1842 => try writer.uint(4),
                    1903 => try writer.uint(4096),
                    1905 => try writer.put(&.{ 0, 8, 0x7f }),
                    else => unreachable,
                }
            }
        },
        0x4f2 => {
            if (try reader.vlq() != 1 or try reader.vlq() != 299) return error.UnsupportedAttribute;
            const value = try reader.value(0);
            if (value.kind != 4 or !(value.number == state.role or (state.role == 2 and value.number == 32))) return error.InvalidRole;
            state.role = @intCast(value.number);
        },
        0x4d4 => try writer.be32(target),
        else => return error.UnsupportedRequest,
    }
    const read = request.function == 0x54c or request.function == 0x586;
    const integrity = try reader.finishRequest(request.function, request.function == 0x542 and !state.negotiated);
    if (request.function == 0x542 and !state.negotiated and integrity == 0) {
        state.negotiated = true;
    } else {
        const counter = if (read) &state.read_counter else &state.write_counter;
        if (counter.* == std.math.maxInt(u32) or integrity != counter.* + 1) return error.InvalidIntegrity;
        counter.* = integrity;
    }
    const response_integrity = if (read) (@as(u64, integrity) << 2) | 1 else @as(u64, integrity) << 1;
    if (response_integrity > std.math.maxInt(u32)) return error.Overflow;
    try writer.vlq(response_integrity);
    try writer.be32(0);
    return writer.finish();
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
