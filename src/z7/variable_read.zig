//! Bounded S7ANY read planning. No PLC execution or timer simulation.
const std = @import("std");
const assert = std.debug.assert;

pub fn validate_items(params: []const u8) error{InvalidAddress}!void {
    if (params.len < 2 or params[0] != 4 or params[1] == 0 or params[1] > 64) return error.InvalidAddress;
    var cursor: usize = 2;
    for (0..params[1]) |_| {
        if (params.len - cursor < 2) return error.InvalidAddress;
        const length = 2 + @as(usize, params[cursor + 1]);
        if (length < 4 or length > params.len - cursor) return error.InvalidAddress;
        cursor += length;
    }
    if (cursor != params.len) return error.InvalidAddress;
}

pub const Plan = struct {
    area: u8,
    db: u16,
    offset: u32,
    source_length: u32,
    length: u32,
    transport: u8,
    wire_length: u16,
    bit_offset: u3,
    string: bool = false,
    pub fn resolve_string(self: Plan, header: []const u8) error{InvalidAddress}!Plan {
        if (!self.string or header.len != 2 or header[1] > header[0]) return error.InvalidAddress;
        const length: u32 = @as(u32, header[0]) + 2;
        if (length > 65536 - self.offset) return error.InvalidAddress;
        var resolved = self;
        resolved.source_length = length;
        resolved.length = length;
        resolved.wire_length = @intCast(length);
        return resolved;
    }
    pub fn copy(self: Plan, source: []const u8, target: []u8) void {
        assert(source.len == self.source_length);
        assert(target.len == self.length);
        if (self.transport != 3) {
            @memcpy(target, source);
            return;
        }
        @memset(target, 0);
        for (0..self.wire_length) |index| {
            const position = index + @as(usize, self.bit_offset);
            const bit = (source[position / 8] >> @as(u3, @intCast(position % 8))) & 1;
            target[index / 8] |= bit << @as(u3, @intCast(index % 8));
        }
    }
};
pub fn decode(item: *const [12]u8) error{ InvalidAddress, UnsupportedType }!Plan {
    if (!std.mem.eql(u8, item[0..3], &.{ 0x12, 10, 0x10 })) return error.InvalidAddress;
    const count: u32 = std.mem.readInt(u16, item[4..6], .big);
    if (count == 0) return error.InvalidAddress;
    const address = (@as(u32, item[9]) << 16) | (@as(u32, item[10]) << 8) | item[11];
    const width: u32 = switch (item[3]) {
        1, 2, 3, 0x13 => 1,
        4, 5 => 2,
        6, 7, 8 => 4,
        else => return error.UnsupportedType,
    };
    if (item[3] != 1 and address % 8 != 0) return error.InvalidAddress;
    const bits = item[3] == 1;
    const string = item[3] == 0x13;
    if (string and count != 1) return error.InvalidAddress;
    const length = if (string) 2 else if (bits) (count + 7) / 8 else count * width;
    const source_length = if (bits) (count + (address & 7) + 7) / 8 else length;
    const transport: u8 = switch (item[3]) {
        1 => 3,
        3, 0x13 => 9,
        5 => 5,
        7 => 6,
        8 => 7,
        else => 4,
    };
    const wire_length = if (bits) count else if (transport == 4 or transport == 5) length * 8 else length;
    if (wire_length > std.math.maxInt(u16)) return error.InvalidAddress;
    const offset = address >> 3;
    if (offset >= 65536 or source_length > 65536 - offset) return error.InvalidAddress;
    return .{ .area = item[8], .db = std.mem.readInt(u16, item[6..8], .big), .offset = offset, .source_length = source_length, .length = length, .transport = transport, .wire_length = @intCast(wire_length), .bit_offset = @intCast(address & 7), .string = string };
}

test "STRING header bounds and CHAR DINT metadata" {
    var item = [_]u8{ 0x12, 10, 0x10, 0x13, 0, 1, 0, 1, 0x84, 0, 0, 0 };
    const string = try decode(&item);
    const resolved = try string.resolve_string(&.{ 8, 3 });
    try std.testing.expectEqual(@as(u32, 10), resolved.length);
    try std.testing.expectEqual(@as(u8, 9), resolved.transport);
    try std.testing.expectError(error.InvalidAddress, string.resolve_string(&.{ 2, 3 }));
    item[9] = 7;
    item[10] = 255;
    item[11] = 240;
    try std.testing.expectError(error.InvalidAddress, (try decode(&item)).resolve_string(&.{ 1, 1 }));
    item[9] = 0;
    item[10] = 0;
    item[11] = 0;
    item[3] = 3;
    try std.testing.expectEqual(@as(u8, 9), (try decode(&item)).transport);
    item[3] = 7;
    const dint = try decode(&item);
    try std.testing.expectEqual(@as(u8, 6), dint.transport);
    try std.testing.expectEqual(@as(u16, 4), dint.wire_length);
}

test "variable length read specifications reject truncation and random malformed input" {
    const params = [_]u8{ 4, 2, 0x12, 10, 0x10, 2, 0, 1, 0, 1, 0x84, 0, 0, 0, 0x12, 14, 0xb2, 0, 0x8a, 0x0e, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3 };
    try validate_items(&params);
    for (0..params.len) |length| try std.testing.expectError(error.InvalidAddress, validate_items(params[0..length]));
    var random = std.Random.DefaultPrng.init(0x13b2);
    var bytes: [256]u8 = undefined;
    for (0..10000) |_| {
        random.random().bytes(&bytes);
        validate_items(bytes[0..random.random().uintLessThan(usize, bytes.len + 1)]) catch {};
    }
}
test "typed read sizes, packed bits and area boundaries" {
    var item = [_]u8{ 0x12, 10, 0x10, 1, 0, 9, 0, 1, 0x84, 0, 0, 7 };
    const bits = try decode(&item);
    var target: [2]u8 = undefined;
    bits.copy(&.{ 0x80, 0x55 }, &target);
    try std.testing.expectEqualSlices(u8, &.{ 0xab, 0 }, &target);
    item[3] = 4;
    item[11] = 0;
    item[5] = 2;
    const words = try decode(&item);
    try std.testing.expectEqual(@as(u32, 4), words.length);
    try std.testing.expectEqual(@as(u16, 32), words.wire_length);
    item[9] = 7;
    item[10] = 255;
    item[11] = 248;
    try std.testing.expectError(error.InvalidAddress, decode(&item));
    item[3] = 2;
    item[5] = 1;
    try std.testing.expectEqual(@as(u32, 65535), (try decode(&item)).offset);
    item[3] = 0xff;
    try std.testing.expectError(error.UnsupportedType, decode(&item));
}
