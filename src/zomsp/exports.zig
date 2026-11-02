const std = @import("std");
const builtin = @import("builtin");
const backend = @import("backend.zig");
const wire = @import("wire.zig");
const endpoints = @import("endpoints.zig");
const transport = @import("channel.zig");
const allocator = std.heap.page_allocator;

const Context = struct {
    store: backend.Backend,
    runtime: ?*endpoints.Runtime = null,
    certificate: ?[:0]u8 = null,
    key: ?[:0]u8 = null,
};
const Session = struct { state: wire.State };

export fn zomsp_session_open(context: ?*Context) ?*Session {
    const ctx = context orelse return null;
    const session = allocator.create(Session) catch return null;
    session.* = .{ .state = .{ .backend = &ctx.store } };
    return session;
}
export fn zomsp_session_close(session: ?*Session) void {
    if (session) |handle| allocator.destroy(handle);
}
export fn zomsp_dispatch(session: ?*Session, input: ?[*]const u8, length: usize, output: ?[*]u8, capacity: usize) isize {
    const handle = session orelse return -1;
    if (input == null or output == null or length > wire.limit or capacity < wire.limit) return -1;
    const message = wire.Message.parse(input.?[0..length]) catch |err| return failure(err);
    var writer: wire.Writer = .{};
    const response = wire.reply(&writer, message, &handle.state) catch |err| return failure(err);
    @memcpy(output.?[0..response.len], response);
    return @intCast(response.len);
}
export fn zomsp_poll(session: ?*Session, now_us: i64, output: ?[*]u8, capacity: usize) isize {
    const handle = session orelse return -1;
    if (output == null or capacity < wire.limit or now_us < 0) return -1;
    var writer: wire.Writer = .{};
    const response = (wire.pollNotification(&writer, &handle.state, now_us) catch |err| return failure(err)) orelse return 0;
    @memcpy(output.?[0..response.len], response);
    return @intCast(response.len);
}

fn failure(err: anyerror) i32 {
    return switch (err) {
        error.ObjectNotFound => -2,
        error.AttributeNotFound => -3,
        error.ReadOnly => -4,
        error.ObjectLimit, error.ValueLimit, error.BufferTooSmall => -5,
        error.StoreBusy => -6,
        error.TypeMismatch => -7,
        else => -1,
    };
}
fn valid(value: []const u8) !void {
    var reader = wire.Reader{ .data = value };
    _ = try reader.value(0);
    if (reader.offset != value.len) return error.InvalidValue;
}

export fn zomsp_open(path: ?[*:0]const u8, create: u8) ?*Context {
    if (path == null or create > 1) return null;
    const context = allocator.create(Context) catch return null;
    context.* = .{ .store = backend.Backend.open(std.mem.span(path.?), create != 0) catch {
        allocator.destroy(context);
        return null;
    } };
    return context;
}
export fn zomsp_object(context: ?*Context, rid: u32, parent: u32, class: u32) i32 {
    const ctx = context orelse return -1;
    ctx.store.addObject(rid, parent, class) catch |err| return failure(err);
    return 0;
}
export fn zomsp_delete(context: ?*Context, rid: u32) i32 {
    const ctx = context orelse return -1;
    ctx.store.remove(rid) catch |err| return failure(err);
    return 0;
}
export fn zomsp_template(context: ?*Context, rid: u32) i32 {
    const ctx = context orelse return -1;
    ctx.store.makeTemplate(rid) catch |err| return failure(err);
    return 0;
}
export fn zomsp_link(context: ?*Context, rid: u32, aid: u32, targets: ?[*]const u32, count: usize) i32 {
    const ctx = context orelse return -1;
    if (count > 16 or (count != 0 and targets == null)) return -1;
    ctx.store.link(rid, aid, if (targets) |ptr| ptr[0..count] else &.{}) catch |err| return failure(err);
    return 0;
}
export fn zomsp_set(context: ?*Context, rid: u32, aid: u32, bytes: ?[*]const u8, length: usize, writable: u8) i32 {
    const ctx = context orelse return -1;
    if (bytes == null or length < 2 or length > backend.max_value_bytes or writable > 1) return -1;
    const value = bytes.?[0..length];
    valid(value) catch |err| return failure(err);
    ctx.store.put(rid, aid, value, writable != 0) catch |err| return failure(err);
    return 0;
}
export fn zomsp_get(context: ?*Context, rid: u32, aid: u32, output: ?[*]u8, capacity: usize) isize {
    const ctx = context orelse return -1;
    if (output == null or capacity == 0) return -1;
    const value = ctx.store.get(rid, aid, output.?[0..@min(capacity, backend.max_value_bytes)]) catch |err| return failure(err);
    return @intCast(value.len);
}
export fn zomsp_size() usize {
    return @sizeOf(backend.Layout);
}
export fn zomsp_start(context: ?*Context, port: u16, certificate: ?[*:0]const u8, key: ?[*:0]const u8, tls_library: ?[*:0]const u8) i32 {
    const ctx = context orelse return -1;
    if (ctx.runtime != null or certificate == null or key == null or tls_library == null) return -1;
    startContext(ctx, port, std.mem.span(certificate.?), std.mem.span(key.?), tls_library.?) catch |err| return failure(err);
    return 0;
}
fn startContext(ctx: *Context, port: u16, certificate: []const u8, key: []const u8, library: [*:0]const u8) !void {
    try transport.load(library);
    const cert = try allocator.dupeZ(u8, certificate);
    errdefer allocator.free(cert);
    const private_key = try allocator.dupeZ(u8, key);
    errdefer allocator.free(private_key);
    try transport.validateServer(cert, private_key);
    if (builtin.os.tag == .windows) {
        var data: std.os.windows.ws2_32.WSADATA = undefined;
        if (std.os.windows.ws2_32.WSAStartup(0x202, &data) != 0) return error.SocketConfiguration;
    }
    errdefer if (builtin.os.tag == .windows) {
        _ = std.os.windows.ws2_32.WSACleanup();
    };
    const runtime = try allocator.create(endpoints.Runtime);
    errdefer allocator.destroy(runtime);
    runtime.* = try endpoints.Runtime.init(port, cert, private_key, &ctx.store);
    errdefer runtime.stop();
    try runtime.start();
    ctx.runtime = runtime;
    ctx.certificate = cert;
    ctx.key = private_key;
}
export fn zomsp_port(context: ?*Context) u16 {
    const ctx = context orelse return 0;
    const runtime = ctx.runtime orelse return 0;
    return runtime.listener.listen_address.getPort();
}
export fn zomsp_stop(context: ?*Context) void {
    const ctx = context orelse return;
    const runtime = ctx.runtime orelse return;
    runtime.stop();
    allocator.destroy(runtime);
    allocator.free(ctx.certificate.?);
    allocator.free(ctx.key.?);
    ctx.runtime = null;
    ctx.certificate = null;
    ctx.key = null;
    if (builtin.os.tag == .windows) _ = std.os.windows.ws2_32.WSACleanup();
}
export fn zomsp_close(context: ?*Context) void {
    const ctx = context orelse return;
    zomsp_stop(ctx);
    ctx.store.close();
    allocator.destroy(ctx);
}
