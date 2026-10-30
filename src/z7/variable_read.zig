//! Bounded S7ANY read planning. No PLC execution or timer simulation.
const std = @import("std");
const assert = std.debug.assert;
pub const Plan = struct {
    area: u8,
    db: u16,
    offset: u32,
    source_length: u32,
    length: u32,
    transport: u8,
    wire_length: u16,
    bit_offset: u3,
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
        1, 2, 3 => 1,
        4, 5 => 2,
        6, 7, 8 => 4,
        else => return error.UnsupportedType,
    };
    if (item[3] != 1 and address % 8 != 0) return error.InvalidAddress;
    const bits = item[3] == 1;
    const length = if (bits) (count + 7) / 8 else count * width;
    const source_length = if (bits) (count + (address & 7) + 7) / 8 else length;
    const transport: u8 = switch (item[3]) {
        1 => 3,
        5 => 5,
        7 => 6,
        8 => 7,
        else => 4,
    };
    const wire_length = if (bits) count else if (transport == 4 or transport == 5) length * 8 else length;
    if (wire_length > std.math.maxInt(u16)) return error.InvalidAddress;
    const offset = address >> 3;
    if (offset >= 65536 or source_length > 65536 - offset) return error.InvalidAddress;
    return .{ .area = item[8], .db = std.mem.readInt(u16, item[6..8], .big), .offset = offset, .source_length = source_length, .length = length, .transport = transport, .wire_length = @intCast(wire_length), .bit_offset = @intCast(address & 7) };
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
