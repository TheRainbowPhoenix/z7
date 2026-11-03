const std = @import("std");
const builtin = @import("builtin");
const backend = @import("backend.zig");
const wire = @import("wire.zig");
const endpoints = @import("endpoints.zig");
const transport = @import("channel.zig");
const allocator = std.heap.page_allocator;
const application = @import("application.zig");
const client_api = @import("client.zig");
const model_api = @import("model.zig");
export fn zomsp_invoke_result_visit(data: ?[*]const u8, length: usize, callback: ?model_api.ValueVisitor, user: ?*anyopaque) i32 {
    if (data == null or length > 8192 or callback == null) return -1;
    model_api.invokeResult(data.?[0..length], callback, user) catch return -1;
    return 0;
}
const Filter = extern struct { operation: u32, address_count: u32, address: [4]u32, value: ?[*]const u8, length: usize };
export fn zomsp_filters_encode(filters: ?[*]const Filter, count: usize, output: ?[*]u8, capacity: usize) isize {
    if ((count != 0 and filters == null) or count > 10 or output == null or capacity < 8192) return -1;
    var writer: wire.Writer = .{};
    if (filters) |entries| for (entries[0..count], 0..) |entry, index| {
        if (entry.address_count > 4 or entry.value == null or entry.length < 2 or entry.length > 1024 or entry.operation > 63) return -1;
        valid(entry.value.?[0..entry.length]) catch return -1;
        writer.vlq(index + 1) catch return -1;
        writer.put(&.{ 0, 0x17 }) catch return -1;
        writer.be32(1246) catch return -1;
        writer.vlq(1247) catch return -1;
        writer.put(&.{ 0, 8, @intCast(entry.operation) }) catch return -1;
        writer.vlq(1249) catch return -1;
        writer.uint(entry.address_count) catch return -1;
        writer.vlq(1250) catch return -1;
        writer.put(&.{ 0x10, 4, 32 }) catch return -1;
        for (0..32) |slot| writer.vlq(if (slot < entry.address_count) entry.address[slot] else 0) catch return -1;
        writer.vlq(1251) catch return -1;
        writer.put(entry.value.?[0..entry.length]) catch return -1;
        writer.byte(0) catch return -1;
    };
    writer.byte(0) catch return -1;
    if (writer.used > capacity or writer.used > 8192) return -5;
    wire.validateFilters(writer.data[0..writer.used]) catch return -1;
    @memcpy(output.?[0..writer.used], writer.data[0..writer.used]);
    return @intCast(writer.used);
}
export fn zomsp_notification_info(data: ?[*]const u8, length: usize, output: ?*model_api.NotificationInfo) i32 {
    if (data == null or length > wire.limit or output == null) return -1;
    output.?.* = model_api.notificationInfo(data.?[0..length]) catch return -1;
    return 0;
}
export fn zomsp_objects_visit(data: ?[*]const u8, length: usize, callback: ?model_api.Visitor, user: ?*anyopaque) i32 {
    if (data == null or length > wire.limit or callback == null) return -1;
    model_api.objects(data.?[0..length], callback, user) catch return -1;
    return 0;
}
export fn zomsp_notification_visit(data: ?[*]const u8, length: usize, callback: ?model_api.EventVisitor, user: ?*anyopaque) i32 {
    if (data == null or length > wire.limit or callback == null) return -1;
    model_api.notification(data.?[0..length], callback, user) catch return -1;
    return 0;
}
export fn zomsp_class(context: ?*Context, id: u32, base: u32, flags: u32, composition: u32) i32 {
    const ctx = context orelse return -1;
    if (ctx.runtime != null or ctx.sessions != 0) return -6;
    ctx.store.schema.register(.{ .id = id, .base = base, .flags = flags, .composition = composition }) catch |err| return failure(err);
    return 0;
}
export fn zomsp_sequences(context: ?*Context, callback: ?application.SequenceCallback, user: ?*anyopaque) i32 {
    const ctx = context orelse return -1;
    if (ctx.runtime != null or ctx.sessions != 0) return -6;
    ctx.store.sequencer = if (callback) |function| .{ .callback = function, .user = user } else null;
    return 0;
}
const events_api = @import("events.zig");

