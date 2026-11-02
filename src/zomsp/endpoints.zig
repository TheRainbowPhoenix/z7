const std = @import("std");
const builtin = @import("builtin");
const wire = @import("wire.zig");
const transport = @import("channel.zig");
const Channel = transport.Channel;

fn configure(stream: std.net.Stream) !void {
    if (builtin.os.tag == .windows) {
        const timeout: u32 = 10_000;
        try std.posix.setsockopt(stream.handle, std.posix.SOL.SOCKET, std.posix.SO.RCVTIMEO, std.mem.asBytes(&timeout));
        try std.posix.setsockopt(stream.handle, std.posix.SOL.SOCKET, std.posix.SO.SNDTIMEO, std.mem.asBytes(&timeout));
    } else {
        const timeout = std.posix.timeval{ .sec = 10, .usec = 0 };
        try std.posix.setsockopt(stream.handle, std.posix.SOL.SOCKET, std.posix.SO.RCVTIMEO, std.mem.asBytes(&timeout));
        try std.posix.setsockopt(stream.handle, std.posix.SOL.SOCKET, std.posix.SO.SNDTIMEO, std.mem.asBytes(&timeout));
    }
}

fn clearFooter(channel: *Channel) !void {
    const remaining = channel.plaintext[channel.consumed..channel.queued];
    if (remaining.len != 0 and !std.mem.eql(u8, remaining, &.{ 0x72, 1, 0, 0 })) return error.InvalidTlsTransition;
    channel.queued = 0;
    channel.consumed = 0;
}

fn checkReply(data: []const u8, function: u16, sequence: u16) !wire.Message {
    const message = try wire.Message.parse(data);
    if (message.opcode != 0x32 or message.function != function or message.sequence != sequence) return error.UnexpectedReply;
    var reader = wire.Reader{ .data = message.body };
    if (try reader.vlq() != 0) return error.RequestRejected;
    return message;
}

fn serveSession(stream: std.net.Stream, certificate: [:0]const u8, key: [:0]const u8) !void {
    var channel = Channel.init(stream);
    defer channel.deinit();
    try configure(stream);
    const cr = try channel.frame();
    if (cr[5] != 0xe0 or cr.len < 11) return error.InvalidConnect;
    var cc: [wire.limit]u8 = undefined;
    @memcpy(cc[0..cr.len], cr);
    cc[5] = 0xd0;
    @memcpy(cc[6..8], cr[8..10]);
    cc[8] = 0;
    cc[9] = 0x45;
    try channel.sendFrame(cc[0..cr.len]);
    const start = try wire.Message.parse(try channel.receive());
    if (start.opcode != 0x31 or start.function != 0x5b3 or start.version != 1) return error.TlsRequired;
    var writer: wire.Writer = .{};
    try writer.begin(1, 0x32, 0x5b3, start.sequence, null, start.flags | 0x40);
    try writer.put(&.{ 0, 0, 0, 0, 0, 0 });
    try channel.send(try writer.finish());
    try clearFooter(&channel);
    try channel.handshake(true, certificate, key, "127.0.0.1");
    std.log.info("zOMSp server TLS established", .{});
    var state: wire.State = .{};
    var created = false;
    for (0..128) |_| {
        const data = channel.receive() catch |err| switch (err) {
            error.EndOfStream => return,
            else => return err,
        };
        const request = try wire.Message.parse(data);
        if (!created and request.function != 0x4ca) return error.InvalidSession;
        if (created and request.function == 0x4ca) return error.AlreadyCreated;
        const response = try wire.reply(&writer, request, &state);
        try channel.send(response);
        created = true;
        if (request.function == 0x4d4) return;
    }
    return error.RequestLimit;
}

const Worker = struct {
    busy: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
    thread: ?std.Thread = null,
    stream: std.net.Stream = undefined,
    certificate: [:0]const u8 = undefined,
    key: [:0]const u8 = undefined,
    fn run(self: *Worker) void {
        defer self.busy.store(false, .release);
        serveSession(self.stream, self.certificate, self.key) catch |err| {
            std.log.warn("zOMSp session: {s}", .{@errorName(err)});
        };
    }
};

fn server(port: u16, certificate: [:0]const u8, key: [:0]const u8) !void {
    var listener = try (try std.net.Address.parseIp4("127.0.0.1", port)).listen(.{ .reuse_address = true });
    defer listener.deinit();
    const workers = try std.heap.page_allocator.alloc(Worker, 16);
    for (workers) |*worker| worker.* = .{};
    std.log.info("zOMSp server listening on 127.0.0.1:{d}", .{port});
    while (true) {
        const accepted = try listener.accept();
        var assigned = false;
        for (workers) |*worker| {
            if (worker.busy.load(.acquire)) continue;
            if (worker.thread) |thread| thread.join();
            worker.stream = accepted.stream;
            worker.certificate = certificate;
            worker.key = key;
            worker.busy.store(true, .release);
            worker.thread = std.Thread.spawn(.{ .stack_size = 1024 * 1024 }, Worker.run, .{worker}) catch |err| {
                worker.busy.store(false, .release);
                accepted.stream.close();
                return err;
            };
            assigned = true;
            break;
        }
        if (!assigned) accepted.stream.close();
    }
}

