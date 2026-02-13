const std = @import("std");
const builtin = @import("builtin");
const zCom = @import("zCom");
const IO = zCom.io.IO;
const Storage = @import("storage.zig").Storage;
const Connection = @import("connection.zig").Connection;
const main = @import("main.zig");

// Global log callback
var log_callback: ?*const fn (level: u8, msg_ptr: [*c]const u8, msg_len: usize) callconv(.C) void = null;

// Runtime log level (matches std.log.Level: 0=err, 1=warn, 2=info, 3=debug)
var dll_log_level: u8 = 2; // default: info

// Global event callback: event_type (1=plc_stop_request, 2=plc_start_request, 3=client_connected, 4=client_disconnected)
pub var event_callback: ?*const fn (event_type: u8, detail_ptr: [*c]const u8, detail_len: usize) callconv(.C) void = null;

fn myLog(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.enum_literal),
    comptime format: []const u8,
    args: anytype,
) void {
    const level_int = @intFromEnum(level);
    // Filter by runtime log level
    if (level_int > dll_log_level) return;
    if (log_callback) |cb| {
        var buf: [1024]u8 = undefined;
        // Format: [level] (scope): message
        const slice = std.fmt.bufPrint(&buf, "[" ++ @tagName(level) ++ "] (" ++ @tagName(scope) ++ "): " ++ format, args) catch return;
        cb(level_int, slice.ptr, slice.len);
    } else {
        const stderr = std.io.getStdErr().writer();
        nosuspend stderr.print("[" ++ @tagName(level) ++ "] (" ++ @tagName(scope) ++ "): " ++ format ++ "\n", args) catch return;
    }
}

pub const std_options = std.Options{
    .log_level = .debug,
    .logFn = myLog,
};

const Context = struct {
    gpa: std.heap.GeneralPurposeAllocator(.{}),
    io: IO,
    storage: Storage,
    server: main.Server,
    connections: []Connection,
    listener: std.posix.socket_t,
    thread_: ?std.Thread = null,
    running: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
};

export fn z7_set_log_callback(cb: ?*const fn (u8, [*c]const u8, usize) callconv(.C) void) void {
    log_callback = cb;
}

export fn z7_set_event_callback(cb: ?*const fn (u8, [*c]const u8, usize) callconv(.C) void) void {
    event_callback = cb;
}

/// Set runtime log level: 0=err, 1=warn, 2=info, 3=debug
export fn z7_set_log_level(level: u8) void {
    dll_log_level = if (level > 3) 3 else level;
}

/// Returns 1 if running, 0 if stopped
export fn z7_get_status(ctx: *Context) u8 {
    return if (ctx.running.load(.acquire)) 1 else 0;
}

/// Returns pointer to the raw storage memory
export fn z7_get_memory_ptr(ctx: *Context) [*c]u8 {
    return ctx.storage.ptr.ptr;
}

/// Returns total size of the storage memory
export fn z7_get_memory_size(ctx: *Context) usize {
    return ctx.storage.ptr.len;
}

export fn z7_init(port: u16, storage_path: [*c]const u8) ?*Context {
    const ctx = std.heap.page_allocator.create(Context) catch return null;
    ctx.gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = ctx.gpa.allocator();

    // Storage path conversion
    const path_span: []const u8 = if (storage_path) |s| std.mem.span(s) else "s7_plc_shm";

    ctx.storage = Storage.init(path_span, Storage.MAX_DBS_DEFAULT) catch {
        std.log.err("Failed to init storage", .{});
        std.heap.page_allocator.destroy(ctx);
        return null;
    };
    errdefer ctx.storage.deinit();

    ctx.io = IO.init(2048, 0) catch |err| {
        std.log.err("Failed to init IO: {}", .{err});
        ctx.storage.deinit();
        std.heap.page_allocator.destroy(ctx);
        return null;
    };
    errdefer ctx.io.deinit();

    const address = std.net.Address.parseIp4("0.0.0.0", port) catch return null;

    const listener = ctx.io.open_socket_tcp(std.posix.AF.INET, .{
        .rcvbuf = 0,
        .sndbuf = 0,
        .keepalive = null,
        .user_timeout_ms = 0,
        .nodelay = true,
    }) catch return null;
    ctx.listener = listener;

    _ = ctx.io.listen(listener, address, .{ .backlog = 128 }) catch {
        ctx.io.close_socket(listener);
        return null;
    };

    ctx.connections = allocator.alloc(Connection, main.MAX_CONNECTIONS) catch return null;
    const invalid_socket = if (builtin.os.tag == .windows) std.os.windows.ws2_32.INVALID_SOCKET else -1;
    for (ctx.connections) |*c| {
        c.* = Connection.init(&ctx.io, &ctx.storage, invalid_socket);
    }

    ctx.server = main.Server{
        .io = &ctx.io,
        .storage = &ctx.storage,
        .listener = listener,
        .connections = ctx.connections,
        .accept_completion = undefined,
    };

    ctx.thread_ = null;
    ctx.running = std.atomic.Value(bool).init(false);

    return ctx;
}

fn run_loop(ctx: *Context) void {
    std.log.info("Server loop starting", .{});
    ctx.server.start_accept();

    while (ctx.running.load(.acquire)) {
        ctx.io.run_for_ns(10 * std.time.ns_per_ms) catch break;
    }
}

export fn z7_start(ctx: *Context) void {
    if (ctx.thread_ != null) return;
    ctx.running.store(true, .release);
    ctx.thread_ = std.Thread.spawn(.{}, run_loop, .{ctx}) catch return;
}

export fn z7_stop(ctx: *Context) void {
    ctx.running.store(false, .release);
    if (ctx.thread_) |t| {
        t.join();
        ctx.thread_ = null;
    }
}

export fn z7_deinit(ctx: *Context) void {
    z7_stop(ctx);

    const allocator = ctx.gpa.allocator();
    allocator.free(ctx.connections);

    ctx.io.close_socket(ctx.listener);
    ctx.io.deinit();
    ctx.storage.deinit();
    _ = ctx.gpa.deinit();
    std.heap.page_allocator.destroy(ctx);
}

export fn z7_read(ctx: *Context, area: u8, db_num: u16, start: u32, len: u32, out_buf: [*c]u8) i32 {
    if (out_buf == null) return -1;
    const buf_slice = out_buf[0..len];

    const slice = ctx.storage.get_address(area, db_num, start, len) catch return -1;
    if (slice.len < len) return -1;

    @memcpy(buf_slice, slice[0..len]);
    return 0;
}

export fn z7_write(ctx: *Context, area: u8, db_num: u16, start: u32, len: u32, in_buf: [*c]const u8) i32 {
    if (in_buf == null) return -1;
    const buf_slice = in_buf[0..len];

    const slice = ctx.storage.get_address(area, db_num, start, len) catch return -1;
    if (slice.len < len) return -1;

    @memcpy(slice[0..len], buf_slice);
    return 0;
}
