//! Parse the entire WriteVar job before any storage mutation.
const std = @import("std");
const assert = std.debug.assert;
pub const capacity: u32 = 64;
pub const Item = struct {
    area: u8,
    db: u16,
    address: u32,
    bytes: []const u8,
    bit: bool,
    result: u8,
};
pub const Plan = struct { items: [capacity]Item = undefined, count: u32 };

pub fn parse(params: []const u8, data: []const u8) error{InvalidRequest}!Plan {
    if (params.len < 2 or params[0] != 5) return error.InvalidRequest;
    const count: u32 = params[1];
    if (count == 0 or count > capacity or params.len != 2 + count * 12) return error.InvalidRequest;
    var plan = Plan{ .count = count };
    var offset: usize = 0;
    for (plan.items[0..count], 0..) |*item, index| {
        if (data.len - offset < 4 or data[offset] != 0) return error.InvalidRequest;
        const transport = data[offset + 1];
        const length: u32 = std.mem.readInt(u16, data[offset + 2 ..][0..2], .big);
        const bytes: u32 = switch (transport) {
            3 => (length + 7) / 8,
            4, 5 => if (length % 8 == 0) length / 8 else return error.InvalidRequest,
            7, 9 => length,
            else => return error.InvalidRequest,
        };
        offset += 4;
        if (bytes > data.len - offset) return error.InvalidRequest;
        const descriptor = params[2 + index * 12 ..][0..12];
        item.* = decode(descriptor, transport, length, data[offset..][0..bytes]);
        offset += bytes;
        if (index + 1 < count and bytes % 2 == 1) {
            if (offset == data.len or data[offset] != 0) return error.InvalidRequest;
            offset += 1;
        }
        assert(offset <= data.len);
    }
    if (offset != data.len) return error.InvalidRequest;
    assert(plan.count > 0);
    assert(plan.count <= capacity);
    return plan;
}

fn decode(descriptor: *const [12]u8, transport: u8, length: u32, bytes: []const u8) Item {
    const address = (@as(u32, descriptor[9]) << 16) | (@as(u32, descriptor[10]) << 8) | descriptor[11];
    var item = Item{
        .area = descriptor[8],
        .db = std.mem.readInt(u16, descriptor[6..8], .big),
        .address = address,
        .bytes = bytes,
        .bit = descriptor[3] == 1,
        .result = 0xff,
    };
    if (!std.mem.eql(u8, descriptor[0..3], &.{ 0x12, 10, 0x10 })) {
        item.result = 5;
        return item;
    }
    const count: u32 = std.mem.readInt(u16, descriptor[4..6], .big);
    if (item.bit) {
        if (transport != 3 or length != 1 or count != 1 or bytes.len != 1) {
            item.result = 7;
        } else if (bytes[0] > 1) {
            item.result = 7;
        }
    } else {
        const width: u32 = switch (descriptor[3]) {
            2, 3 => 1,
            4, 5 => 2,
            6, 7, 8 => 4,
            else => {
                item.result = 6;
                return item;
            },
        };
        if (transport == 3 or count == 0 or count * width != bytes.len) item.result = 7;
        if (address % 8 != 0) item.result = 5;
    }
    return item;
}

test "WriteVar parses bit writes and padded multi-item bytes" {
    const params = [_]u8{ 5, 2 } ++
        .{ 0x12, 10, 0x10, 1, 0, 1, 0, 1, 0x84, 0, 0, 7 } ++
        .{ 0x12, 10, 0x10, 2, 0, 1, 0, 1, 0x84, 0, 0, 8 };
    const data = [_]u8{ 0, 3, 0, 1, 1, 0, 0, 4, 0, 8, 0x22 };
    const plan = try parse(&params, &data);
    try std.testing.expectEqual(@as(u32, 2), plan.count);
    try std.testing.expect(plan.items[0].bit);
    try std.testing.expectEqual(@as(u8, 0xff), plan.items[0].result);
    try std.testing.expectEqualSlices(u8, &.{0x22}, plan.items[1].bytes);
    for (0..data.len) |length| try std.testing.expectError(error.InvalidRequest, parse(&params, data[0..length]));
    for (0..params.len) |length| try std.testing.expectError(error.InvalidRequest, parse(params[0..length], &data));
    try std.testing.expectError(error.InvalidRequest, parse(&params, &(data ++ .{0})));
}

test "WriteVar checks element count, bit value and padding before mutation" {
    const params = [_]u8{ 5, 1, 0x12, 10, 0x10, 1, 0, 1, 0, 1, 0x84, 0, 0, 7 };
    const data = [_]u8{ 0, 3, 0, 1, 2 };
    try std.testing.expectEqual(@as(u8, 7), (try parse(&params, &data)).items[0].result);
    var random = std.Random.DefaultPrng.init(49);
    var fuzz: [1024]u8 = undefined;
    for (0..2000) |_| {
        random.random().bytes(&fuzz);
        const split = random.random().uintLessThan(usize, fuzz.len + 1);
        _ = parse(fuzz[0..split], fuzz[split..]) catch {};
    }
}
