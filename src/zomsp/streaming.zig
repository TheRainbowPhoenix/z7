const std = @import("std");
const application = @import("application.zig");
const allocator = std.heap.page_allocator;
pub const max_bytes = 16 * 1024 * 1024;
pub const max_chunk = 128 * 1024;
pub const Validator = *const fn (?*anyopaque, *const application.Invocation, [*:0]const u8, u64) callconv(.c) u64;

pub const Store = struct {
    rid: u32,
    aid: u32,
    length: u32,
    directory: []u8,
    validator: Validator,
    user: ?*anyopaque,
    mutex: std.Thread.Mutex = .{},
    committed: ?[:0]u8 = null,
    generation: u64 = 0,
    retired: [16]?[:0]u8 = @splat(null),

    pub fn init(rid: u32, aid: u32, length: u32, directory: []const u8, validator: Validator, user: ?*anyopaque) !Store {
        if (rid == 0 or aid == 0 or length == 0 or length > max_bytes) return error.InvalidValue;
        return .{ .rid = rid, .aid = aid, .length = length, .directory = try std.fs.cwd().realpathAlloc(allocator, directory), .validator = validator, .user = user };
    }
    pub fn deinit(self: *Store) void {
        if (self.committed) |current| {
            std.fs.deleteFileAbsolute(current) catch {};
            allocator.free(current);
        }
        for (self.retired) |entry| if (entry) |retired| {
            std.fs.deleteFileAbsolute(retired) catch {};
            allocator.free(retired);
        };
        allocator.free(self.directory);
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
    file: std.fs.File,
    path: [:0]u8,
    received: u32 = 0,
    poisoned: bool = false,
    owns_path: bool = true,
    generation: u64,

    pub fn open(store: *Store) !Upload {
        var nonce: [16]u8 = undefined;
        std.crypto.random.bytes(&nonce);
        const name = try std.fmt.allocPrint(allocator, ".zomsp-{s}.blob", .{std.fmt.fmtSliceHexLower(&nonce)});
        defer allocator.free(name);
        const joined = try std.fs.path.join(allocator, &.{ store.directory, name });
        defer allocator.free(joined);
        const path = try allocator.dupeZ(u8, joined);
        errdefer allocator.free(path);
        const file = try std.fs.createFileAbsolute(path, .{ .read = true, .exclusive = true, .mode = 0o600 });
        return .{ .store = store, .file = file, .path = path, .generation = store.version() };
    }
    pub fn append(self: *Upload, offset: u32, bytes: []const u8) !void {
        if (self.poisoned or bytes.len == 0 or bytes.len > max_chunk or offset != self.received or bytes.len > self.store.length - self.received) return error.InvalidAddress;
        self.file.writeAll(bytes) catch |err| {
            self.poisoned = true;
            return err;
        };
        self.received += @intCast(bytes.len);
    }
    pub fn validate(self: *Upload, call: *const application.Invocation) !u64 {
        if (self.poisoned or self.received != self.store.length) return error.IncompleteUpload;
        try self.file.sync();
        return self.store.validator(self.store.user, call, self.path, self.received);
    }
    // Caller holds the source backend lock, after generation validation.
    pub fn publish(self: *Upload) !void {
        const store = self.store;
        store.mutex.lock();
        defer store.mutex.unlock();
        if (store.generation != self.generation) return error.TransactionConflict;
        if (store.generation == std.math.maxInt(u64)) return error.GenerationExhausted;
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
    pub fn close(self: *Upload) void {
        self.file.close();
        if (self.owns_path) {
            std.fs.deleteFileAbsolute(self.path) catch {};
            allocator.free(self.path);
        }
    }
};
