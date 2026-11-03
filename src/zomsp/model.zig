const std = @import("std");
const wire = @import("wire.zig");
pub const Record = extern struct {
    kind: u32,
    rid: u32,
    class_id: u32,
    class_flags: u32,
    aid: u32,
    target: u32,
    depth: u32,
    reserved: u32 = 0,
    data: ?[*]const u8 = null,
    length: usize = 0,
};
pub const Visitor = *const fn (?*anyopaque, *const Record) callconv(.c) void;
pub const EventVisitor = *const fn (?*anyopaque, u32, u32, u32, u32, u64, u32, [*]const u8, usize) callconv(.c) void;
pub const ValueVisitor = *const fn (?*anyopaque, u32, u32, [*]const u8, usize) callconv(.c) void;
pub fn invokeResult(raw: []const u8, callback: ?ValueVisitor, user: ?*anyopaque) !void {
    var check: wire.Reader = .{ .data = raw };
    _ = try check.value(0);
    try wire.invokeArguments(&check);
    if (check.offset != raw.len) return error.InvalidTrailer;
    var reader: wire.Reader = .{ .data = raw };
    const result = try reader.value(0);
    if (callback) |visit| visit(user, 0, 0, result.raw.ptr, result.raw.len);
    for (1..3) |section| while (true) {
        const index = try reader.vlq();
        if (index == 0) break;
        const value = try reader.value(0);
        if (callback) |visit| visit(user, @intCast(section), @intCast(index), value.raw.ptr, value.raw.len);
    };
}
pub const NotificationInfo = extern struct { subscription: u32, sequence: u32, missed: u16, ticks: u16, credit: u8, phase: u8, reserved: u16 = 0, status: u64, timestamp: u64 };
pub fn notificationInfo(raw: []const u8) !NotificationInfo {
    try notification(raw, null, null);
    const message = try wire.Notification.parse(raw);
    var reader: wire.Reader = .{ .data = message.payload };
    _ = try reader.byte();
    const status = try reader.vlq();
    const missed = std.mem.readInt(u16, (try reader.take(2))[0..2], .big);
    const ticks = std.mem.readInt(u16, (try reader.take(2))[0..2], .big);
    const credit = try reader.byte();
    const sequence = try reader.vlq();
    const timestamp = std.mem.readInt(u64, (try reader.take(8))[0..8], .big);
    return .{ .subscription = message.subscription, .sequence = @intCast(sequence), .status = status, .missed = missed, .ticks = ticks, .credit = credit, .timestamp = timestamp, .phase = try reader.byte() };
}

fn emit(callback: ?Visitor, user: ?*anyopaque, record: Record) void {
    if (callback) |visit| visit(user, &record);
}
pub fn object(reader: *wire.Reader, callback: ?Visitor, user: ?*anyopaque, depth: u32, budget: *usize) anyerror!void {
    if (depth >= 8 or budget.* == 0 or try reader.byte() != 0xa1) return error.ObjectLimit;
    budget.* -= 1;
    const rid = try reader.u32be();
    const class = try reader.vlq();
    const flags = try reader.vlq();
    const aid = try reader.vlq();
    if (class > std.math.maxInt(u32) or flags > std.math.maxInt(u32) or aid > std.math.maxInt(u32)) return error.Overflow;
    var record: Record = .{ .kind = 1, .rid = rid, .class_id = @intCast(class), .class_flags = @intCast(flags), .aid = @intCast(aid), .target = 0, .depth = depth };
    emit(callback, user, record);
    for (0..512) |_| {
        const tag = try reader.byte();
        switch (tag) {
            0xa2 => {
                record.kind = 2;
                emit(callback, user, record);
                return;
            },
            0xa1 => {
                reader.offset -= 1;
                try object(reader, callback, user, depth + 1, budget);
            },
            0xa3, 0xa4 => {
                const field = try reader.vlq();
                if (field == 0 or field > std.math.maxInt(u32)) return error.InvalidAddress;
                var item = record;
                item.aid = @intCast(field);
                if (tag == 0xa3) {
                    const value = try reader.value(0);
                    item.kind = 3;
                    item.data = value.raw.ptr;
                    item.length = value.raw.len;
                } else {
                    item.kind = 4;
                    item.target = try reader.u32be();
                }
                emit(callback, user, item);
            },
            else => return error.UnsupportedObjectField,
        }
    }
    return error.ValueLimit;
}
pub fn objects(raw: []const u8, callback: ?Visitor, user: ?*anyopaque) !void {
    for (0..2) |pass| {
        var reader: wire.Reader = .{ .data = raw };
        var budget: usize = 128;
        while (reader.offset != raw.len) try object(&reader, if (pass == 0) null else callback, user, 0, &budget);
    }
}
pub fn notification(raw: []const u8, callback: ?EventVisitor, user: ?*anyopaque) !void {
    const message = try wire.Notification.parse(raw);
    for (0..2) |pass| {
        var reader: wire.Reader = .{ .data = message.payload };
        if (try reader.byte() != 4) return error.UnsupportedNotification;
        _ = try reader.vlq();
        _ = try reader.take(5);
        const sequence = try reader.vlq();
        if (sequence > std.math.maxInt(u32)) return error.Overflow;
        _ = try reader.take(9);
        var count: usize = 0;
        while (true) {
            const tag = try reader.byte();
            if (tag == 0) break;
            if (tag != 0x92 or count == 64) return error.UnsupportedNotification;
            const handle = try reader.u32be();
            if (handle == 0) return error.InvalidReference;
            const value = try reader.value(0);
            if (pass == 1) if (callback) |visit| visit(user, message.subscription, @intCast(sequence), 1, handle, 0, 0, value.raw.ptr, value.raw.len);
            count += 1;
        }
        while (reader.data.len - reader.offset > 4) {
            if (count == 64) return error.ValueLimit;
            const reference = try reader.u32be();
            const status = try reader.vlq();
            const flags = try reader.vlq();
            if (reference == 0 or flags > std.math.maxInt(u32) or try reader.byte() != 0x81) return error.UnsupportedNotification;
            const start = reader.offset;
            var budget: usize = 128;
            try object(&reader, null, null, 0, &budget);
            const bytes = reader.data[start..reader.offset];
            if (pass == 1) if (callback) |visit| visit(user, message.subscription, @intCast(sequence), 2, reference, status, @intCast(flags), bytes.ptr, bytes.len);
            count += 1;
        }
        if (try reader.u32be() != 0 or reader.offset != reader.data.len) return error.InvalidTrailer;
    }
}
