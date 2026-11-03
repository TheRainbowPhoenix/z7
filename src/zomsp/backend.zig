const std = @import("std");
const builtin = @import("builtin");
const application = @import("application.zig");
pub const streaming = @import("streaming.zig");

pub const max_objects = 128;
pub const max_values = 512;
pub const max_value_bytes = 1024;
pub const Header = extern struct {
    magic: [8]u8,
    version: u32,
    size: u32,
    generation: u64,
    object_count: u32,
    value_count: u32,
    reserved: [32]u8,
};
pub const Object = extern struct { rid: u32, parent: u32, class: u32, flags: u32, generation: u64 };
pub const Entry = extern struct { rid: u32, aid: u32, length: u32, flags: u32, generation: u64, value: [max_value_bytes]u8 };
pub const Layout = extern struct { header: Header, objects: [max_objects]Object, values: [max_values]Entry };
pub const Update = struct { rid: u32, aid: u32, value: []const u8, generation: ?u64 = null };
pub const Snapshot = struct { value: []const u8, generation: u64, flags: u32 };
pub const CreateNode = struct { temporary: u32, parent: u32, class: u32, first: usize, count: usize };
pub const InitialValue = struct { aid: u32, value: []const u8 };
pub fn sameType(first: []const u8, second: []const u8) bool {
    if (first.len < 2 or second.len < 2 or !std.mem.eql(u8, first[0..2], second[0..2])) return false;
    if (first[0] == 0 and first[1] == 0x17) return first.len >= 6 and second.len >= 6 and std.mem.eql(u8, first[2..6], second[2..6]);
    return true;
}

comptime {
    if (builtin.cpu.arch.endian() != .little) @compileError("shared-memory ABI requires little endian");
    std.debug.assert(@sizeOf(Header) == 64 and @sizeOf(Object) == 24 and @sizeOf(Entry) == 1048);
}

const windows = std.os.windows;
extern "kernel32" fn CreateFileMappingW(windows.HANDLE, ?*anyopaque, u32, u32, u32, ?[*:0]const u16) callconv(windows.WINAPI) ?windows.HANDLE;
extern "kernel32" fn MapViewOfFile(windows.HANDLE, u32, u32, u32, usize) callconv(windows.WINAPI) ?*anyopaque;
extern "kernel32" fn UnmapViewOfFile(*anyopaque) callconv(windows.WINAPI) i32;

