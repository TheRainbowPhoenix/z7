const std = @import("std");
const read = @import("variable_read.zig");

pub const max_path_bytes = 64;
pub const capacity = 128;

pub const Table = struct {
    const Entry = struct {
        path: [max_path_bytes]u8 = undefined,
        length: u8 = 0,
        plan: read.Plan = undefined,
    };
    entries: [capacity]Entry = .{Entry{}} ** capacity,

    pub fn valid_path(path: []const u8) bool {
        return path.len >= 8 and path.len <= max_path_bytes and path.len % 4 == 0;
    }

    pub fn register(self: *Table, path: []const u8, plan: read.Plan) error{ InvalidPath, Full }!void {
        if (!valid_path(path)) return error.InvalidPath;
        const start: usize = @intCast(std.hash.Wyhash.hash(0, path) % capacity);
        for (0..capacity) |probe| {
            const entry = &self.entries[(start + probe) % capacity];
            if (entry.length == 0 or std.mem.eql(u8, path, entry.path[0..entry.length])) {
                @memcpy(entry.path[0..path.len], path);
                entry.plan = plan;
                entry.length = @intCast(path.len);
                return;
            }
        }
        return error.Full;
    }

    pub fn lookup(self: *const Table, path: []const u8) ?read.Plan {
        if (!valid_path(path)) return null;
        const start: usize = @intCast(std.hash.Wyhash.hash(0, path) % capacity);
        for (0..capacity) |probe| {
            const entry = &self.entries[(start + probe) % capacity];
            if (entry.length == 0) return null;
            if (std.mem.eql(u8, path, entry.path[0..entry.length])) return entry.plan;
        }
        return null;
    }
};

test "symbol registration, replacement, capacity and exact paths" {
    var table = Table{};
    const plan = try read.decode(&.{ 0x12, 10, 0x10, 2, 0, 1, 0, 1, 0x84, 0, 0, 0 });
    var path = [_]u8{0} ** 8;
    for (0..capacity) |index| {
        std.mem.writeInt(u32, path[4..8], @intCast(index), .big);
        try table.register(&path, plan);
        try std.testing.expectEqual(plan, table.lookup(&path).?);
    }
    try table.register(&path, plan);
    path[0] = 1;
    try std.testing.expect(table.lookup(&path) == null);
    try std.testing.expectError(error.Full, table.register(&path, plan));
    try std.testing.expectError(error.InvalidPath, table.register(path[0..7], plan));
}
