const std = @import("std");
pub const max_classes = 32;
pub const max_depth = 8;
pub const Class = extern struct { id: u32, base: u32, flags: u32, composition: u32 };
pub const Registry = struct {
    entries: [max_classes]Class = @splat(.{ .id = 0, .base = 0, .flags = 0, .composition = 0 }),
    pub fn find(self: *const Registry, id: u32) ?Class {
        for (self.entries) |entry| if (id != 0 and entry.id == id) return entry;
        return null;
    }
    pub fn register(self: *Registry, entry: Class) !void {
        if (entry.id == 0 or entry.id == entry.base or self.find(entry.id) != null) return error.InvalidClass;
        var current = entry.base;
        var depth: usize = 1;
        while (current != 0) {
            if (depth == max_depth) return error.DepthLimit;
            current = (self.find(current) orelse return error.ClassNotRegistered).base;
            depth += 1;
        }
        for (&self.entries) |*slot| if (slot.id == 0) {
            slot.* = entry;
            return;
        };
        return error.ClassLimit;
    }
    pub fn instanceOf(self: *const Registry, actual: u32, wanted: u32) bool {
        var current = actual;
        for (0..max_depth) |_| {
            if (current == wanted and wanted != 0) return true;
            current = (self.find(current) orelse return false).base;
            if (current == 0) return false;
        }
        return false;
    }
};
