const std = @import("std");
const builtin = @import("builtin");
const os = std.os;
const posix = std.posix;
const testing = std.testing;
const assert = std.debug.assert;
const stdx = @import("../stdx.zig");
const KiB = stdx.KiB;
const MiB = stdx.MiB;

const TimeOS = @import("../time.zig").TimeOS;
const Time = @import("../time.zig").Time;
const IO = @import("../io.zig").IO;

pub const tcp_options: IO.TCPOptions = .{
    .rcvbuf = 0,
    .sndbuf = 0,
    .keepalive = null,
    .user_timeout_ms = 0,
    .nodelay = false,
};

test "open/write/read/close/statx" {
    try struct {
        const Context = @This();
        const StatxType = if (builtin.target.os.tag == .linux) std.os.linux.Statx else void;

        path: [:0]const u8 = "test_io_write_read_close",
        io: IO,
        done: bool = false,

        fd: ?posix.fd_t = null,
        write_buf: [20]u8 = @splat(97),
        read_buf: [20]u8 = @splat(98),

        written: usize = 0,
        read: usize = 0,

        statx: StatxType = undefined,

        fn run_test() !void {
            var self: Context = .{
                .io = try IO.init(32, 0),
            };
            defer self.io.deinit();

            // The file gets created below, either by createFile or openat.
            defer std.fs.cwd().deleteFile(self.path) catch {};

            var completion: IO.Completion = undefined;

            if (builtin.target.os.tag == .linux) {
                self.io.openat(
                    *Context,
                    &self,
                    openat_callback,
                    &completion,
                    posix.AT.FDCWD,
                    self.path,
                    .{ .ACCMODE = .RDWR, .TRUNC = true, .CREAT = true },
                    std.fs.File.default_mode,
                );
            } else {
                const file = try std.fs.cwd().createFile(self.path, .{
                    .read = true,
                    .truncate = true,
                });
                self.openat_callback(&completion, file.handle);
            }
            while (!self.done) try self.io.run();

            try testing.expectEqual(self.write_buf.len, self.written);
            try testing.expectEqual(self.read_buf.len, self.read);
            try testing.expectEqualSlices(u8, &self.write_buf, &self.read_buf);

            if (builtin.target.os.tag == .linux) {
                // Offset of 10 specified to read / write below.
                try testing.expectEqual(self.statx.size - 10, self.written);
            }
        }

        fn openat_callback(
            self: *Context,
            completion: *IO.Completion,
            result: anyerror!posix.fd_t,
        ) void {
            self.fd = result catch @panic("openat error");
            self.io.write(
                *Context,
                self,
                write_callback,
                completion,
                self.fd.?,
                &self.write_buf,
                10,
            );
        }

        fn write_callback(
            self: *Context,
            completion: *IO.Completion,
            result: IO.WriteError!usize,
        ) void {
            self.written = result catch @panic("write error");
            self.io.read(*Context, self, read_callback, completion, self.fd.?, &self.read_buf, 10);
        }

        fn read_callback(
            self: *Context,
            completion: *IO.Completion,
            result: IO.ReadError!usize,
        ) void {
            self.read = result catch @panic("read error");
            self.io.close(*Context, self, close_callback, completion, self.fd.?);
        }

        fn close_callback(
            self: *Context,
            completion: *IO.Completion,
            result: IO.CloseError!void,
        ) void {
            _ = result catch @panic("close error");

            if (builtin.target.os.tag == .linux) {
                self.io.statx(
                    *Context,
                    self,
                    statx_callback,
                    completion,
                    posix.AT.FDCWD,
                    self.path,
                    0,
                    os.linux.STATX_BASIC_STATS,
                    &self.statx,
                );
            } else {
                self.done = true;
            }
        }

        fn statx_callback(
            self: *Context,
            completion: *IO.Completion,
            result: IO.StatxError!void,
        ) void {
            _ = completion;
            _ = result catch @panic("statx error");

            assert(!self.done);
            self.done = true;
        }
    }.run_test();
}

