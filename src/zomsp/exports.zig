const std = @import("std");
const builtin = @import("builtin");
const backend = @import("backend.zig");
const wire = @import("wire.zig");
const endpoints = @import("endpoints.zig");
const transport = @import("channel.zig");
const allocator = std.heap.page_allocator;
const application = @import("application.zig");
const client_api = @import("client.zig");

const Context = struct {
    store: backend.Backend,
    runtime: ?*endpoints.Runtime = null,
    sessions: usize = 0,
    certificate: ?[:0]u8 = null,
    key: ?[:0]u8 = null,
};
const Session = struct { state: wire.State, context: *Context };

export fn zomsp_session_open(context: ?*Context) ?*Session {
    const ctx = context orelse return null;
    if (ctx.sessions == 16) return null;
    const session = allocator.create(Session) catch return null;
    session.* = .{ .state = .{ .backend = &ctx.store }, .context = ctx };
    ctx.sessions += 1;
    return session;
}
export fn zomsp_session_close(session: ?*Session) void {
    if (session) |handle| {
        std.debug.assert(handle.context.sessions > 0);
        handle.state.close();
        handle.context.sessions -= 1;
        allocator.destroy(handle);
    }
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
        error.ObjectLimit, error.ValueLimit, error.BufferTooSmall, error.MethodLimit => -5,
        error.StoreBusy, error.TransactionConflict => -6,
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
export fn zomsp_legacy_password(context: ?*Context, password: ?[*]const u8, length: usize) i32 {
    const ctx = context orelse return -1;
    if (length > 256 or (length != 0 and password == null)) return -1;
    if (ctx.runtime != null or ctx.sessions != 0) return -6;
    ctx.store.authentication.configure(if (password) |bytes| bytes[0..length] else &.{}) catch return -1;
    return 0;
}
export fn zomsp_password(context: ?*Context, password: ?[*]const u8, length: usize) i32 {
    if (password == null or length == 0 or length > 256) return -1;
    const result = zomsp_legacy_password(context, password, length);
    if (result != 0) return result;
    context.?.store.authentication.profile = 0x400;
    return 0;
}
export fn zomsp_user_password(context: ?*Context, username: ?[*]const u8, username_length: usize, password: ?[*]const u8, length: usize) i32 {
    if (username == null or username_length == 0 or username_length > 128 or password == null or length == 0 or length > 256) return -1;
    const result = zomsp_password(context, password, length);
    if (result != 0) return result;
    var user_hash: [32]u8 = undefined;
    var password_hash: [32]u8 = undefined;
    defer std.crypto.utils.secureZero(u8, &password_hash);
    std.crypto.hash.sha2.Sha256.hash(username.?[0..username_length], &user_hash, .{});
    std.crypto.hash.sha2.Sha256.hash(password.?[0..length], &password_hash, .{});
    context.?.store.authentication.user = user_hash;
    context.?.store.authentication.password = password_hash;
    return 0;
}
export fn zomsp_activation(context: ?*Context, callback: ?application.ActivationCallback, user: ?*anyopaque) i32 {
    const ctx = context orelse return -1;
    if (ctx.runtime != null or ctx.sessions != 0) return -6;
    ctx.store.activator = if (callback) |handler| .{ .callback = handler, .user = user } else null;
    return 0;
}
export fn zomsp_transactions(context: ?*Context, enabled: u8) i32 {
    const ctx = context orelse return -1;
    if (enabled > 1) return -1;
    if (ctx.runtime != null or ctx.sessions != 0) return -6;
    ctx.store.transactions_enabled = enabled != 0;
    return 0;
}
export fn zomsp_method(context: ?*Context, target: u32, id: u32, callback: ?application.Callback, user: ?*anyopaque) i32 {
    const ctx = context orelse return -1;
    if (ctx.runtime != null or ctx.sessions != 0) return -6;
    _ = ctx.store.info(target) catch |err| return failure(err);
    ctx.store.methods.register(.{ .target = target, .id = id, .callback = callback orelse return -1, .user = user }) catch |err| return failure(err);
    return 0;
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
export fn zomsp_value_size(bytes: ?[*]const u8, length: usize) isize {
    if (bytes == null or length < 2 or length > wire.limit) return -1;
    var reader: wire.Reader = .{ .data = bytes.?[0..length] };
    _ = reader.value(0) catch return -1;
    return @intCast(reader.offset);
}
export fn zomsp_blob(context: ?*Context, rid: u32, aid: u32, length: u32, directory: ?[*:0]const u8, validator: ?backend.streaming.Validator, user: ?*anyopaque) i32 {
    const ctx = context orelse return -1;
    if (ctx.runtime != null or ctx.sessions != 0) return -6;
    if (directory == null or validator == null or ctx.store.blob != null) return -1;
    const object = ctx.store.info(rid) catch |err| return failure(err);
    if (object.flags != 0) return -4;
    const blob = allocator.create(backend.streaming.Store) catch return -1;
    blob.* = backend.streaming.Store.init(rid, aid, length, std.mem.span(directory.?), validator.?, user) catch |err| {
        allocator.destroy(blob);
        return failure(err);
    };
    ctx.store.blob = blob;
    return 0;
}
export fn zomsp_stream(context: ?*Context, rid: u32, aid: u32, length: u32, validate: ?backend.streaming.MemoryValidator, complete: ?backend.streaming.Completion, user: ?*anyopaque) i32 {
    const ctx = context orelse return -1;
    if (ctx.runtime != null or ctx.sessions != 0) return -6;
    if (complete == null or ctx.store.blob != null) return -1;
    const object = ctx.store.info(rid) catch |err| return failure(err);
    if (object.flags != 0) return -4;
    const blob = allocator.create(backend.streaming.Store) catch return -1;
    blob.* = backend.streaming.Store.initMemory(rid, aid, length, validate, complete.?, user) catch |err| {
        allocator.destroy(blob);
        return failure(err);
    };
    ctx.store.blob = blob;
    return 0;
}
export fn zomsp_buffer_retain(buffer: ?*backend.streaming.Buffer) void {
    if (buffer) |value| value.retain();
}
export fn zomsp_buffer_release(buffer: ?*backend.streaming.Buffer) void {
    if (buffer) |value| value.release();
}
export fn zomsp_buffer_generation(buffer: ?*const backend.streaming.Buffer) u64 {
    return if (buffer) |value| value.generation else 0;
}
export fn zomsp_buffer_size(buffer: ?*const backend.streaming.Buffer) usize {
    return if (buffer) |value| value.bytes.len else 0;
}
export fn zomsp_buffer_read(buffer: ?*const backend.streaming.Buffer, offset: usize, output: ?[*]u8, capacity: usize) isize {
    const value = buffer orelse return -1;
    if (output == null or offset > value.bytes.len) return -1;
    const count = @min(capacity, value.bytes.len - offset);
    @memcpy(output.?[0..count], value.bytes[offset..][0..count]);
    return @intCast(count);
}
export fn zomsp_blob_path(context: ?*Context, output: ?[*]u8, capacity: usize) isize {
    const ctx = context orelse return -1;
    if (output == null or capacity == 0) return -1;
    const blob = ctx.store.blob orelse return -1;
    return @intCast(blob.path(output.?[0..capacity]) catch |err| return failure(err));
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
    if (ctx.store.blob) |blob| {
        blob.deinit();
        allocator.destroy(blob);
    }
    ctx.store.close();
    allocator.destroy(ctx);
}

export fn zomsp_client_open(host: ?[*:0]const u8, port: u16, certificate: ?[*:0]const u8, tls_library: ?[*:0]const u8) ?*client_api.Client {
    if (host == null or certificate == null or tls_library == null or port == 0) return null;
    return client_api.Client.open(std.mem.span(host.?), port, std.mem.span(certificate.?), std.mem.span(tls_library.?)) catch |err| {
        std.log.warn("zOMSp client connect: {s}", .{@errorName(err)});
        return null;
    };
}
export fn zomsp_client_close(client: ?*client_api.Client) void {
    if (client) |handle| handle.close();
}
fn clientFailure(client: *client_api.Client, err: anyerror) i32 {
    return switch (err) {
        error.RemoteStatus => -9,
        error.ObjectNotFound => -2,
        error.AmbiguousName => -10,
        error.BufferTooSmall => -5,
        error.InvalidSequenceState, error.InvalidValue, error.InvalidCredentials => -1,
        else => blk: {
            client.failed = true;
            break :blk -8;
        },
    };
}
export fn zomsp_client_session(client: ?*const client_api.Client) u32 {
    return if (client) |handle| handle.session else 0;
}
export fn zomsp_client_status(client: ?*const client_api.Client) u64 {
    return if (client) |handle| handle.status else 0;
}
export fn zomsp_client_authenticate(client: ?*client_api.Client, username: ?[*]const u8, username_length: usize, password: ?[*]const u8, password_length: usize) i32 {
    const handle = client orelse return -1;
    if (password == null or password_length == 0 or password_length > 256 or username_length > 128 or (username_length != 0 and username == null)) return -1;
    handle.authenticate(if (username) |text| text[0..username_length] else &.{}, password.?[0..password_length]) catch |err| return clientFailure(handle, err);
    return 0;
}
export fn zomsp_client_read(client: ?*client_api.Client, rid: u32, aid: u32, output: ?[*]u8, capacity: usize) isize {
    const handle = client orelse return -1;
    if (rid == 0 or aid == 0 or output == null or capacity == 0) return -1;
    const value = handle.read(rid, aid) catch |err| return clientFailure(handle, err);
    if (value.len > capacity) return -5;
    @memcpy(output.?[0..value.len], value);
    return @intCast(value.len);
}
export fn zomsp_client_write(client: ?*client_api.Client, rid: u32, aid: u32, value: ?[*]const u8, length: usize) i32 {
    const handle = client orelse return -1;
    if (rid == 0 or aid == 0 or value == null or length < 2 or length > 60000) return -1;
    valid(value.?[0..length]) catch return -1;
    handle.write(rid, aid, value.?[0..length]) catch |err| return clientFailure(handle, err);
    return 0;
}
export fn zomsp_client_find(client: ?*client_api.Client, root: u32, name: ?[*]const u8, length: usize, output: ?*u32) i32 {
    const handle = client orelse return -1;
    if (root == 0 or name == null or length == 0 or length > 128 or output == null) return -1;
    output.?.* = handle.find(root, name.?[0..length]) catch |err| return clientFailure(handle, err);
    return 0;
}
export fn zomsp_client_begin(client: ?*client_api.Client) i32 {
    const handle = client orelse return -1;
    handle.start() catch |err| return clientFailure(handle, err);
    return 0;
}
export fn zomsp_client_end(client: ?*client_api.Client, abort: u8) i32 {
    const handle = client orelse return -1;
    if (abort > 1) return -1;
    handle.end(abort != 0) catch |err| return clientFailure(handle, err);
    return 0;
}
export fn zomsp_client_upload(client: ?*client_api.Client, rid: u32, aid: u32, bytes: ?[*]const u8, length: usize) i32 {
    const handle = client orelse return -1;
    if (rid == 0 or aid == 0 or bytes == null or length == 0 or length > backend.streaming.max_bytes) return -1;
    handle.stream(rid, aid, bytes.?[0..length]) catch |err| return clientFailure(handle, err);
    return 0;
}
