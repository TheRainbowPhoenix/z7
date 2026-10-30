//! Bounded classic S7 ALARM_8 state. Only this mutex crosses the C API/IO-thread boundary.
//! Peer input is checked with errors; assertions describe invariants established by those checks.
const std = @import("std");
const assert = std.debug.assert;

pub const alarm_capacity: u32 = 64;
pub const event_capacity: u32 = 256;
pub const ack_capacity = alarm_capacity;
pub const query_capacity = 6 + alarm_capacity * 12;

comptime {
    assert(alarm_capacity <= std.math.maxInt(u8));
    assert(event_capacity >= alarm_capacity);
    assert(query_capacity + 26 <= 960);
}

pub const Error = error{ InvalidRequest, Unsupported, Full, SequenceExhausted, InvalidTime, Lagged };
pub const Timestamp = [8]u8;

pub const Record = struct {
    id: u32,
    signals: u8 = 0,
    ack_going: u8 = 0xff,
    ack_coming: u8 = 0xff,

    pub fn outstanding(self: Record) bool {
        return self.signals != 0 or self.ack_going != 0xff or self.ack_coming != 0xff;
    }
};

pub const Event = struct {
    record: Record,
    timestamp: Timestamp,
    changed: u8,
    acknowledgement: bool = false,
};

pub const Ack = struct { id: u32, going: u8, coming: u8 };
pub const AckRequest = struct {
    items: [ack_capacity]Ack = undefined,
    count: u32,
};
pub const Query = union(enum) { all, id: u32 };

pub const Store = struct {
    mutex: std.Thread.Mutex = .{},
    records: [alarm_capacity]Record = undefined,
    count: u32 = 0,
    events: [event_capacity]Event = undefined,
    sequence: u64 = 0,

    fn find(self: *const Store, id: u32) ?u32 {
        assert(self.count <= alarm_capacity);
        assert(id != 0);
        for (self.records[0..self.count], 0..) |record, index| {
            if (record.id == id) return @intCast(index);
        }
        return null;
    }

    fn append(self: *Store, event: Event) void {
        assert(event.record.id != 0);
        assert(self.count <= alarm_capacity);
        assert(self.sequence < std.math.maxInt(u64));
        self.events[@intCast(self.sequence % event_capacity)] = event;
        self.sequence += 1;
    }

    pub fn cursor(self: *Store) u64 {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.sequence;
    }

    pub fn set(self: *Store, id: u32, signals: u8, timestamp: Timestamp) Error!void {
        if (id == 0) return error.InvalidRequest;
        self.mutex.lock();
        defer self.mutex.unlock();
        const index = self.find(id) orelse blk: {
            if (signals == 0) return;
            if (self.count == alarm_capacity) return error.Full;
            break :blk self.count;
        };
        var record = if (index < self.count) self.records[index] else Record{ .id = id };
        const changed = record.signals ^ signals;
        if (changed == 0) return;
        if (self.sequence == std.math.maxInt(u64)) return error.SequenceExhausted;
        record.ack_coming &= ~(signals & changed);
        record.ack_going &= ~(record.signals & changed);
        record.signals = signals;
        self.records[index] = record;
        if (index == self.count) self.count += 1;
        self.append(.{ .record = record, .timestamp = timestamp, .changed = changed });
        assert(self.records[index].signals == signals);
        assert(self.count <= alarm_capacity);
    }

    pub fn acknowledge(self: *Store, request: *const AckRequest, results: []u8, timestamp: Timestamp) Error!void {
        if (request.count == 0 or request.count > ack_capacity or results.len < request.count)
            return error.InvalidRequest;
        self.mutex.lock();
        defer self.mutex.unlock();
        // Reserve enough sequence space before changing any record.
        if (std.math.maxInt(u64) - self.sequence < request.count) return error.SequenceExhausted;
        for (request.items[0..request.count], results[0..request.count]) |item, *result| {
            const index = self.find(item.id) orelse {
                result.* = 0x0a;
                continue;
            };
            const record = &self.records[index];
            const changed = (item.going & ~record.ack_going) | (item.coming & ~record.ack_coming);
            record.ack_going |= item.going;
            record.ack_coming |= item.coming;
            result.* = 0xff;
            if (changed != 0) self.append(.{
                .record = record.*,
                .timestamp = timestamp,
                .changed = changed,
                .acknowledgement = true,
            });
        }
    }

    pub fn next(self: *Store, position: *u64) Error!?Event {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (position.* > self.sequence or self.sequence - position.* > event_capacity) return error.Lagged;
        if (position.* == self.sequence) return null;
        const event = self.events[@intCast(position.* % event_capacity)];
        position.* += 1;
        return event;
    }

    pub fn query(self: *Store, filter: Query, output: *[query_capacity]u8) usize {
        self.mutex.lock();
        defer self.mutex.unlock();
        assert(self.count <= alarm_capacity);
        output[0..6].* = .{ 0, 1, 0x0a, 0, 0, 0 };
        var offset: u32 = 6;
        for (self.records[0..self.count]) |record| {
            if (!record.outstanding()) continue;
            switch (filter) {
                .all => {},
                .id => |id| if (record.id != id) continue,
            }
            assert(output.len - offset >= 12);
            // The dataset length counts from alarm type (after the first three bytes).
            output[offset..][0..4].* = .{ 9, 0, 0, 2 };
            std.mem.writeInt(u32, output[offset + 4 ..][0..4], record.id, .big);
            output[offset + 8 ..][0..4].* = .{ 0, record.signals, record.ack_going, record.ack_coming };
            offset += 12;
        }
        if (offset > 6) {
            output[2] = 0xff;
            output[3] = 9;
            std.mem.writeInt(u16, output[4..6], @intCast(offset - 6), .big);
        }
        return offset;
    }
};