test "accept/connect/send/receive" {
    try struct {
        const Context = @This();

        io: *IO,
        done: bool = false,
        server: posix.socket_t,
        client: posix.socket_t,

        accepted_sock: posix.socket_t = undefined,

        send_buf: [10]u8 = [_]u8{ 1, 0, 1, 0, 1, 0, 1, 0, 1, 0 },
        recv_buf: [5]u8 = [_]u8{ 0, 1, 0, 1, 0 },

        sent: usize = 0,
        received: usize = 0,

        fn run_test() !void {
            var io = try IO.init(32, 0);
            defer io.deinit();

            const address = try std.net.Address.parseIp4("127.0.0.1", 0);
            const kernel_backlog = 1;

            const server = try io.open_socket_tcp(address.any.family, tcp_options);
            defer io.close_socket(server);

            const client = try io.open_socket_tcp(address.any.family, tcp_options);
            defer io.close_socket(client);

            try posix.setsockopt(
                server,
                posix.SOL.SOCKET,
                posix.SO.REUSEADDR,
                &std.mem.toBytes(@as(c_int, 1)),
            );
            try posix.bind(server, &address.any, address.getOsSockLen());
            try posix.listen(server, kernel_backlog);

            var client_address = std.net.Address.initIp4(undefined, undefined);
            var client_address_len = client_address.getOsSockLen();
            try posix.getsockname(server, &client_address.any, &client_address_len);

            var self: Context = .{
                .io = &io,
                .server = server,
                .client = client,
            };

            var client_completion: IO.Completion = undefined;
            self.io.connect(
                *Context,
                &self,
                connect_callback,
                &client_completion,
                client,
                client_address,
            );

            var server_completion: IO.Completion = undefined;
            self.io.accept(*Context, &self, accept_callback, &server_completion, server);

            while (!self.done) try self.io.run();

            try testing.expectEqual(self.send_buf.len, self.sent);
            try testing.expectEqual(self.recv_buf.len, self.received);

            try testing.expectEqualSlices(u8, self.send_buf[0..self.received], &self.recv_buf);
        }

        fn connect_callback(
            self: *Context,
            completion: *IO.Completion,
            result: IO.ConnectError!void,
        ) void {
            _ = result catch @panic("connect error");

            self.io.send(
                *Context,
                self,
                send_callback,
                completion,
                self.client,
                &self.send_buf,
            );
        }

        fn send_callback(
            self: *Context,
            completion: *IO.Completion,
            result: IO.SendError!usize,
        ) void {
            _ = completion;

            self.sent = result catch @panic("send error");
        }

        fn accept_callback(
            self: *Context,
            completion: *IO.Completion,
            result: IO.AcceptError!posix.socket_t,
        ) void {
            self.accepted_sock = result catch @panic("accept error");
            self.io.recv(
                *Context,
                self,
                recv_callback,
                completion,
                self.accepted_sock,
                &self.recv_buf,
            );
        }

        fn recv_callback(
            self: *Context,
            completion: *IO.Completion,
            result: IO.RecvError!usize,
        ) void {
            _ = completion;

            self.received = result catch @panic("recv error");
            self.done = true;
        }
    }.run_test();
}

test "timeout" {
    const ms = 20;
    const margin = 100;
    const count = 10;

    try struct {
        const Context = @This();

        io: IO,
        timer: Time,
        count: u32 = 0,
        stop_time: u64 = 0,

        fn run_test() !void {
            var time_os: TimeOS = .{};
            const timer = time_os.time();
            const start_time = timer.monotonic().ns;
            var self: Context = .{
                .timer = timer,
                .io = try IO.init(32, 0),
            };
            defer self.io.deinit();

            var completions: [count]IO.Completion = undefined;
            for (&completions) |*completion| {
                self.io.timeout(
                    *Context,
                    &self,
                    timeout_callback,
                    completion,
                    ms * std.time.ns_per_ms,
                );
            }
            while (self.count < count) try self.io.run();

            try self.io.run();
            try testing.expectEqual(@as(u32, count), self.count);

            try testing.expectApproxEqAbs(
                @as(f64, ms),
                @as(f64, @floatFromInt((self.stop_time - start_time) / std.time.ns_per_ms)),
                margin,
            );
        }

        fn timeout_callback(
            self: *Context,
            completion: *IO.Completion,
            result: IO.TimeoutError!void,
        ) void {
            _ = completion;
            _ = result catch @panic("timeout error");

            if (self.stop_time == 0) self.stop_time = self.timer.monotonic().ns;
            self.count += 1;
        }
    }.run_test();
}