fn readRole(channel: *Channel, writer: *wire.Writer, session: u32, sequence: u16, aid: u32, integrity: u32) !u32 {
    try writer.begin(2, 0x31, 0x586, sequence, session, 0x34);
    try writer.be32(session);
    try writer.put(&.{ 0x20, 4, 1 });
    try writer.vlq(aid);
    try writer.qualifier(true, integrity);
    try channel.send(try writer.finish());
    const response = try checkReply(try channel.receive(), 0x586, sequence);
    var reader = wire.Reader{ .data = response.body };
    if (try reader.vlq() != 0 or try reader.vlq() != 0) return error.ReadRejected;
    const value = try reader.value(0);
    if ((value.kind != 4 and value.kind != 0x12) or value.number > 0xffffffff) return error.UnexpectedType;
    return @intCast(value.number);
}

fn client(host: [:0]const u8, port: u16, certificate: [:0]const u8) !void {
    const stream = try std.net.tcpConnectToAddress(try std.net.Address.parseIp4(host, port));
    var channel = Channel.init(stream);
    defer channel.deinit();
    try configure(stream);
    const cr = [_]u8{ 3, 0, 0, 35, 30, 0xe0, 0, 0, 0, 1, 0, 0xc1, 2, 6, 0, 0xc2, 15, 'S', 'I', 'M', 'A', 'T', 'I', 'C', '-', 'R', 'O', 'O', 'T', '-', 'E', 'S', 0xc0, 1, 10 };
    try channel.sendFrame(&cr);
    const cc = try channel.frame();
    if (cc[5] != 0xd0) return error.InvalidConnect;
    var writer: wire.Writer = .{};
    try writer.begin(1, 0x31, 0x5b3, 1, 0, 0x30);
    try writer.be32(0);
    try channel.send(try writer.finish());
    _ = try checkReply(try channel.receive(), 0x5b3, 1);
    try clearFooter(&channel);
    try channel.handshake(false, certificate, null, host);
    std.log.info("zOMSp client TLS verified", .{});
    try channel.send(try wire.createRequest(&writer, 2, 0x11e1a301));
    const creation = try checkReply(try channel.receive(), 0x4ca, 2);
    var reader = wire.Reader{ .data = creation.body };
    _ = try reader.vlq();
    if (try reader.vlq() != 2) return error.InvalidSession;
    const rid = try reader.vlq();
    if (rid > 0xffffffff) return error.InvalidSession;
    const session: u32 = @intCast(rid);
    _ = try reader.vlq();
    var state: wire.State = .{};
    try wire.object(&reader, &state, 0);
    if (state.version.len == 0) return error.MissingVersion;
    try writer.begin(2, 0x31, 0x542, 3, session, 0x34);
    try writer.be32(session);
    try writer.put(&.{ 2, 2 });
    try writer.vlq(306);
    try writer.vlq(299);
    try writer.byte(1);
    try writer.put(state.version);
    try writer.byte(2);
    try writer.uint(2);
    try writer.byte(0);
    try writer.setupQualifier();
    try channel.send(try writer.finish());
    _ = try checkReply(try channel.receive(), 0x542, 3);
    std.log.info("zOMSp login=ok session={x}", .{session});
    if (try readRole(&channel, &writer, session, 4, 300, 1) != 0x11e1a301) return error.PingMismatch;
    const before = try readRole(&channel, &writer, session, 5, 299, 2);
    if (before != 2) return error.RoleMismatch;
    try writer.begin(2, 0x31, 0x4f2, 6, session, 0x36);
    try writer.be32(session);
    try writer.byte(1);
    try writer.vlq(299);
    try writer.uint(32);
    try writer.qualifier(false, 4);
    try channel.send(try writer.finish());
    _ = try checkReply(try channel.receive(), 0x4f2, 6);
    const after = try readRole(&channel, &writer, session, 7, 299, 3);
    if (after != 32) return error.ReadbackMismatch;
    std.log.info("zOMSp roundtrip=ok role={d}->{d}", .{ before, after });
    var close_sequence: u16 = 8;
    if (std.process.hasEnvVarConstant("OMSP_EXTENDED")) {
        if (try readRole(&channel, &writer, session, 8, 1842, 4) != 4) return error.CapabilityMismatch;
        if (try readRole(&channel, &writer, session, 9, 1903, 5) != 4096) return error.CapabilityMismatch;
        try writer.begin(2, 0x31, 0x586, 10, session, 0x34);
        try writer.be32(session);
        try writer.put(&.{ 0x20, 4, 1 });
        try writer.vlq(65535);
        try writer.qualifier(true, 6);
        try channel.send(try writer.finish());
        const rejected = try wire.Message.parse(try channel.receive());
        if (rejected.opcode != 0x32 or rejected.function != 0x586 or rejected.sequence != 10) return error.UnexpectedReply;
        var rejection = wire.Reader{ .data = rejected.body };
        if (try rejection.vlq() != 0xa03388000088ffe0) return error.UnexpectedStatus;
        if (try readRole(&channel, &writer, session, 11, 300, 7) != 0x11e1a301) return error.PingMismatch;
        std.log.info("zOMSp extended=ok capabilities,error,recovery", .{});
        close_sequence = 12;
    }
    try writer.begin(2, 0x31, 0x4d4, close_sequence, session, 0x34);
    try writer.be32(session);
    try writer.qualifier(false, 5);
    try channel.send(try writer.finish());
    std.log.info("zOMSp close=sent", .{});
}

pub fn run(args: anytype) !void {
    if (args.len != 6) return error.InvalidArguments;
    try transport.load(args[5]);
    if (std.mem.eql(u8, args[1], "--server")) {
        const port = try std.fmt.parseInt(u16, args[2], 10);
        if (port == 0) return error.InvalidPort;
        return server(port, args[3], args[4]);
    }
    const port = try std.fmt.parseInt(u16, args[3], 10);
    if (port == 0) return error.InvalidPort;
    return client(args[2], port, args[4]);
}