/// Validates the whole request before callers may mutate state.
pub fn parse_ack(payload: []const u8) Error!AckRequest {
    if (payload.len < 2 or payload[0] != 0) return error.InvalidRequest;
    const count: u32 = payload[1];
    if (count == 0 or count > ack_capacity or payload.len != 2 + count * 10) return error.InvalidRequest;
    var request = AckRequest{ .count = count };
    for (request.items[0..count], 0..) |*item, index| {
        const data = payload[2 + index * 10 ..][0..10];
        if (!std.mem.eql(u8, data[0..4], &.{ 0x12, 8, 0x19, 0 })) return error.InvalidRequest;
        const id = std.mem.readInt(u32, data[4..8], .big);
        if (id == 0) return error.InvalidRequest;
        item.* = .{ .id = id, .going = data[8], .coming = data[9] };
    }
    return request;
}

/// Accept complete, unfragmented CPU userdata requests. Lengths are widened before arithmetic.
pub fn parse_envelope(params: []const u8, data: []const u8, exact_length: bool, pdu_limit: u16) Error![]const u8 {
    if (pdu_limit < 240 or pdu_limit > 960) return error.InvalidRequest;
    if (params.len != 8 and params.len != 12) return error.InvalidRequest;
    if (!exact_length or !std.mem.eql(u8, params[0..3], &.{ 0, 1, 0x12 })) return error.InvalidRequest;
    if (params[3] != params.len - 4 or params[4] != 0x11 or params[5] != 0x44) return error.InvalidRequest;
    if (params.len == 12 and !std.mem.allEqual(u8, params[8..12], 0)) return error.Unsupported;
    if (data.len < 4 or data.len > pdu_limit - 10 - params.len) return error.InvalidRequest;
    if (data[0] != 0xff or data[1] != 9) return error.InvalidRequest;
    if (std.mem.readInt(u16, data[2..4], .big) != data.len - 4) return error.InvalidRequest;
    assert(data.len >= 4);
    assert(10 + params.len + data.len <= pdu_limit);
    return data[4..];
}

pub fn parse_query(payload: []const u8) Error!Query {
    if (payload.len != 12) return error.InvalidRequest;
    if (!std.mem.eql(u8, payload[0..6], &.{ 0, 1, 0x12, 8, 0x1a, 0 }) or payload[7] != 0)
        return error.InvalidRequest;
    const value = std.mem.readInt(u32, payload[8..12], .big);
    return switch (payload[6]) {
        1 => if (value == 2) .all else error.Unsupported,
        3 => if (value != 0) .{ .id = value } else error.InvalidRequest,
        else => error.Unsupported,
    };
}

