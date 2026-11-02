const std = @import("std");
const builtin = @import("builtin");
const IO = @import("zCom").io.IO;
const protocol = @import("protocol.zig");
const assert = std.debug.assert;
const socket_t = std.posix.socket_t;
const invalid_socket = if (builtin.os.tag == .windows) std.os.windows.ws2_32.INVALID_SOCKET else -1;
const connection_limit = 64;

const Pipe = struct {
    session: *Session = undefined,
    index: usize = 0,
    buffer: [protocol.frame_limit]u8 = undefined,
    received: usize = 0,
    target: usize = 4,
    sent: usize = 0,
    eof: bool = false,
    completion: IO.Completion = undefined,

    fn read(self: *Pipe) void {
        assert(self.received < self.target and self.target <= self.buffer.len);
        self.session.pending += 1;
        self.session.io.recv(*Pipe, self, onRead, &self.completion, self.session.sockets[self.index], self.buffer[self.received..self.target]);
    }

    fn onRead(self: *Pipe, _: *IO.Completion, result: IO.RecvError!usize) void {
        const session = self.session;
        assert(session.pending > 0);
        session.pending -= 1;
        if (session.closing) return session.retire();
        const count = result catch return session.fail();
        if (count == 0) {
            if (self.received != 0) return session.fail();
            self.eof = true;
            session.io.shutdown(session.sockets[1 - self.index], .send) catch {};
            if (session.pipes[1 - self.index].eof) session.fail();
            return;
        }
        assert(count <= self.target - self.received);
        session.last_activity = std.time.milliTimestamp();
        self.received += count;
        if (self.received < self.target) return self.read();
        if (self.target == 4) {
            self.target = protocol.frameSize(self.buffer[0..4]) catch return session.fail();
            return self.read();
        }
        _ = protocol.classify(self.buffer[0..self.target]) catch return session.fail();
        self.sent = 0;
        self.write();
    }

    fn write(self: *Pipe) void {
        assert(self.sent < self.target);
        self.session.pending += 1;
        self.session.io.send(*Pipe, self, onWrite, &self.completion, self.session.sockets[1 - self.index], self.buffer[self.sent..self.target]);
    }

    fn onWrite(self: *Pipe, _: *IO.Completion, result: IO.SendError!usize) void {
        const session = self.session;
        assert(session.pending > 0);
        session.pending -= 1;
        if (session.closing) return session.retire();
        const count = result catch return session.fail();
        if (count == 0) return session.fail();
        assert(count <= self.target - self.sent);
        self.sent += count;
        session.last_activity = std.time.milliTimestamp();
        if (self.sent < self.target) return self.write();
        self.received = 0;
        self.target = 4;
        self.read();
    }
};

const Session = struct {
    io: *IO = undefined,
    sockets: [2]socket_t = .{ invalid_socket, invalid_socket },
    pipes: [2]Pipe = .{ .{}, .{} },
    connect_completion: IO.Completion = undefined,
    pending: usize = 0,
    active: bool = false,
    closing: bool = false,
    last_activity: i64 = 0,

    fn start(self: *Session, io: *IO, client: socket_t, upstream: std.net.Address) void {
        assert(!self.active and self.pending == 0);
        const backend = openSocket(io) catch {
            io.close_socket(client);
            return;
        };
        self.* = .{ .io = io, .sockets = .{ client, backend }, .active = true, .last_activity = std.time.milliTimestamp() };
        for (&self.pipes, 0..) |*pipe, index| {
            pipe.session = self;
            pipe.index = index;
        }
        self.pending = 1;
        io.connect(*Session, self, onConnect, &self.connect_completion, backend, upstream);
    }

    fn onConnect(self: *Session, _: *IO.Completion, result: IO.ConnectError!void) void {
        assert(self.pending > 0);
        self.pending -= 1;
        if (self.closing) return self.retire();
        result catch return self.fail();
        for (&self.pipes) |*pipe| pipe.read();
    }

    fn fail(self: *Session) void {
        if (!self.closing) {
            self.closing = true;
            for (self.sockets) |socket| self.io.shutdown(socket, .both) catch {};
        }
        self.retire();
    }

    fn retire(self: *Session) void {
        if (self.pending != 0) return;
        assert(self.closing);
        for (self.sockets) |socket| self.io.close_socket(socket);
        self.active = false;
    }
};

fn openSocket(io: *IO) !socket_t {
    return io.open_socket_tcp(std.posix.AF.INET, .{
        .rcvbuf = 0,
        .sndbuf = 0,
        .keepalive = null,
        .user_timeout_ms = 0,
        .nodelay = true,
    });
}

const Server = struct {
    io: *IO,
    listener: socket_t,
    upstream: std.net.Address,
    sessions: []Session,
    accept_completion: IO.Completion = undefined,

    fn accept(self: *Server) void {
        self.io.accept(*Server, self, onAccept, &self.accept_completion, self.listener);
    }

    fn onAccept(self: *Server, _: *IO.Completion, result: IO.AcceptError!socket_t) void {
        const socket = result catch {
            self.accept();
            return;
        };
        if (builtin.os.tag == .windows) std.posix.setsockopt(socket, std.posix.SOL.SOCKET, 0x700b, std.mem.asBytes(&self.listener)) catch {};
        var assigned = false;
        for (self.sessions) |*session| {
            if (!session.active) {
                session.start(self.io, socket, self.upstream);
                assigned = true;
                break;
            }
        }
        if (!assigned) self.io.close_socket(socket);
        self.accept();
    }
};

pub fn main() !void {
    const allocator = std.heap.page_allocator;
    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);
    if (args.len >= 2 and (std.mem.eql(u8, args[1], "--client") or std.mem.eql(u8, args[1], "--server"))) {
        return @import("endpoints.zig").run(args);
    }
    if (args.len != 4) {
        try std.io.getStdErr().writeAll("usage: zOMSp LISTEN_PORT UPSTREAM_IPV4 UPSTREAM_PORT\n");
        return error.InvalidArguments;
    }
    const port = try std.fmt.parseInt(u16, args[1], 10);
    const upstream_port = try std.fmt.parseInt(u16, args[3], 10);
    if (port == 0 or upstream_port == 0) return error.InvalidPort;
    var io = try IO.init(512, 0);
    defer io.deinit();
    const listener = try openSocket(&io);
    defer io.close_socket(listener);
    _ = try io.listen(listener, try std.net.Address.parseIp4("127.0.0.1", port), .{ .backlog = 64 });
    const sessions = try allocator.alloc(Session, connection_limit);
    defer allocator.free(sessions);
    for (sessions) |*session| session.* = .{};
    var server = Server{ .io = &io, .listener = listener, .upstream = try std.net.Address.parseIp4(args[2], upstream_port), .sessions = sessions };
    server.accept();
    std.log.info("zOMSp listening on 127.0.0.1:{d}, upstream {any}", .{ port, server.upstream });
    while (true) {
        try io.run_once_for_ns(10 * std.time.ns_per_ms);
        const now = std.time.milliTimestamp();
        for (sessions) |*session| {
            if (session.active and !session.closing and now - session.last_activity > 30_000) session.fail();
        }
    }
}