pub const Backend = struct {
    file: std.fs.File,
    bytes: []align(std.heap.page_size_min) u8,
    data: *Layout,
    mutex: std.Thread.Mutex = .{},
    methods: application.Registry = .{},
    transactions_enabled: bool = false,
    activator: ?application.Activator = null,
    blob: ?*streaming.Store = null,
    authentication: @import("authentication.zig").Policy = .{},
    private: bool = false,
    events: ?*@import("events.zig").Store = null,
    factories: [16]?application.Factory = @splat(null),

    pub fn open(path: []const u8, create: bool) !Backend {
        const file = std.fs.cwd().openFile(path, .{ .mode = .read_write }) catch |err| blk: {
            if (err != error.FileNotFound or !create) return err;
            break :blk try std.fs.cwd().createFile(path, .{ .read = true, .truncate = false });
        };
        errdefer file.close();
        try file.lock(.exclusive);
        defer file.unlock();
        const size = try file.getEndPos();
        const initialize = size == 0 and create;
        if (initialize) try file.setEndPos(@sizeOf(Layout)) else if (size != @sizeOf(Layout)) return error.InvalidLayout;
        const bytes: []align(std.heap.page_size_min) u8 = if (builtin.os.tag == .windows) blk: {
            const mapping = CreateFileMappingW(file.handle, null, windows.PAGE_READWRITE, 0, @sizeOf(Layout), null) orelse return error.MappingFailed;
            defer windows.CloseHandle(mapping);
            const ptr = MapViewOfFile(mapping, 0xf001f, 0, 0, @sizeOf(Layout)) orelse return error.MappingFailed;
            break :blk @as([*]align(std.heap.page_size_min) u8, @ptrCast(@alignCast(ptr)))[0..@sizeOf(Layout)];
        } else try std.posix.mmap(null, @sizeOf(Layout), std.posix.PROT.READ | std.posix.PROT.WRITE, .{ .TYPE = .SHARED }, file.handle, 0);
        errdefer unmap(bytes);
        const data: *Layout = @ptrCast(bytes.ptr);
        if (initialize) {
            @memset(bytes, 0);
            data.header.magic = "zOMSp001".*;
            data.header.version = 1;
            data.header.size = @sizeOf(Layout);
        }
        var result = Backend{ .file = file, .bytes = bytes, .data = data };
        try result.validate();
        return result;
    }

    fn unmap(bytes: []align(std.heap.page_size_min) u8) void {
        if (builtin.os.tag == .windows) {
            _ = UnmapViewOfFile(bytes.ptr);
        } else std.posix.munmap(bytes);
    }
    pub fn close(self: *Backend) void {
        std.debug.assert(!self.private);
        if (self.events) |events| std.heap.page_allocator.destroy(events);
        self.authentication.configure(&.{}) catch unreachable;
        unmap(self.bytes);
        self.file.close();
    }
    fn validate(self: *Backend) !void {
        const h = &self.data.header;
        if (!std.mem.eql(u8, &h.magic, "zOMSp001") or h.version != 1 or h.size != @sizeOf(Layout) or h.object_count > max_objects or h.value_count > max_values) return error.InvalidLayout;
        var objects: usize = 0;
        var values: usize = 0;
        for (&self.data.objects) |*object| if (object.rid != 0) {
            objects += 1;
        };
        for (&self.data.values) |*entry| if (entry.rid != 0) {
            values += 1;
        };
        if (objects != h.object_count or values != h.value_count) return error.InvalidLayout;
    }
    fn lock(self: *Backend) !void {
        self.mutex.lock();
        errdefer self.mutex.unlock();
        if (self.private) {
            try self.validate();
            return;
        }
        if (builtin.os.tag == .windows) {
            var status: windows.IO_STATUS_BLOCK = undefined;
            const offset: windows.LARGE_INTEGER = 0;
            const length: windows.LARGE_INTEGER = 1;
            windows.LockFile(self.file.handle, null, null, null, &status, &offset, &length, null, windows.TRUE, windows.TRUE) catch |err| switch (err) {
                error.WouldBlock => return error.StoreBusy,
                else => return err,
            };
        } else if (!try self.file.tryLock(.exclusive)) return error.StoreBusy;
        errdefer self.file.unlock();
        try self.validate();
    }
    fn unlock(self: *Backend) void {
        if (!self.private) self.file.unlock();
        self.mutex.unlock();
    }
    fn findObject(self: *Backend, rid: u32) ?*Object {
        for (&self.data.objects) |*object| if (object.rid == rid and rid != 0) return object;
        return null;
    }
    pub fn info(self: *Backend, rid: u32) !Object {
        try self.lock();
        defer self.unlock();
        return (self.findObject(rid) orelse return error.ObjectNotFound).*;
    }
    pub fn snapshotLayout(self: *Backend, allocator: std.mem.Allocator) !*Layout {
        const copy = try allocator.create(Layout);
        errdefer allocator.destroy(copy);
        try self.lock();
        defer self.unlock();
        copy.* = self.data.*;
        return copy;
    }
    pub fn remove(self: *Backend, rid: u32) !void {
        return self.removeObject(rid, false);
    }
    pub fn removeApplication(self: *Backend, rid: u32) !void {
        return self.removeObject(rid, true);
    }
    fn removeObject(self: *Backend, rid: u32, protect_templates: bool) !void {
        try self.lock();
        defer self.unlock();
        if (self.findObject(rid) == null) return error.ObjectNotFound;
        const generation = try self.next();
        for (&self.data.values) |*entry| {
            if (entry.rid == 0 or entry.flags != 2) continue;
            if (entry.length < 3 or entry.length > 67 or entry.value[0] != 0x10 or entry.value[1] != 0x12 or entry.value[2] > 16 or entry.length != 3 + @as(u32, entry.value[2]) * 4) return error.InvalidLayout;
        }
        var removed: [max_objects]u32 = @splat(0);
        removed[0] = rid;
        var count: usize = 1;
        var scan: usize = 0;
        while (scan < count) : (scan += 1) {
            for (&self.data.objects) |*object| {
                if (object.rid == 0 or object.parent != removed[scan]) continue;
                for (removed[0..count]) |previous| if (previous == object.rid) return error.InvalidLayout;
                if (count == removed.len) return error.InvalidLayout;
                removed[count] = object.rid;
                count += 1;
            }
        }
        if (protect_templates) for (removed[0..count]) |id| {
            if ((self.findObject(id) orelse return error.InvalidLayout).flags != 0) return error.ReadOnly;
        };
        for (removed[0..count]) |id| {
            const object = self.findObject(id) orelse unreachable;
            object.* = std.mem.zeroes(Object);
            self.data.header.object_count -= 1;
            for (&self.data.values) |*entry| {
                if (entry.rid != id) continue;
                entry.* = std.mem.zeroes(Entry);
                self.data.header.value_count -= 1;
            }
        }
        for (&self.data.values) |*entry| {
            if (entry.rid == 0 or entry.flags != 2) continue;
            const original = entry.value[2];
            var kept: u8 = 0;
            for (0..original) |index| {
                const target = std.mem.readInt(u32, entry.value[3 + index * 4 ..][0..4], .big);
                if (std.mem.indexOfScalar(u32, removed[0..count], target) != null) continue;
                std.mem.writeInt(u32, entry.value[3 + @as(usize, kept) * 4 ..][0..4], target, .big);
                kept += 1;
            }
            if (kept != original) {
                entry.value[2] = kept;
                entry.length = 3 + @as(u32, kept) * 4;
                @memset(entry.value[entry.length..], 0);
                entry.generation = generation;
            }
        }
        self.data.header.generation = generation;
    }
    fn findValue(self: *Backend, rid: u32, aid: u32) ?*Entry {
        for (&self.data.values) |*entry| if (entry.rid == rid and entry.aid == aid and rid != 0) return entry;
        return null;
    }
    fn next(self: *Backend) !u64 {
        if (self.data.header.generation == std.math.maxInt(u64)) return error.GenerationExhausted;
        return self.data.header.generation + 1;
    }
    pub fn addObject(self: *Backend, rid: u32, parent: u32, class: u32) !void {
        if (rid == 0 or class == 0 or (rid >= 0x70001000 and rid <= 0x70001fff)) return error.InvalidObject;
        try self.lock();
        defer self.unlock();
        if (self.findObject(rid) != null) return error.ObjectExists;
        if (parent != 0 and self.findObject(parent) == null) return error.ObjectNotFound;
        const generation = try self.next();
        for (&self.data.objects) |*object| {
            if (object.rid != 0) continue;
            object.* = .{ .rid = rid, .parent = parent, .class = class, .flags = 0, .generation = generation };
            self.data.header.object_count += 1;
            self.data.header.generation = generation;
            return;
        }
        return error.ObjectLimit;
    }
    pub fn makeTemplate(self: *Backend, rid: u32) !void {
        try self.lock();
        defer self.unlock();
        const object = self.findObject(rid) orelse return error.ObjectNotFound;
        const generation = try self.next();
        object.flags = 1;
        object.generation = generation;
        self.data.header.generation = generation;
    }
    pub fn createBatch(self: *Backend, nodes: []const CreateNode, initial: []const InitialValue, assigned: []u32, immutable: bool) !void {
        if (nodes.len == 0 or nodes.len > 8 or assigned.len != nodes.len or initial.len > 32) return error.ObjectLimit;
        try self.lock();
        defer self.unlock();
        const generation = try self.next();
        var object_slots: [8]*Object = undefined;
        var count: usize = 0;
        for (&self.data.objects) |*object| {
            if (object.rid != 0) continue;
            object_slots[count] = object;
            count += 1;
            if (count == nodes.len) break;
        }
        if (count != nodes.len) return error.ObjectLimit;
        var next_rid = std.mem.readInt(u32, self.data.header.reserved[0..4], .little);
        if (next_rid == 0) next_rid = 0x60000000;
        if (next_rid < 0x60000000 or next_rid > 0x70000000) return error.InvalidLayout;
        for (assigned) |*rid| {
            while (next_rid < 0x70000000 and self.findObject(next_rid) != null) next_rid += 1;
            if (next_rid == 0x70000000) return error.ObjectLimit;
            rid.* = next_rid;
            next_rid += 1;
        }
        var prototypes: [8]u32 = undefined;
        var parents: [8]u32 = undefined;
        var needed: usize = 0;
        for (nodes, 0..) |node, index| {
            if (node.temporary == 0 or node.class == 0 or node.first > initial.len or node.count > initial.len - node.first) return error.InvalidObject;
            for (nodes[0..index]) |previous| if (previous.temporary == node.temporary) return error.InvalidObject;
            const prototype = for (&self.data.objects) |*object| {
                if (object.class == node.class and object.flags == 1 and object.rid != 0) break object.rid;
            } else return error.ClassNotRegistered;
            prototypes[index] = prototype;
            parents[index] = node.parent;
            var nested = false;
            for (nodes[0..index], 0..) |previous, parent_index| {
                if (previous.temporary == node.parent) {
                    parents[index] = assigned[parent_index];
                    nested = true;
                    break;
                }
            }
            if (!nested) {
                const parent = self.findObject(node.parent) orelse return error.ObjectNotFound;
                if (parent.flags != 0) return error.ReadOnly;
            }
            for (&self.data.values) |*entry| if (entry.rid == prototype) {
                if (entry.length < 2 or entry.length > max_value_bytes or entry.flags > 1) return error.InvalidLayout;
                needed += 1;
            };
            const values = initial[node.first..][0..node.count];
            for (values, 0..) |value, value_index| {
                if (value.value.len < 2 or value.value.len > max_value_bytes) return error.InvalidValue;
                for (values[0..value_index]) |previous| if (previous.aid == value.aid) return error.DuplicateAttribute;
                const entry = self.findValue(prototype, value.aid) orelse return error.AttributeNotFound;
                if (entry.flags != 1 and !immutable) return error.ReadOnly;
                if (!sameType(entry.value[0..entry.length], value.value)) return error.TypeMismatch;
            }
        }
        if (needed > max_values - self.data.header.value_count) return error.ValueLimit;
        for (nodes, 0..) |node, index| {
            object_slots[index].* = .{ .rid = assigned[index], .parent = parents[index], .class = node.class, .flags = 0, .generation = generation };
            self.data.header.object_count += 1;
            for (&self.data.values) |*source| {
                if (source.rid != prototypes[index]) continue;
                const entry = for (&self.data.values) |*candidate| {
                    if (candidate.rid == 0) break candidate;
                } else unreachable;
                entry.* = source.*;
                entry.rid = assigned[index];
                entry.generation = generation;
                if (immutable) entry.flags = 0;
                for (initial[node.first..][0..node.count]) |value| if (value.aid == source.aid) {
                    entry.length = @intCast(value.value.len);
                    @memcpy(entry.value[0..value.value.len], value.value);
                    @memset(entry.value[value.value.len..], 0);
                };
                self.data.header.value_count += 1;
            }
        }
        self.data.header.generation = generation;
        std.mem.writeInt(u32, self.data.header.reserved[0..4], next_rid, .little);
    }
    pub fn put(self: *Backend, rid: u32, aid: u32, value: []const u8, writable: bool) !void {
        return self.putValue(rid, aid, value, @intFromBool(writable));
    }
    pub fn link(self: *Backend, rid: u32, aid: u32, targets: []const u32) !void {
        if (targets.len > 16) return error.ValueLimit;
        var encoded: [67]u8 = undefined;
        encoded[0..3].* = .{ 0x10, 0x12, @intCast(targets.len) };
        for (targets, 0..) |target, index| std.mem.writeInt(u32, encoded[3 + index * 4 ..][0..4], target, .big);
        return self.putValue(rid, aid, encoded[0 .. 3 + targets.len * 4], 2);
    }
    fn putValue(self: *Backend, rid: u32, aid: u32, value: []const u8, flags: u32) !void {
        if (aid == 0 or value.len < 2 or value.len > max_value_bytes) return error.InvalidValue;
        try self.lock();
        defer self.unlock();
        if (self.findObject(rid) == null) return error.ObjectNotFound;
        if (flags == 2) {
            for (0..value[2]) |index| {
                const target = std.mem.readInt(u32, value[3 + index * 4 ..][0..4], .big);
                if (self.findObject(target) == null) return error.ObjectNotFound;
                for (0..index) |previous| if (target == std.mem.readInt(u32, value[3 + previous * 4 ..][0..4], .big)) return error.DuplicateAttribute;
            }
        }
        const generation = try self.next();
        var found = self.findValue(rid, aid);
        const fresh = found == null;
        if (fresh) for (&self.data.values) |*entry| {
            if (entry.rid == 0) {
                found = entry;
                break;
            }
        };
        const entry = found orelse return error.ValueLimit;
        entry.rid = rid;
        entry.aid = aid;
        entry.length = @intCast(value.len);
        entry.flags = flags;
        entry.generation = generation;
        @memcpy(entry.value[0..value.len], value);
        @memset(entry.value[value.len..], 0);
        if (fresh) self.data.header.value_count += 1;
        self.data.header.generation = generation;
    }
    pub fn get(self: *Backend, rid: u32, aid: u32, output: []u8) ![]const u8 {
        return (try self.snapshot(rid, aid, output)).value;
    }
    pub fn snapshot(self: *Backend, rid: u32, aid: u32, output: []u8) !Snapshot {
        try self.lock();
        defer self.unlock();
        if (self.findObject(rid) == null) return error.ObjectNotFound;
        const entry = self.findValue(rid, aid) orelse return error.AttributeNotFound;
        if (entry.length < 2 or entry.length > max_value_bytes or entry.flags > 2) return error.InvalidLayout;
        if (entry.length > output.len) return error.BufferTooSmall;
        @memcpy(output[0..entry.length], entry.value[0..entry.length]);
        return .{ .value = output[0..entry.length], .generation = entry.generation, .flags = entry.flags };
    }
    pub fn write(self: *Backend, updates: []const Update) !void {
        if (updates.len == 0 or updates.len > 16) return error.ValueLimit;
        try self.lock();
        defer self.unlock();
        const generation = try self.next();
        var entries: [16]*Entry = undefined;
        for (updates, 0..) |update, index| {
            if (self.blob) |blob| if (update.rid == blob.rid and update.aid == blob.aid) return error.UnsupportedAddress;
            if (update.value.len < 2 or update.value.len > max_value_bytes) return error.InvalidValue;
            const object = self.findObject(update.rid) orelse return error.ObjectNotFound;
            if (object.flags != 0) return error.ReadOnly;
            const entry = self.findValue(update.rid, update.aid) orelse return error.AttributeNotFound;
            if (entry.length < 2 or entry.length > max_value_bytes or entry.flags > 1) return error.InvalidLayout;
            if (entry.flags != 1) return error.ReadOnly;
            if (update.generation) |expected| if (entry.generation != expected) return error.StoreBusy;
            if (!sameType(update.value, entry.value[0..entry.length])) return error.TypeMismatch;
            for (updates[0..index]) |previous| if (previous.rid == update.rid and previous.aid == update.aid) return error.DuplicateAttribute;
            entries[index] = entry;
        }
        for (updates, entries[0..updates.len]) |update, entry| {
            entry.length = @intCast(update.value.len);
            @memcpy(entry.value[0..update.value.len], update.value);
            @memset(entry.value[update.value.len..], 0);
            entry.generation = generation;
        }
        self.data.header.generation = generation;
    }
};