pub fn parse_subscription(payload: []const u8) Error!bool {
    if (payload.len != 12) return error.InvalidRequest;
    if (payload[1] != 0 or payload[11] != 0) return error.InvalidRequest;
    // Do not pretend to provide diagnostic, mode-transition, AR_SEND or ALARM_S services.
    if (payload[0] != 0x80) return error.Unsupported;
    return switch (payload[10]) {
        4 => false,
        5 => true,
        else => error.Unsupported,
    };
}

pub fn timestamp_from_ms(milliseconds: i64) Error!Timestamp {
    // S7 DATE_AND_TIME has an unambiguous year window of 1990..2089.
    if (milliseconds < 631152000000 or milliseconds >= 3786912000000) return error.InvalidTime;
    const ms: u64 = @intCast(milliseconds);
    const seconds = std.time.epoch.EpochSeconds{ .secs = ms / 1000 };
    const day = seconds.getEpochDay();
    const year_day = day.calculateYearDay();
    const month_day = year_day.calculateMonthDay();
    const daytime = seconds.getDaySeconds();
    const fraction = ms % 1000;
    return .{
        bcd(year_day.year % 100),       bcd(month_day.month.numeric()),                                                   bcd(@as(u8, month_day.day_index) + 1),
        bcd(daytime.getHoursIntoDay()), bcd(daytime.getMinutesIntoHour()),                                                bcd(daytime.getSecondsIntoMinute()),
        bcd(@intCast(fraction / 10)),   @as(u8, @intCast(fraction % 10)) * 16 + @as(u8, @intCast((day.day + 4) % 7)) + 1,
    };
}

fn bcd(value: u16) u8 {
    assert(value < 100);
    return @intCast((value / 10) * 16 + value % 10);
}

pub fn encode_event(event: Event, output: *[22]u8) []const u8 {
    output[0..8].* = event.timestamp;
    output[8..12].* = .{ 0, 1, 0x12, if (event.acknowledgement) 8 else 10 };
    output[12] = if (event.acknowledgement) 0x19 else 0x16;
    output[13] = 0; // No associated values in this profile.
    std.mem.writeInt(u32, output[14..18], event.record.id, .big);
    if (event.acknowledgement) {
        output[18..20].* = .{ event.record.ack_going, event.record.ack_coming };
        return output[0..20];
    }
    output[18..22].* = .{ event.record.signals, event.changed, event.record.ack_going, event.record.ack_coming };
    return output;
}

test "alarm transitions, acknowledgements, query and duplicate suppression" {
    var store: Store = .{};
    const ts = try timestamp_from_ms(1704067200123); // 2024-01-01, Monday.
    try std.testing.expectEqualSlices(u8, &.{ 0x24, 1, 1, 0, 0, 0, 0x12, 0x32 }, &ts);
    var cursor: u64 = 0;
    try store.set(42, 0x81, ts);
    try store.set(42, 0x81, ts);
    const raised = (try store.next(&cursor)).?;
    try std.testing.expectEqual(@as(u8, 0x7e), raised.record.ack_coming);
    try std.testing.expectEqual(@as(?Event, null), try store.next(&cursor));
    var output: [query_capacity]u8 = undefined;
    try std.testing.expectEqual(@as(usize, 18), store.query(.all, &output));
    var request = AckRequest{ .count = 1 };
    request.items[0] = .{ .id = 42, .going = 0, .coming = 0x81 };
    var results: [1]u8 = undefined;
    try store.acknowledge(&request, &results, ts);
    try std.testing.expectEqual(@as(u8, 0xff), results[0]);
    try std.testing.expect((try store.next(&cursor)).?.acknowledgement);
    try store.set(42, 0, ts);
    const cleared = (try store.next(&cursor)).?;
    try std.testing.expectEqual(@as(u8, 0), cleared.record.signals);
    try std.testing.expectEqual(@as(u8, 0x7e), cleared.record.ack_going);
    request.items[0] = .{ .id = 42, .going = 0x81, .coming = 0 };
    try store.acknowledge(&request, &results, ts);
    try std.testing.expectEqual(@as(usize, 6), store.query(.all, &output));
}

