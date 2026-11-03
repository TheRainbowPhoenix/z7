//! Fixed-capacity send storage. An in-flight buffer is never modified or moved.
const std = @import("std");
const assert = std.debug.assert;

pub const frame_capacity: u32 = 16384;
pub const queue_capacity: u32 = 4;

comptime {
    assert(frame_capacity <= std.math.maxInt(u16));
    assert(queue_capacity > 1);
}

pub const Queue = struct {
    const Frame = struct { bytes: [frame_capacity]u8 = undefined, length: u32 = 0 };
    // Only the count occupied slots are initialized, by push().
    frames: [queue_capacity]Frame = undefined,
    head: u32 = 0,
    count: u32 = 0,
    sent: u32 = 0,

    pub fn free(self: *const Queue) u32 {
        assert(self.count <= queue_capacity);
        return queue_capacity - self.count;
    }

    pub fn push(self: *Queue, bytes: []const u8) error{ Full, InvalidLength }!void {
        if (bytes.len == 0 or bytes.len > frame_capacity) return error.InvalidLength;
        if (self.count == queue_capacity) return error.Full;
        const index = (self.head + self.count) % queue_capacity;
        @memcpy(self.frames[index].bytes[0..bytes.len], bytes);
        self.frames[index].length = @intCast(bytes.len);
        self.count += 1;
    }

    pub fn pending(self: *Queue) ?[]const u8 {
        if (self.count == 0) {
            assert(self.sent == 0);
            return null;
        }
        const frame = &self.frames[self.head];
        assert(self.sent < frame.length);
        assert(frame.length <= frame_capacity);
        return frame.bytes[self.sent..frame.length];
    }

    pub fn advance(self: *Queue, length: usize) error{InvalidLength}!void {
        const bytes = self.pending() orelse return error.InvalidLength;
        if (length == 0 or length > bytes.len) return error.InvalidLength;
        self.sent += @intCast(length);
        if (self.sent == self.frames[self.head].length) {
            self.head = (self.head + 1) % queue_capacity;
            self.count -= 1;
            self.sent = 0;
        }
    }
};

test "send queue preserves in-flight data, handles partial sends and wraps" {
    var queue: Queue = .{};
    try queue.push("first");
    const in_flight = queue.pending().?;
    try queue.push("second");
    try std.testing.expectEqualStrings("first", in_flight);
    try queue.advance(2);
    try std.testing.expectEqualStrings("rst", queue.pending().?);
    try queue.advance(3);
    try std.testing.expectEqualStrings("second", queue.pending().?);
    try queue.advance(6);
    try std.testing.expectEqual(@as(?[]const u8, null), queue.pending());
    for (0..20) |_| {
        try queue.push("x");
        try queue.advance(1);
    }
    for (0..queue_capacity) |_| try queue.push("y");
    try std.testing.expectError(error.Full, queue.push("overflow"));
    try std.testing.expectError(error.InvalidLength, queue.advance(0));
    try std.testing.expectError(error.InvalidLength, queue.advance(2));
    try std.testing.expectError(error.InvalidLength, queue.push(""));
    try std.testing.expectEqual(@as(usize, 0), queue.free());
}