pub const Transaction = struct {
    source: *Backend,
    shadow: Backend,
    generation: u64,
    directives: [max_value_bytes]u8 = undefined,
    directives_length: usize = 0,
    upload: ?streaming.Upload = null,
    allocator: std.mem.Allocator,

    pub fn open(source: *Backend, allocator: std.mem.Allocator) !*Transaction {
        if (source.private or !source.transactions_enabled) return error.UnsupportedSequence;
        const transaction = try allocator.create(Transaction);
        errdefer allocator.destroy(transaction);
        const copy = try source.snapshotLayout(allocator);
        transaction.* = .{
            .source = source,
            .generation = copy.header.generation,
            .allocator = allocator,
            .shadow = .{ .file = source.file, .bytes = source.bytes, .data = copy, .private = true, .methods = source.methods, .blob = source.blob, .authentication = source.authentication, .factories = source.factories, .events = source.events },
        };
        return transaction;
    }

    pub fn commit(self: *Transaction) !void {
        try self.source.lock();
        defer self.source.unlock();
        if (self.upload != null and self.shadow.data.header.generation == self.generation) {
            const upload = &self.upload.?;
            const before = self.shadow.findObject(upload.store.rid) orelse return error.ObjectNotFound;
            const current = self.source.findObject(upload.store.rid) orelse return error.ObjectNotFound;
            if (current.generation != before.generation or current.flags != before.flags or current.class != before.class) return error.TransactionConflict;
            const generation = try self.source.next();
            try upload.publish();
            self.source.data.header.generation = generation;
            return;
        }
        if (self.source.data.header.generation != self.generation) return error.TransactionConflict;
        if (self.upload) |*upload| {
            if (self.generation == std.math.maxInt(u64)) return error.GenerationOverflow;
            self.shadow.data.header.generation = @max(self.shadow.data.header.generation, self.generation + 1);
            try upload.publish();
        }
        self.source.data.* = self.shadow.data.*;
    }

    pub fn close(self: *Transaction) void {
        if (self.upload) |*upload| upload.close();
        self.shadow.authentication.configure(&.{}) catch unreachable;
        self.allocator.destroy(self.shadow.data);
        self.allocator.destroy(self);
    }
};

