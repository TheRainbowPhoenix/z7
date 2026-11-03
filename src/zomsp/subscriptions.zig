const std = @import("std");
pub const max_subscriptions = 4;
pub const max_references = 64;
pub const AlarmReference = struct {
    rid: u32 = 0,
    subsystem: u32 = 0,
    domains: [10]u16 = @splat(0),
    domain_count: u8 = 1,
    cursor: u64 = 0,
    pub fn accepts(self: *const AlarmReference, subsystem: u32, domain: u16) bool {
        return self.subsystem == subsystem and std.mem.indexOfScalar(u16, self.domains[0..self.domain_count], domain) != null;
    }
};
pub const Reference = struct {
    handle: u32 = 0,
    rid: u32 = 0,
    aid: u32 = 0,
    path: [3]u32 = @splat(0),
    path_len: u8 = 0,
    generation: u64 = 0,
};
pub const Subscription = struct {
    rid: u32 = 0,
    cycle_ms: u32 = 900,
    disabled: bool = false,
    credit_limit: i16 = -1,
    credits: i32 = -1,
    sequence: u32 = 0,
    next_due: i64 = 0,
    pending_empty: bool = false,
    ready: bool = false,
    credit_count: u8 = 0,
    missed: u16 = 0,
    blocked: bool = false,
    references: [max_references]Reference = @splat(.{}),
    alarms: [4]AlarmReference = @splat(.{}),

    pub fn set(self: *Subscription, aid: u64, value: anytype, comptime Reader: type) !void {
        switch (aid) {
            1048 => {
                var reader: Reader = .{ .data = value.raw };
                if (try reader.byte() != 0x20 or try reader.byte() != 4) return error.UnsupportedReference;
                const words = try reader.vlq();
                if (words < 3 or words > 1024) return error.ReferenceLimit;
                const header = try reader.vlq();
                if (header & 0x80000000 == 0 or try reader.vlq() != 0) return error.UnsupportedReference;
                const count = try reader.vlq();
                if (count > max_references) return error.ReferenceLimit;
                var used: usize = 3;
                var handles: [max_references]u32 = undefined;
                for (0..@intCast(count)) |index| {
                    const descriptor = try reader.vlq();
                    const path_len = descriptor & 0xffff;
                    if (descriptor & 0xfff00000 != 0x80100000 or path_len == 0 or path_len > 4) return error.UnsupportedReference;
                    const handle = try reader.vlq();
                    if (handle == 0 or handle > std.math.maxInt(u32)) return error.InvalidReference;
                    for (handles[0..index]) |previous| if (previous == handle) return error.InvalidReference;
                    handles[index] = @intCast(handle);
                    _ = try reader.vlq();
                    const rid = try reader.vlq();
                    if (rid == 0 or rid > std.math.maxInt(u32) or try reader.vlq() != 0) return error.UnsupportedReference;
                    var reference: Reference = .{ .handle = @intCast(handle), .rid = @intCast(rid), .path_len = @intCast(path_len - 1) };
                    for (0..@intCast(path_len)) |part| {
                        const field = try reader.vlq();
                        if (field == 0 or field > std.math.maxInt(u32)) return error.InvalidReference;
                        if (part == 0) reference.aid = @intCast(field) else reference.path[part - 1] = @intCast(field);
                    }
                    used += 5 + @as(usize, @intCast(path_len));
                    var slot: ?*Reference = null;
                    for (&self.references) |*existing| if (existing.handle == handle) {
                        slot = existing;
                        break;
                    };
                    if (slot == null) for (&self.references) |*existing| if (existing.handle == 0) {
                        slot = existing;
                        break;
                    };
                    (slot orelse return error.ReferenceLimit).* = reference;
                }
                if (used != words or reader.offset != value.raw.len) return error.InvalidReference;
                if (self.sequence == 0) {
                    self.pending_empty = true;
                    self.next_due = 0;
                }
            },
            1049 => {
                if (value.kind != 4 or value.number > 60_000) return error.InvalidCycle;
                self.cycle_ms = @intCast(value.number);
            },
            1051 => {
                if ((value.kind != 1 and value.kind != 2) or value.number > 1) return error.InvalidValue;
                self.disabled = value.number != 0;
                if (!self.disabled) self.next_due = 0;
            },
            1053 => {
                if (value.kind != 7 or value.number > 0xffff) return error.InvalidValue;
                const limit: i16 = @bitCast(@as(u16, @intCast(value.number)));
                if (limit < -1) return error.InvalidValue;
                self.credit_limit = limit;
                self.credits = if (limit == -1) -1 else @as(u8, @truncate(@as(u16, @bitCast(limit)))) -% self.credit_count;
                if (self.blocked and self.credits != 0) self.next_due = 0;
            },
            233, 1002, 1003, 1040, 1041, 1050, 1052, 1054, 1055, 1082 => {},
            else => return error.UnsupportedSubscriptionAttribute,
        }
    }
};
