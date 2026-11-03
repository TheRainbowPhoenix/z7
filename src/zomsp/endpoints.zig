const std = @import("std");
const builtin = @import("builtin");
const wire = @import("wire.zig");
const transport = @import("channel.zig");
const Channel = transport.Channel;
const Backend = @import("backend.zig").Backend;

fn configure(stream: std.net.Stream) !void {
    const enabled: u32 = 1;
    try std.posix.setsockopt(stream.handle, std.posix.IPPROTO.TCP, std.posix.TCP.NODELAY, std.mem.asBytes(&enabled));
    if (builtin.os.tag == .windows) {
        var blocking: u32 = 0;
        if (std.os.windows.ws2_32.ioctlsocket(stream.handle, std.os.windows.ws2_32.FIONBIO, &blocking) != 0) return error.SocketConfiguration;
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

fn setNonblocking(stream: std.net.Stream) !void {
    if (builtin.os.tag == .windows) {
        var mode: u32 = 1;
        if (std.os.windows.ws2_32.ioctlsocket(stream.handle, std.os.windows.ws2_32.FIONBIO, &mode) != 0) return error.SocketConfiguration;
    } else {
        const flags = try std.posix.fcntl(stream.handle, std.posix.F.GETFL, 0);
        _ = try std.posix.fcntl(stream.handle, std.posix.F.SETFL, flags | std.posix.SOCK.NONBLOCK);
    }
}

fn checkReply(data: []const u8, function: u16, sequence: u16) !wire.Message {
    const message = try wire.Message.parse(data);
    if (message.opcode != 0x32 or message.function != function or message.sequence != sequence) return error.UnexpectedReply;
    var reader = wire.Reader{ .data = message.body };
    if (try reader.vlq() != 0) return error.RequestRejected;
    return message;
}

fn reply(writer: *wire.Writer, request: wire.Message, state: *wire.State, cancel: ?*std.atomic.Value(bool)) ![]const u8 {
    const deadline = std.time.milliTimestamp() + 1000;
    while (true) {
        if (cancel) |stopping| if (stopping.load(.acquire)) return error.Cancelled;
        return wire.reply(writer, request, state) catch |err| switch (err) {
            error.StoreBusy => {
                if (std.time.milliTimestamp() >= deadline) return err;
                std.Thread.sleep(100 * std.time.ns_per_us);
                continue;
            },
            else => return err,
        };
    }
}

fn serveSession(stream: std.net.Stream, certificate: [:0]const u8, key: [:0]const u8, store: ?*Backend, cancel: ?*std.atomic.Value(bool)) !void {
    var channel = Channel.init(stream);
    defer channel.deinit();
    channel.cancel = cancel;
    try configure(stream);
    try setNonblocking(stream);
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
    var state: wire.State = .{ .backend = store, .tls_secret = try channel.exporter() };
    defer state.close();
    var notification_writer: wire.Writer = .{};
    var created = false;
    channel.wait_read = false;
    var last_message = std.time.milliTimestamp();
    while (true) {
        const request = channel.receiveRequest() catch |err| switch (err) {
            error.EndOfStream => return,
            error.WouldBlock, error.ConnectionTimedOut => {
                if (std.time.milliTimestamp() - last_message > 30_000) return error.IdleTimeout;
                if (try wire.pollNotification(&notification_writer, &state, std.time.microTimestamp())) |notification| try channel.send(notification);
                try channel.waitInput(5);
                continue;
            },
            else => return err,
        };
        if (!created and request.function != 0x4ca) return error.InvalidSession;
        if (created and request.function == 0x4ca and request.version == 1) return error.AlreadyCreated;
        const response = try reply(&writer, request, &state, cancel);
        if (request.function != 0x4ca) {
            if (try wire.pollNotification(&notification_writer, &state, std.time.microTimestamp())) |notification| try channel.send(notification);
        }
        try channel.send(response);
        if (request.function == 0x4ca and request.version == 2) {
            if (try wire.pollNotification(&notification_writer, &state, std.time.microTimestamp())) |notification| try channel.send(notification);
        }
        created = true;
        last_message = std.time.milliTimestamp();
        if (request.function == 0x4d4 and request.body.len >= 4 and std.mem.readInt(u32, request.body[0..4], .big) == state.session) return;
    }
}

const Worker = struct {
    busy: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
    thread: ?std.Thread = null,
    stream: std.net.Stream = undefined,
    certificate: [:0]const u8 = undefined,
    key: [:0]const u8 = undefined,
    store: ?*Backend = null,
    cancel: ?*std.atomic.Value(bool) = null,
    fn run(self: *Worker) void {
        defer self.busy.store(false, .release);
        serveSession(self.stream, self.certificate, self.key, self.store, self.cancel) catch |err| {
            if (err == error.Cancelled) return;
            std.log.warn("zOMSp session: {s}", .{@errorName(err)});
        };
    }
};

pub const Runtime = struct {
    listener: std.net.Server,
    workers: [16]Worker = @splat(.{}),
    certificate: [:0]const u8,
    key: [:0]const u8,
    store: ?*Backend,
    stopping: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
    thread: ?std.Thread = null,

    pub fn init(port: u16, certificate: [:0]const u8, key: [:0]const u8, store: ?*Backend) !Runtime {
        const listener = try (try std.net.Address.parseIp4("127.0.0.1", port)).listen(.{ .reuse_address = true, .force_nonblocking = true });
        return .{ .listener = listener, .certificate = certificate, .key = key, .store = store };
    }
    pub fn start(self: *Runtime) !void {
        if (self.thread != null) return error.AlreadyRunning;
        self.thread = try std.Thread.spawn(.{}, loop, .{self});
    }
    pub fn stop(self: *Runtime) void {
        self.stopping.store(true, .release);
        if (self.thread) |thread| thread.join();
        self.thread = null;
        self.listener.deinit();
        for (&self.workers) |*worker| {
            if (worker.thread) |thread| thread.join();
            worker.thread = null;
        }
    }
    fn loop(self: *Runtime) void {
        self.run() catch |err| std.log.err("zOMSp listener: {s}", .{@errorName(err)});
    }
    pub fn run(self: *Runtime) !void {
        std.log.info("zOMSp server listening on 127.0.0.1:{d}", .{self.listener.listen_address.getPort()});
        while (!self.stopping.load(.acquire)) {
            const available = for (&self.workers) |*worker| {
                if (!worker.busy.load(.acquire)) break true;
            } else false;
            if (!available) {
                std.Thread.sleep(std.time.ns_per_ms);
                continue;
            }
            const accepted = self.listener.accept() catch |err| switch (err) {
                error.WouldBlock => {
                    std.Thread.sleep(std.time.ns_per_ms);
                    continue;
                },
                else => return err,
            };
            var assigned = false;
            for (&self.workers) |*worker| {
                if (worker.busy.load(.acquire)) continue;
                if (worker.thread) |thread| thread.join();
                worker.stream = accepted.stream;
                worker.certificate = self.certificate;
                worker.key = self.key;
                worker.store = self.store;
                worker.cancel = &self.stopping;
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
};

fn readRole(channel: *Channel, notifications: *wire.NotificationQueue, writer: *wire.Writer, session: u32, sequence: u16, aid: u32, integrity: u32) !u32 {
    try writer.begin(2, 0x31, 0x586, sequence, session, 0x34);
    try writer.be32(session);
    try writer.put(&.{ 0x20, 4, 1 });
    try writer.vlq(aid);
    try writer.qualifier(true, integrity);
    try channel.send(try writer.finish());
    const response = try checkReply(try channel.receiveReply(notifications), 0x586, sequence);
    var reader = wire.Reader{ .data = response.body };
    if (try reader.vlq() != 0 or try reader.vlq() != 0) return error.ReadRejected;
    const value = try reader.value(0);
    if ((value.kind != 4 and value.kind != 0x12) or value.number > 0xffffffff) return error.UnexpectedType;
    return @intCast(value.number);
}

fn clientLargeUpload(channel: *Channel, notifications: *wire.NotificationQueue, session: u32, first_sequence: u16, previous_counter: u32) !void {
    const allocator = std.heap.page_allocator;
    const path = try std.process.getEnvVarOwned(allocator, "ZOMSP_PROGRAM_FILE");
    defer allocator.free(path);
    var file = try std.fs.cwd().openFile(path, .{});
    defer file.close();
    const length = try file.getEndPos();
    if (length < 64 or length > @import("streaming.zig").max_bytes) return error.ValueLimit;
    var header: [64]u8 = undefined;
    if (try file.readAll(&header) != header.len or !std.mem.eql(u8, header[0..8], "ZOMSPSIN")) return error.InvalidProgram;
    const entries = std.mem.readInt(u32, header[12..16], .little);
    if (entries < 4 or @as(u64, entries) * 4 + 64 != length) return error.InvalidProgram;
    try file.seekTo(0);
    var writer: wire.Writer = .{};
    var sequence = first_sequence;
    var write_counter = previous_counter + 1;
    var read_counter = previous_counter - 1;
    try writer.begin(2, 0x31, 0x556, sequence, session, 0x36);
    try writer.put(&.{ 2, 0, 1, 0 });
    try writer.vlq(write_counter);
    try writer.byte(0xa1);
    try writer.be32(0x7fffc001);
    try writer.vlq(1700);
    try writer.put(&.{ 0, 0, 0xa2, 0, 0, 0, 0 });
    try channel.send(try writer.finish());
    _ = try checkReply(try channel.receiveReply(notifications), 0x556, sequence);
    var offset: u32 = 0;
    var chunk: [32768]u8 = undefined;
    while (offset < length) {
        const count = try file.readAll(chunk[0..@min(chunk.len, length - offset)]);
        if (count == 0) return error.EndOfStream;
        sequence += 1;
        write_counter += 1;
        try writer.begin(2, 0x31, 0x57c, sequence, session, 0x34);
        try writer.be32(1000);
        try writer.put(&.{ 0x20, 4, 3, 42 });
        try writer.vlq(offset);
        try writer.vlq(count);
        try writer.put(&wire.qualifier_bytes);
        try writer.put(&.{ 0, 1, 0, 0x14, 0 });
        try writer.vlq(count);
        try writer.put(chunk[0..count]);
        try writer.vlq(write_counter);
        try writer.be32(0);
        try channel.send(try writer.finish());
        _ = try checkReply(try channel.receiveReply(notifications), 0x57c, sequence);
        offset += @intCast(count);
    }
    sequence += 1;
    write_counter += 1;
    try writer.begin(2, 0x31, 0x560, sequence, session, 0x36);
    try writer.put(&.{ 0, 1 });
    try writer.vlq(write_counter);
    try writer.be32(0);
    try channel.send(try writer.finish());
    _ = try checkReply(try channel.receiveReply(notifications), 0x560, sequence);
    std.log.info("zOMSp streamed program bytes={d}", .{offset});
    for ([_]u32{ 0, entries / 4, entries / 2, entries * 3 / 4, entries - 1 }, [_]f32{ 0, 1, 0, -1, 0 }) |input, expected| {
        sequence += 1;
        write_counter += 1;
        try writer.begin(2, 0x31, 0x4f2, sequence, session, 0x34);
        try writer.be32(1000);
        try writer.put(&.{ 1, 44 });
        try writer.uint(input);
        try writer.qualifier(false, write_counter);
        try channel.send(try writer.finish());
        _ = try checkReply(try channel.receiveReply(notifications), 0x4f2, sequence);
        var matched = false;
        for (0..100) |_| {
            std.Thread.sleep(10 * std.time.ns_per_ms);
            sequence += 1;
            read_counter += 1;
            try writer.begin(2, 0x31, 0x586, sequence, session, 0x34);
            try writer.be32(1000);
            try writer.put(&.{ 0x20, 4, 1, 45 });
            try writer.qualifier(true, read_counter);
            try channel.send(try writer.finish());
            const response = try checkReply(try channel.receiveReply(notifications), 0x586, sequence);
            var reader: wire.Reader = .{ .data = response.body };
            if (try reader.vlq() != 0 or try reader.vlq() != 0) return error.ReadRejected;
            const value = try reader.value(0);
            if (value.kind != 0x0e or value.number > std.math.maxInt(u32)) return error.UnexpectedType;
            const output: f32 = @bitCast(@as(u32, @intCast(value.number)));
            if (std.math.isFinite(output) and @abs(output - expected) < 0.00002) {
                std.log.info("zOMSp sine input={d} output={d}", .{ input, output });
                matched = true;
                break;
            }
        }
        if (!matched) return error.ReadbackMismatch;
    }
    sequence += 1;
    try writer.begin(2, 0x31, 0x4d4, sequence, session, 0x34);
    try writer.be32(session);
    try writer.byte(0);
    try writer.put(&wire.qualifier_bytes);
    try writer.vlq(write_counter + 1);
    try writer.be32(0);
    try channel.send(try writer.finish());
}

fn clientActivation(channel: *Channel, notifications: *wire.NotificationQueue, session: u32, sequence: u16, previous_counter: u32) !void {
    const allocator = std.heap.page_allocator;
    const target_text = try std.process.getEnvVarOwned(allocator, "ZOMSP_APPLICATION_RID");
    defer allocator.free(target_text);
    const target = try std.fmt.parseInt(u32, target_text, 0);
    if (target == 0 or target == session) return error.InvalidAddress;
    const program = std.process.getEnvVarOwned(allocator, "ZOMSP_PROGRAM") catch |err| switch (err) {
        error.EnvironmentVariableNotFound => null,
        else => return err,
    };
    defer if (program) |source| allocator.free(source);
    if (program) |source| if (source.len == 0 or source.len > 900) return error.ValueLimit;
    var writer: wire.Writer = .{};
    try writer.begin(2, 0x31, 0x556, sequence, session, 0x36);
    try writer.put(&.{ 2, 0, 1, 0 });
    try writer.vlq(previous_counter + 1);
    try writer.byte(0xa1);
    try writer.be32(0x7fffc001);
    try writer.vlq(1700);
    try writer.put(&.{ 0, 0, 0xa3 });
    try writer.vlq(1702);
    try writer.put(&.{ 0x40, 0x16, 1, 0, 4, 0, 0, 0xa2 });
    try writer.be32(0);
    try channel.send(try writer.finish());
    const started = try checkReply(try channel.receiveReply(notifications), 0x556, sequence);
    var reader: wire.Reader = .{ .data = started.body };
    _ = try reader.vlq();
    if ((try reader.value(0)).kind != 0x12) return error.InvalidSequenceState;
    try writer.begin(2, 0x31, 0x4f2, sequence + 1, session, 0x36);
    try writer.be32(target);
    try writer.put(&.{ 1, 42 });
    if (program) |source| try writer.string(source) else try writer.uint(11);
    try writer.qualifier(false, previous_counter + 2);
    try channel.send(try writer.finish());
    _ = try checkReply(try channel.receiveReply(notifications), 0x4f2, sequence + 1);
    try writer.begin(2, 0x31, 0x560, sequence + 2, session, 0x36);
    try writer.put(&.{ 0, 1 });
    try writer.vlq(previous_counter + 3);
    try writer.be32(0);
    try channel.send(try writer.finish());
    _ = try checkReply(try channel.receiveReply(notifications), 0x560, sequence + 2);
    std.log.info("zOMSp mapped activation=ok", .{});
    var close_sequence = sequence + 3;
    if (program != null) {
        var previous: ?u32 = null;
        for (0..5) |index| {
            std.Thread.sleep(60 * std.time.ns_per_ms);
            try writer.begin(2, 0x31, 0x586, close_sequence, session, 0x34);
            try writer.be32(target);
            try writer.put(&.{ 0x20, 4, 1, 43 });
            try writer.qualifier(true, previous_counter + @as(u32, @intCast(index)));
            try channel.send(try writer.finish());
            const response = try checkReply(try channel.receiveReply(notifications), 0x586, close_sequence);
            var value_reader: wire.Reader = .{ .data = response.body };
            if (try value_reader.vlq() != 0 or try value_reader.vlq() != 0) return error.ReadRejected;
            const value = try value_reader.value(0);
            if (value.kind != 4 or value.number > std.math.maxInt(u32)) return error.UnexpectedType;
            const count: u32 = @intCast(value.number);
            if (previous) |before| if (count <= before) return error.ReadbackMismatch;
            previous = count;
            std.log.info("zOMSp program counter={d}", .{count});
            close_sequence += 1;
        }
    }
    try writer.begin(2, 0x31, 0x4d4, close_sequence, session, 0x34);
    try writer.be32(session);
    try writer.byte(0);
    try writer.put(&wire.qualifier_bytes);
    try writer.vlq(previous_counter + 4);
    try writer.be32(0);
    try channel.send(try writer.finish());
}

fn authenticatedClient(channel: *Channel, notifications: *wire.NotificationQueue, session: u32, password: []const u8, username: []const u8) !void {
    if (password.len == 0 or password.len > 256 or username.len > 128) return error.InvalidCredentials;
    var writer: wire.Writer = .{};
    try writer.begin(2, 0x31, 0x586, 4, session, 0x34);
    try writer.be32(session);
    try writer.put(&.{ 0x20, 4, 1 });
    try writer.vlq(303);
    try writer.qualifier(true, 1);
    try channel.send(try writer.finish());
    const challenge_reply = try checkReply(try channel.receiveReply(notifications), 0x586, 4);
    var reader: wire.Reader = .{ .data = challenge_reply.body };
    if (try reader.vlq() != 0 or try reader.byte() != 0) return error.InvalidProof;
    const challenge = try reader.value(0);
    if (challenge.raw.len != 23 or !std.mem.eql(u8, challenge.raw[0..3], &.{ 0x10, 2, 20 })) return error.InvalidProof;
    const iv = challenge.raw[3..19].*;
    var payload: wire.Writer = .{};
    defer std.crypto.utils.secureZero(u8, &payload.data);
    try payload.put(&.{ 0, 0x17 });
    try payload.be32(40400);
    try payload.vlq(40401);
    try payload.uint(if (username.len == 0) 1 else 2);
    try payload.vlq(40402);
    try payload.put(&.{ 0, 0x14, 0 });
    try payload.vlq(username.len);
    try payload.put(username);
    try payload.vlq(40403);
    try payload.put(&.{ 0, 0x14, 0 });
    var digest: [20]u8 = undefined;
    defer std.crypto.utils.secureZero(u8, &digest);
    const credential = if (username.len == 0) blk: {
        std.crypto.hash.Sha1.hash(password, &digest, .{});
        break :blk &digest;
    } else password;
    try payload.vlq(credential.len);
    try payload.put(credential);
    try payload.byte(0);
    const padding: u8 = @intCast(16 - payload.used % 16);
    for (0..padding) |_| try payload.byte(padding);
    var secret = try channel.exporter();
    defer std.crypto.utils.secureZero(u8, &secret);
    var key: [32]u8 = undefined;
    defer std.crypto.utils.secureZero(u8, &key);
    std.crypto.hash.sha2.Sha256.hash(&secret, &key, .{});
    var aes = std.crypto.core.aes.Aes256.initEnc(key);
    defer std.crypto.utils.secureZero(u8, std.mem.asBytes(&aes));
    var encrypted: [1024]u8 = undefined;
    if (payload.used > encrypted.len) return error.InvalidCredentials;
    var previous = iv;
    var offset: usize = 0;
    while (offset < payload.used) : (offset += 16) {
        var block: [16]u8 = undefined;
        defer std.crypto.utils.secureZero(u8, &block);
        for (payload.data[offset..][0..16], previous, &block) |byte, before, *out| out.* = byte ^ before;
        aes.encrypt(encrypted[offset..][0..16], &block);
        previous = encrypted[offset..][0..16].*;
    }
    try writer.begin(2, 0x31, 0x4f2, 5, session, 0x36);
    try writer.be32(session);
    try writer.byte(1);
    try writer.vlq(1846);
    try writer.put(&.{ 0, 0x14, 0 });
    try writer.vlq(payload.used);
    try writer.put(encrypted[0..payload.used]);
    try writer.qualifier(false, 4);
    try channel.send(try writer.finish());
    _ = try checkReply(try channel.receiveReply(notifications), 0x4f2, 5);
    if (try readRole(channel, notifications, &writer, session, 6, 1842, 2) != 1) return error.AuthenticationDenied;
    const before = try readRole(channel, notifications, &writer, session, 7, 299, 3);
    try writer.begin(2, 0x31, 0x4f2, 8, session, 0x36);
    try writer.be32(session);
    try writer.byte(1);
    try writer.vlq(299);
    try writer.uint(32);
    try writer.qualifier(false, 5);
    try channel.send(try writer.finish());
    _ = try checkReply(try channel.receiveReply(notifications), 0x4f2, 8);
    if (try readRole(channel, notifications, &writer, session, 9, 299, 4) != 32) return error.ReadbackMismatch;
    std.log.info("zOMSp authenticated roundtrip=ok role={d}->32", .{before});
    if (std.process.hasEnvVarConstant("ZOMSP_PROGRAM_FILE")) return clientLargeUpload(channel, notifications, session, 10, 5);
    if (std.process.hasEnvVarConstant("ZOMSP_ACTIVATION")) return clientActivation(channel, notifications, session, 10, 5);
    try writer.begin(2, 0x31, 0x4d4, 10, session, 0x34);
    try writer.be32(session);
    try writer.byte(0);
    try writer.put(&wire.qualifier_bytes);
    try writer.vlq(6);
    try writer.be32(0);
    try channel.send(try writer.finish());
}

fn client(host: [:0]const u8, port: u16, certificate: [:0]const u8) !void {
    const stream = try std.net.tcpConnectToAddress(try std.net.Address.parseIp4(host, port));
    var channel = Channel.init(stream);
    var notification_queue: wire.NotificationQueue = .{};
    const notifications = &notification_queue;
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
    _ = try checkReply(try channel.receiveReply(notifications), 0x5b3, 1);
    try clearFooter(&channel);
    try channel.handshake(false, certificate, null, host);
    std.log.info("zOMSp client TLS verified", .{});
    try channel.send(try wire.createRequest(&writer, 2, 0x11e1a301));
    const creation = try checkReply(try channel.receiveReply(notifications), 0x4ca, 2);
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
    _ = try checkReply(try channel.receiveReply(notifications), 0x542, 3);
    std.log.info("zOMSp login=ok session={x}", .{session});
    if (std.process.getEnvVarOwned(std.heap.page_allocator, "ZOMSP_PASSWORD")) |password| {
        defer {
            std.crypto.utils.secureZero(u8, password);
            std.heap.page_allocator.free(password);
        }
        const username = std.process.getEnvVarOwned(std.heap.page_allocator, "ZOMSP_USERNAME") catch |err| switch (err) {
            error.EnvironmentVariableNotFound => try std.heap.page_allocator.dupe(u8, ""),
            else => return err,
        };
        defer std.heap.page_allocator.free(username);
        return authenticatedClient(&channel, notifications, session, password, username);
    } else |err| if (err != error.EnvironmentVariableNotFound) return err;

    if (try readRole(&channel, notifications, &writer, session, 4, 300, 1) != 0x11e1a301) return error.PingMismatch;
    const before = try readRole(&channel, notifications, &writer, session, 5, 299, 2);
    if (before != 2) return error.RoleMismatch;
    try writer.begin(2, 0x31, 0x4f2, 6, session, 0x36);
    try writer.be32(session);
    try writer.byte(1);
    try writer.vlq(299);
    try writer.uint(32);
    try writer.qualifier(false, 4);
    try channel.send(try writer.finish());
    _ = try checkReply(try channel.receiveReply(notifications), 0x4f2, 6);
    const after = try readRole(&channel, notifications, &writer, session, 7, 299, 3);
    if (after != 32) return error.ReadbackMismatch;
    std.log.info("zOMSp roundtrip=ok role={d}->{d}", .{ before, after });
    if (std.process.hasEnvVarConstant("ZOMSP_PROGRAM_FILE")) return clientLargeUpload(&channel, notifications, session, 8, 4);
    if (std.process.hasEnvVarConstant("ZOMSP_ACTIVATION")) return clientActivation(&channel, notifications, session, 8, 4);
    var close_sequence: u16 = 8;
    if (std.process.hasEnvVarConstant("OMSP_EXTENDED")) {
        if (try readRole(&channel, notifications, &writer, session, 8, 1842, 4) != 4) return error.CapabilityMismatch;
        if (try readRole(&channel, notifications, &writer, session, 9, 1903, 5) != 4096) return error.CapabilityMismatch;
        try writer.begin(2, 0x31, 0x586, 10, session, 0x34);
        try writer.be32(session);
        try writer.put(&.{ 0x20, 4, 1 });
        try writer.vlq(65535);
        try writer.qualifier(true, 6);
        try channel.send(try writer.finish());
        const rejected = try wire.Message.parse(try channel.receiveReply(notifications));
        if (rejected.opcode != 0x32 or rejected.function != 0x586 or rejected.sequence != 10) return error.UnexpectedReply;
        var rejection = wire.Reader{ .data = rejected.body };
        if (try rejection.vlq() != 0xa03388000088ffe0) return error.UnexpectedStatus;
        if (try readRole(&channel, notifications, &writer, session, 11, 300, 7) != 0x11e1a301) return error.PingMismatch;
        std.log.info("zOMSp extended=ok capabilities,error,recovery", .{});
        close_sequence = 12;
    }
    try writer.begin(2, 0x31, 0x4d4, close_sequence, session, 0x34);
    try writer.be32(session);
    try writer.byte(0);
    try writer.put(&wire.qualifier_bytes);
    try writer.vlq(5);
    try writer.be32(0);
    try channel.send(try writer.finish());
    std.log.info("zOMSp close=sent", .{});
}

pub fn run(args: anytype) !void {
    if (args.len != 6 and args.len != 7) return error.InvalidArguments;
    try transport.load(args[5]);
    if (std.mem.eql(u8, args[1], "--server")) {
        const port = try std.fmt.parseInt(u16, args[2], 10);
        if (port == 0) return error.InvalidPort;
        var store = if (args.len == 7) try Backend.open(args[6], true) else null;
        defer if (store) |*mapped| mapped.close();
        var runtime = try Runtime.init(port, args[3], args[4], if (store) |*mapped| mapped else null);
        defer runtime.stop();
        return runtime.run();
    }
    if (args.len != 6) return error.InvalidArguments;
    const port = try std.fmt.parseInt(u16, args[3], 10);
    if (port == 0) return error.InvalidPort;
    return client(args[2], port, args[4]);
}