test "mapped updates are atomic, typed, bounded and never wait for another process" {
    var temporary = std.testing.tmpDir(.{});
    defer temporary.cleanup();
    const directory = try temporary.dir.realpathAlloc(std.testing.allocator, ".");
    defer std.testing.allocator.free(directory);
    const path = try std.fs.path.join(std.testing.allocator, &.{ directory, "objects.shm" });
    defer std.testing.allocator.free(path);
    var store = try Backend.open(path, true);
    defer store.close();
    try store.addObject(201, 0, 200);
    try store.addObject(1000, 201, 255);
    try store.put(1000, 1, &.{ 0, 4, 1 }, true);
    try store.put(1000, 2, &.{ 0, 4, 2 }, false);
    const generation = store.data.header.generation;
    try std.testing.expectError(error.ReadOnly, store.write(&.{
        .{ .rid = 1000, .aid = 1, .value = &.{ 0, 4, 3 } },
        .{ .rid = 1000, .aid = 2, .value = &.{ 0, 4, 4 } },
    }));
    var bytes: [max_value_bytes]u8 = undefined;
    try std.testing.expectEqualSlices(u8, &.{ 0, 4, 1 }, try store.get(1000, 1, &bytes));
    try std.testing.expectEqual(generation, store.data.header.generation);
    try std.testing.expectError(error.TypeMismatch, store.write(&.{.{ .rid = 1000, .aid = 1, .value = &.{ 0, 2, 9 } }}));
    try store.write(&.{.{ .rid = 1000, .aid = 1, .value = &.{ 0, 4, 9 } }});
    var other = try Backend.open(path, false);
    defer other.close();
    try std.testing.expectEqualSlices(u8, &.{ 0, 4, 9 }, try other.get(1000, 1, &bytes));
    try store.file.lock(.exclusive);
    try std.testing.expectError(error.StoreBusy, other.get(1000, 1, &bytes));
    store.file.unlock();
    store.data.values[0].length = max_value_bytes + 1;
    try std.testing.expectError(error.InvalidLayout, other.get(1000, 1, &bytes));
}
