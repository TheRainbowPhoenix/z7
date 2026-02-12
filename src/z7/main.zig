const std = @import("std");
const vsr = @import("vsr");
const IO = vsr.io.IO;
const Storage = @import("storage.zig").Storage;
const Connection = @import("connection.zig").Connection;

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
            if (conn.closed) {
                found_slot = conn;
                break;
            }
        }

        if (found_slot) |conn| {
            log.info("Client connected! Socket: {}", .{client_socket});
            // Re-initialize the connection slot
            conn.* = Connection.init(self.io, self.storage, client_socket);
            conn.start();
        } else {
            log.warn("Max connections reached, dropping client.", .{});
            std.posix.close(client_socket);
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

    // 4095 entries (u12 max), 0 flags
    var io = IO.init(4095, 0) catch |err| {
        log.err("Failed to init IO: {}", .{err});
        return err;
    };
    defer io.deinit();

    // Bind Port 102
    // On Windows/Linux we need root/admin for ports < 1024 often.
    // S7 uses 102.
    // S7 uses 102 (or 10202 for testing).
    const port = 10202;
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

    // Initialize as closed with safe defaults
    for (connections) |*c| {
        // We use dummy values for io/storage because closed=true prevents usage
        c.* = Connection.init(&io, &storage, std.os.windows.ws2_32.INVALID_SOCKET);
        c.closed = true;
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
