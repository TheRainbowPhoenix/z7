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

    var storage = try Storage.init("s7_plc_shm");
    defer storage.deinit();

    // 4095 entries (u12 max), 0 flags
    var io = try IO.init(4095, 0);
    defer io.deinit();

    // Bind Port 102
    // On Windows/Linux we need root/admin for ports < 1024 often.
    // S7 uses 102.
    const port = 102;
    const address = try std.net.Address.parseIp4("0.0.0.0", port);

    const listener = try std.posix.socket(std.posix.AF.INET, std.posix.SOCK.STREAM, std.posix.IPPROTO.TCP);
    errdefer std.posix.close(listener);

    // Allow address reuse
    // Note: Windows SO_REUSEADDR behaves differently than Linux, but usually okay for restart.
    // std.os.setsockopt ... skipping for brevity.

    try std.posix.bind(listener, &address.any, address.getOsSockLen());
    try std.posix.listen(listener, 128);

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