export fn zomsp_events(context: ?*Context) i32 {
    const ctx = context orelse return -1;
    if (ctx.runtime != null or ctx.sessions != 0) return -6;
    if (ctx.store.events != null) return 0;
    const events = allocator.create(events_api.Store) catch return -1;
    events.* = .{};
    ctx.store.events = events;
    return 0;
}
export fn zomsp_event(context: ?*Context, subsystem: u32, domain: u16, data: ?[*]const u8, length: usize) i32 {
    const ctx = context orelse return -1;
    if (data == null or length == 0 or length > events_api.max_bytes) return -1;
    const events = ctx.store.events orelse return -1;
    _ = ctx.store.info(subsystem) catch |err| return failure(err);
    wire.validateEvent(data.?[0..length], domain) catch |err| return failure(err);
    events.publish(subsystem, domain, data.?[0..length]) catch |err| return failure(err);
    return 0;
}
export fn zomsp_factory(context: ?*Context, class: u32, validate: ?application.CreateValidator, created: ?application.Created, user: ?*anyopaque) i32 {
    const ctx = context orelse return -1;
    if (ctx.runtime != null or ctx.sessions != 0) return -6;
    if (class == 0 or created == null) return -1;
    for (ctx.store.factories) |entry| if (entry) |factory| if (factory.class == class) return -1;
    for (&ctx.store.factories) |*entry| {
        if (entry.* != null) continue;
        entry.* = .{ .class = class, .validate = validate, .created = created.?, .user = user };
        return 0;
    }
    return -5;
}

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
export fn zomsp_client_context(client: ?*const client_api.Client) u32 {
    return if (client) |handle| handle.context else 0;
}
export fn zomsp_client_create(client: ?*client_api.Client, parent: u32, descriptor: ?[*]const u8, length: usize, output: ?[*]u32, capacity: usize) isize {
    const handle = client orelse return -1;
    if (parent == 0 or descriptor == null or length < 9 or length > 8192 or output == null or capacity < 8) return -1;
    var assigned: [8]u32 = undefined;
    const count = handle.create(parent, descriptor.?[0..length], &assigned) catch |err| return clientFailure(handle, err);
    @memcpy(output.?[0..count], assigned[0..count]);
    return @intCast(count);
}
export fn zomsp_client_delete(client: ?*client_api.Client, rid: u32) i32 {
    const handle = client orelse return -1;
    if (rid == 0) return -1;
    handle.delete(rid) catch |err| return clientFailure(handle, err);
    return 0;
}
export fn zomsp_client_notification(client: ?*client_api.Client, output: ?[*]u8, capacity: usize, wait: u8) isize {
    const handle = client orelse return -1;
    if (output == null or capacity < wire.limit or wait > 1) return -1;
    return @intCast(handle.notification(output.?[0..capacity], wait != 0) catch |err| return clientFailure(handle, err));
}
export fn zomsp_client_status(client: ?*const client_api.Client) u64 {
    return if (client) |handle| handle.status else 0;
}
export fn zomsp_client_explore(client: ?*client_api.Client, rid: u32, options: ?*const client_api.ExploreOptions, output: ?[*]u8, capacity: usize, parent: ?*u32) isize {
    const handle = client orelse return -1;
    const settings = if (options) |value| value.* else client_api.ExploreOptions{};
    if (rid == 0 or output == null or capacity < wire.limit or parent == null or settings.flags & ~@as(u32, 7) != 0 or settings.reserved != 0 or settings.aid_count > 64 or settings.filters_length > 8192 or
        (settings.aid_count != 0 and settings.aids == null) or (settings.filters_length != 0 and settings.filters == null)) return -1;
    if (settings.aids) |aids| for (aids[0..settings.aid_count]) |aid| {
        if (aid == 0) return -1;
    };
    if (settings.filters) |raw| wire.validateFilters(raw[0..settings.filters_length]) catch return -1;
    const objects = handle.explore(rid, settings, parent.?) catch |err| return clientFailure(handle, err);
    @memcpy(output.?[0..objects.len], objects);
    return @intCast(objects.len);
}
export fn zomsp_client_get_link(client: ?*client_api.Client, rid: u32, aid: u32, output: ?[*]u32, capacity: usize) isize {
    const handle = client orelse return -1;
    if (rid == 0 or aid == 0 or output == null or capacity < 16) return -1;
    var targets: [16]u32 = undefined;
    const count = handle.getLink(rid, aid, &targets) catch |err| return clientFailure(handle, err);
    @memcpy(output.?[0..count], targets[0..count]);
    return @intCast(count);
}
export fn zomsp_client_invoke(client: ?*client_api.Client, rid: u32, method: u32, arguments: ?[*]const u8, length: usize, output: ?[*]u8, capacity: usize) isize {
    const handle = client orelse return -1;
    if (rid == 0 or method == 0 or arguments == null or length < 2 or length > 8192 or output == null or capacity < 8192) return -1;
    var reader: wire.Reader = .{ .data = arguments.?[0..length] };
    wire.invokeArguments(&reader) catch return -1;
    if (reader.offset != length) return -1;
    const result = handle.invoke(rid, method, arguments.?[0..length]) catch |err| return clientFailure(handle, err);
    @memcpy(output.?[0..result.len], result);
    return @intCast(result.len);
}
export fn zomsp_client_begin_best_effort(client: ?*client_api.Client) i32 {
    const handle = client orelse return -1;
    handle.beginBestEffort() catch |err| return clientFailure(handle, err);
    return 0;
}
export fn zomsp_client_begin_application(client: ?*client_api.Client, kind: u8, parameter: u32) i32 {
    const handle = client orelse return -1;
    if (kind < 3 or kind > 5 or parameter == 0) return -1;
    handle.beginApplication(kind, parameter) catch |err| return clientFailure(handle, err);
    return 0;
}
export fn zomsp_client_subscribe(client: ?*client_api.Client, references: ?[*]const client_api.Reference, count: usize, cycle_ms: u32, credits: i16, output: ?*u32) i32 {
    const handle = client orelse return -1;
    if (references == null or count == 0 or count > 64 or cycle_ms > 60000 or credits < -1 or output == null) return -1;
    for (references.?[0..count], 0..) |reference, index| {
        if (reference.handle == 0 or reference.rid == 0 or reference.aid == 0 or reference.path_length > 3 or reference.reserved != 0) return -1;
        for (references.?[0..index]) |previous| if (previous.handle == reference.handle) return -1;
        for (reference.path[0..reference.path_length]) |part| if (part == 0) return -1;
    }
    output.?.* = handle.subscribe(references.?[0..count], cycle_ms, credits) catch |err| return clientFailure(handle, err);
    return 0;
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
export fn zomsp_client_read_path(client: ?*client_api.Client, rid: u32, path: ?[*]const u32, count: usize, output: ?[*]u8, capacity: usize) isize {
    const handle = client orelse return -1;
    if (rid == 0 or path == null or count == 0 or count > 4 or output == null or capacity == 0) return -1;
    for (path.?[0..count]) |part| if (part == 0) return -1;
    const value = handle.readPath(rid, path.?[0..count]) catch |err| return clientFailure(handle, err);
    if (value.len > capacity) return -5;
    @memcpy(output.?[0..value.len], value);
    return @intCast(value.len);
}
export fn zomsp_client_write_path(client: ?*client_api.Client, rid: u32, path: ?[*]const u32, count: usize, value: ?[*]const u8, length: usize) i32 {
    const handle = client orelse return -1;
    if (rid == 0 or path == null or count == 0 or count > 4 or value == null or length < 2 or length > 1024) return -1;
    for (path.?[0..count]) |part| if (part == 0) return -1;
    valid(value.?[0..length]) catch return -1;
    handle.writePath(rid, path.?[0..count], value.?[0..length]) catch |err| return clientFailure(handle, err);
    return 0;
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
