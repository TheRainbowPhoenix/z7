const std = @import("std");
const application = @import("application.zig");
const allocator = std.heap.page_allocator;
pub const max_bytes = 16 * 1024 * 1024;
pub const max_chunk = 128 * 1024;
pub const Validator = *const fn (?*anyopaque, *const application.Invocation, [*:0]const u8, u64) callconv(.c) u64;

pub const Buffer = struct {
    references: std.atomic.Value(usize) = std.atomic.Value(usize).init(1),
    bytes: []u8,
    generation: u64 = 0,
    pub fn create(length: usize) !*Buffer {
        const buffer = try allocator.create(Buffer);
        errdefer allocator.destroy(buffer);
        buffer.* = .{ .bytes = try allocator.alloc(u8, length) };
        return buffer;
    }
    pub fn retain(self: *Buffer) void {
        const previous = self.references.fetchAdd(1, .monotonic);
        std.debug.assert(previous > 0 and previous < std.math.maxInt(usize));
    }
    pub fn release(self: *Buffer) void {
        const previous = self.references.fetchSub(1, .acq_rel);
        std.debug.assert(previous > 0);
        if (previous == 1) {
            allocator.free(self.bytes);
            allocator.destroy(self);
        }
    }
};
pub const MemoryValidator = *const fn (?*anyopaque, *const application.Invocation, [*]const u8, usize) callconv(.c) u64;
pub const Completion = *const fn (?*anyopaque, *const application.Invocation, *Buffer) callconv(.c) void;
pub const Delivery = struct { validate: ?MemoryValidator, complete: Completion };

pub const Store = struct {
    rid: u32,
    aid: u32,
    length: u32,
    directory: ?[]u8 = null,
    validator: ?Validator = null,
    delivery: ?Delivery = null,
    committed_buffer: ?*Buffer = null,
    user: ?*anyopaque,
    mutex: std.Thread.Mutex = .{},
    committed: ?[:0]u8 = null,
    generation: u64 = 0,
    retired: [16]?[:0]u8 = @splat(null),

    pub fn init(rid: u32, aid: u32, length: u32, directory: []const u8, validator: Validator, user: ?*anyopaque) !Store {
        if (rid == 0 or aid == 0 or length == 0 or length > max_bytes) return error.InvalidValue;
        return .{ .rid = rid, .aid = aid, .length = length, .directory = try std.fs.cwd().realpathAlloc(allocator, directory), .validator = validator, .user = user };
    }
    pub fn initMemory(rid: u32, aid: u32, length: u32, validate: ?MemoryValidator, complete: Completion, user: ?*anyopaque) !Store {
        if (rid == 0 or aid == 0 or length == 0 or length > max_bytes) return error.InvalidValue;
        return .{ .rid = rid, .aid = aid, .length = length, .delivery = .{ .validate = validate, .complete = complete }, .user = user };
    }
    pub fn deinit(self: *Store) void {
        if (self.committed_buffer) |buffer| buffer.release();
        if (self.committed) |current| {
            std.fs.deleteFileAbsolute(current) catch {};
            allocator.free(current);
        }
        for (self.retired) |entry| if (entry) |retired| {
            std.fs.deleteFileAbsolute(retired) catch {};
            allocator.free(retired);
        };
        if (self.directory) |directory| allocator.free(directory);
    }
    pub fn version(self: *Store) u64 {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.generation;
    }
    pub fn path(self: *Store, output: []u8) !usize {
        self.mutex.lock();
        defer self.mutex.unlock();
        const current = self.committed orelse return error.AttributeNotFound;
        if (output.len <= current.len) return error.BufferTooSmall;
        @memcpy(output[0..current.len], current);
        output[current.len] = 0;
        return current.len;
    }
};

pub const Upload = struct {
    store: *Store,
    file: ?std.fs.File = null,
    path: ?[:0]u8 = null,
    buffer: ?*Buffer = null,
    received: u32 = 0,
    poisoned: bool = false,
    owns_path: bool = true,
    generation: u64,

    pub fn open(store: *Store) !Upload {
        if (store.delivery != null) return .{ .store = store, .buffer = try Buffer.create(store.length), .generation = store.version() };
        var nonce: [16]u8 = undefined;
        std.crypto.random.bytes(&nonce);
        const name = try std.fmt.allocPrint(allocator, ".zomsp-{s}.blob", .{std.fmt.fmtSliceHexLower(&nonce)});
        defer allocator.free(name);
        const joined = try std.fs.path.join(allocator, &.{ store.directory.?, name });
        defer allocator.free(joined);
        const path = try allocator.dupeZ(u8, joined);
        errdefer allocator.free(path);
        const file = try std.fs.createFileAbsolute(path, .{ .read = true, .exclusive = true, .mode = 0o600 });
        return .{ .store = store, .file = file, .path = path, .generation = store.version() };
    }
    pub fn append(self: *Upload, offset: u32, bytes: []const u8) !void {
        if (self.poisoned or bytes.len == 0 or bytes.len > max_chunk or offset != self.received or bytes.len > self.store.length - self.received) return error.InvalidAddress;
        if (self.buffer) |buffer| {
            @memcpy(buffer.bytes[self.received..][0..bytes.len], bytes);
        } else self.file.?.writeAll(bytes) catch |err| {
            self.poisoned = true;
            return err;
        };
        self.received += @intCast(bytes.len);
    }
    pub fn validate(self: *Upload, call: *const application.Invocation) !u64 {
        if (self.poisoned or self.received != self.store.length) return error.IncompleteUpload;
        if (self.buffer) |buffer| {
            if (self.store.delivery.?.validate) |validator| return validator(self.store.user, call, buffer.bytes.ptr, buffer.bytes.len);
            return 0;
        }
        try self.file.?.sync();
        return self.store.validator.?(self.store.user, call, self.path.?, self.received);
    }
    // Caller holds the source backend lock, after generation validation.
    pub fn publish(self: *Upload) !void {
        const store = self.store;
        store.mutex.lock();
        defer store.mutex.unlock();
        if (store.generation != self.generation) return error.TransactionConflict;
        if (store.generation == std.math.maxInt(u64)) return error.GenerationExhausted;
        if (self.buffer) |buffer| {
            buffer.generation = store.generation + 1;
            buffer.retain();
            if (store.committed_buffer) |old| old.release();
            store.committed_buffer = buffer;
            store.generation += 1;
            return;
        }
        for (&store.retired) |*entry| if (entry.*) |retired| {
            std.fs.deleteFileAbsolute(retired) catch continue;
            allocator.free(retired);
            entry.* = null;
        };
        if (store.committed) |old| {
            std.fs.deleteFileAbsolute(old) catch {
                // A Python mmap may keep the old file open on Windows. Publish the
                // new immutable file, retaining a bounded list until handles close.
                for (&store.retired) |*entry| {
                    if (entry.* != null) continue;
                    entry.* = old;
                    store.committed = self.path;
                    store.generation += 1;
                    self.owns_path = false;
                    return;
                }
                return error.ValueLimit;
            };
            allocator.free(old);
        }
        store.committed = self.path;
        store.generation += 1;
        self.owns_path = false;
    }
    pub fn notify(self: *Upload, call: *const application.Invocation) void {
        if (self.buffer) |buffer| self.store.delivery.?.complete(self.store.user, call, buffer);
    }
    pub fn close(self: *Upload) void {
        if (self.buffer) |buffer| buffer.release();
        if (self.file) |file| file.close();
        if (self.owns_path) if (self.path) |path| {
            std.fs.deleteFileAbsolute(path) catch {};
            allocator.free(path);
        };
    }
};