test "alarm capacity and slow consumer overflow are explicit" {
    var store: Store = .{};
    const ts = try timestamp_from_ms(1704067200000);
    for (0..alarm_capacity) |index| try store.set(@intCast(index + 1), 1, ts);
    try std.testing.expectError(error.Full, store.set(1000, 1, ts));
    try std.testing.expectEqual(@as(usize, alarm_capacity), store.count);
    var cursor: u64 = 0;
    for (0..event_capacity) |index| try store.set(1, @intCast(index % 2), ts);
    try std.testing.expectError(error.Lagged, store.next(&cursor));
    store.sequence = std.math.maxInt(u64);
    const before = store.records[0];
    try std.testing.expectError(error.SequenceExhausted, store.set(1, before.signals ^ 1, ts));
    try std.testing.expectEqual(before, store.records[0]);
}

test "alarm parsers reject every truncation and trailing data" {
    const ack = [_]u8{ 0, 1, 0x12, 8, 0x19, 0, 0, 0, 0, 42, 1, 1 };
    const query = [_]u8{ 0, 1, 0x12, 8, 0x1a, 0, 1, 0, 0, 0, 0, 2 };
    const subscription = [_]u8{ 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0 };
    for (0..ack.len) |len| {
        try std.testing.expectError(error.InvalidRequest, parse_ack(ack[0..len]));
        try std.testing.expectError(error.InvalidRequest, parse_query(query[0..len]));
        try std.testing.expectError(error.InvalidRequest, parse_subscription(subscription[0..len]));
    }
    _ = try parse_ack(&ack);
    _ = try parse_query(&query);
    try std.testing.expect(try parse_subscription(&subscription));
    try std.testing.expectError(error.InvalidRequest, parse_ack(&(ack ++ .{0})));
    try std.testing.expectError(error.InvalidRequest, parse_query(&(query ++ .{0})));
    try std.testing.expectError(error.InvalidRequest, parse_subscription(&(subscription ++ .{0})));
    var random = std.Random.DefaultPrng.init(42);
    var bytes: [700]u8 = undefined;
    for (0..2000) |_| {
        random.random().bytes(&bytes);
        const length = random.random().uintLessThan(usize, bytes.len + 1);
        _ = parse_ack(bytes[0..length]) catch {};
        _ = parse_query(bytes[0..length]) catch {};
        _ = parse_subscription(bytes[0..length]) catch {};
    }
}

test "timestamp rejects outside S7 year window" {
    try std.testing.expectError(error.InvalidTime, timestamp_from_ms(-1));
    try std.testing.expectError(error.InvalidTime, timestamp_from_ms(631151999999));
    try std.testing.expectError(error.InvalidTime, timestamp_from_ms(3786912000000));
}

test "userdata envelope bounds and fragmented requests" {
    const params = [_]u8{ 0, 1, 0x12, 4, 0x11, 0x44, 2, 7 };
    const data = [_]u8{ 0xff, 9, 0, 2, 0, 1 };
    for (0..params.len) |length|
        try std.testing.expectError(error.InvalidRequest, parse_envelope(params[0..length], &data, true, 960));
    for (0..data.len) |length|
        try std.testing.expectError(error.InvalidRequest, parse_envelope(&params, data[0..length], true, 960));
    try std.testing.expectEqualSlices(u8, &.{ 0, 1 }, try parse_envelope(&params, &data, true, 960));
    try std.testing.expectError(error.InvalidRequest, parse_envelope(&params, &data, false, 960));
    try std.testing.expectError(error.InvalidRequest, parse_envelope(&params, &data, true, 0));
    var extended = params ++ .{ 0, 0, 0, 0 };
    extended[3] = 8;
    _ = try parse_envelope(&extended, &data, true, 240);
    extended[8] = 1;
    try std.testing.expectError(error.Unsupported, parse_envelope(&extended, &data, true, 960));
}
