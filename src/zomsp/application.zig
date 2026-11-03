const std = @import("std");

pub const max_methods = 32;
pub const invoke_bytes = 8192;
pub const Invocation = extern struct { target: u32, method: u32, session: u32, client: u32, role: u32 };
pub const Callback = *const fn (?*anyopaque, *const Invocation, [*]const u8, usize, [*]u8, usize, *usize) callconv(.c) u64;
pub const ActivationCallback = *const fn (?*anyopaque, *const Invocation, [*]const u8, usize, [*]const u8, usize) callconv(.c) u64;
pub const Activator = struct { callback: ActivationCallback, user: ?*anyopaque };
pub const CreateValidator = *const fn (?*anyopaque, *const Invocation, [*]const u8, usize) callconv(.c) u64;
pub const Created = *const fn (?*anyopaque, *const Invocation, u32, [*]const u8, usize) callconv(.c) void;
pub const Factory = struct { class: u32, validate: ?CreateValidator, created: Created, user: ?*anyopaque };
pub const Method = struct {
    target: u32,
    id: u32,
    callback: Callback,
    user: ?*anyopaque,
};

pub const Registry = struct {
    entries: [max_methods]?Method = @splat(null),

    pub fn register(self: *Registry, method: Method) !void {
        if (method.target == 0 or method.id == 0) return error.InvalidMethod;
        if (self.find(method.target, method.id) != null) return error.MethodExists;
        for (&self.entries) |*entry| {
            if (entry.* != null) continue;
            entry.* = method;
            return;
        }
        return error.MethodLimit;
    }

    pub fn find(self: *const Registry, target: u32, id: u32) ?Method {
        for (self.entries) |entry| if (entry) |method| {
            if (method.target == target and method.id == id) return method;
        };
        return null;
    }
};

test "method registry is bounded and rejects replacement" {
    const Handler = struct {
        fn invoke(_: ?*anyopaque, _: *const Invocation, _: [*]const u8, _: usize, _: [*]u8, _: usize, _: *usize) callconv(.c) u64 {
            return 0;
        }
    };
    var registry: Registry = .{};
    for (0..max_methods) |index| try registry.register(.{ .target = 1, .id = @intCast(index + 1), .callback = Handler.invoke, .user = null });
    try std.testing.expectError(error.MethodExists, registry.register(.{ .target = 1, .id = 1, .callback = Handler.invoke, .user = null }));
    try std.testing.expectError(error.MethodLimit, registry.register(.{ .target = 1, .id = 100, .callback = Handler.invoke, .user = null }));
    try std.testing.expect(registry.find(2, 1) == null);
}
