const std = @import("std");

test "z7 protocol" {
    _ = @import("z7/protocol.zig");
}

test "z7 constants" {
    _ = @import("z7/constants.zig");
}

test "common io" {
    _ = @import("common/io/test.zig");
}

test "z7 connection" {
    _ = @import("z7/connection.zig");
}
