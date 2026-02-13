const std = @import("std");
const builtin = @import("builtin");
const zCom = @import("../common/zCom.zig");
const IO = zCom.io.IO;
const Storage = @import("storage.zig").Storage;
const Connection = @import("connection.zig").Connection;

var current_log_level: std.log.Level = .warn;

pub const std_options: std.Options = .{
    .log_level = .debug,
    .logFn = myLog,
};

pub fn myLog(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.enum_literal),
    comptime format: []const u8,
    args: anytype,
) void {
    if (@intFromEnum(level) > @intFromEnum(current_log_level)) return;

    const stderr = std.io.getStdErr().writer();
    nosuspend stderr.print("[" ++ @tagName(level) ++ "] (" ++ @tagName(scope) ++ "): " ++ format ++ "\n", args) catch return;
}

const log = std.log.scoped(.z7);

const MAX_CONNECTIONS = 100;

const Server = struct {
    io: *IO,
    storage: *Storage,
    listener: std.posix.socket_t,
    connections: []Connection,

    accept_completion: IO.Completion = undefined,

    pub fn start_accept(self: *Server) void {
        self.io.accept(
            *Server,
            self,
            on_accept,
            &self.accept_completion,
            self.listener,
        );
    }

    fn on_accept(self: *Server, completion: *IO.Completion, result: IO.AcceptError!std.posix.socket_t) void {
        _ = completion;
        const client_socket = result catch |err| {
            log.err("Accept failed: {}", .{err});
            self.start_accept();
            return;
        };

        // Find free slot
        var found_slot: ?*Connection = null;
        for (self.connections) |*conn| {
            if (conn.closed and conn.pending_ops == 0) {
                found_slot = conn;
                break;
            }
        }

        if (found_slot) |conn| {
            log.info("Client connected! Socket: {}", .{client_socket});
            // Re-initialize the connection slot safely
            conn.reset(client_socket);
            conn.start();
        } else {
            log.warn("Max connections reached, dropping client.", .{});
            if (builtin.os.tag == .windows) {
                _ = std.os.windows.ws2_32.closesocket(client_socket);
            } else {
                std.posix.close(client_socket);
            }
        }

        // Always continue accepting
        self.start_accept();
    }
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var storage = Storage.init("s7_plc_shm") catch |err| {
        log.err("Failed to init storage: {}", .{err});
        return err;
    };
    defer storage.deinit();

    // Parse port
    var port: u16 = 102;
    var args = try std.process.argsWithAllocator(allocator);
    defer args.deinit();
    _ = args.next(); // skip exe name
    while (args.next()) |arg| {
        if (std.mem.eql(u8, arg, "--port")) {
            if (args.next()) |p| {
                port = try std.fmt.parseInt(u16, p, 10);
            }
        } else if (std.mem.eql(u8, arg, "--verbose")) {
            current_log_level = .info;
        } else if (std.mem.eql(u8, arg, "--debug")) {
            current_log_level = .debug;
        }
    }

    log.info("S7 Service starting on port {}", .{port});

    var io = try IO.init(2048, 0);
    defer io.deinit();

    const address = try std.net.Address.parseIp4("0.0.0.0", port); // io.listen expects address

    // Use IO to create the socket so it is registered with IOCP
    const listener = try io.open_socket_tcp(std.posix.AF.INET, .{
        .rcvbuf = 0,
        .sndbuf = 0,
        .keepalive = null,
        .user_timeout_ms = 0,
        .nodelay = true,
    });
    errdefer io.close_socket(listener);

    // Bind and Listen
    // IO.listen typically does bind + listen.
    // Wait, reference_src/io/windows.zig: listen calls common.listen.
    // common.listen calls bind, getsockname, listen.
    _ = try io.listen(listener, address, .{ .backlog = 128 });

    log.info("S7 Service listening on port {}", .{port});

    const connections = try allocator.alloc(Connection, MAX_CONNECTIONS);
    defer allocator.free(connections);

    const invalid_socket = if (builtin.os.tag == .windows) std.os.windows.ws2_32.INVALID_SOCKET else -1;

    // Initialize as closed with safe defaults
    for (connections) |*c| {
        // We use dummy values for io/storage because closed=true prevents usage
        c.* = Connection.init(&io, &storage, invalid_socket);
    }

    var server = Server{
        .io = &io,
        .storage = &storage,
        .listener = listener,
        .connections = connections,
    };

    server.start_accept();

    while (true) {
        try io.run_for_ns(10 * std.time.ns_per_ms);
    }
}
