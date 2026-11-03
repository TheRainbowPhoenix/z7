const std = @import("std");
pub const capacity = 64;
pub const max_bytes = 2048;
pub const Event = struct {
    sequence: u64 = 0,
    subsystem: u32 = 0,
    domain: u16 = 0,
    length: u16 = 0,
    bytes: [max_bytes]u8 = undefined,
};
pub const Store = struct {
    mutex: std.Thread.Mutex = .{},
    sequence: u64 = 0,
    entries: [capacity]Event = @splat(.{}),

    pub fn tail(self: *Store) u64 {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.sequence;
    }
    pub fn publish(self: *Store, subsystem: u32, domain: u16, bytes: []const u8) !void {
        if (subsystem == 0 or bytes.len == 0 or bytes.len > max_bytes) return error.InvalidValue;
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.sequence == std.math.maxInt(u64)) return error.GenerationExhausted;
        self.sequence += 1;
        const entry = &self.entries[(self.sequence - 1) % capacity];
        entry.sequence = self.sequence;
        entry.subsystem = subsystem;
        entry.domain = domain;
        entry.length = @intCast(bytes.len);
        @memcpy(entry.bytes[0..bytes.len], bytes);
    }
    pub fn next(self: *Store, cursor: u64, output: *Event) ?u64 {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (cursor >= self.sequence) return null;
        const oldest = self.sequence -| (capacity - 1);
        const sequence = @max(cursor + 1, oldest);
        output.* = self.entries[(sequence - 1) % capacity];
        std.debug.assert(output.sequence == sequence);
        return sequence - cursor - 1;
    }
};
