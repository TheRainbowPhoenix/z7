const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

pub const windows = @import("stdx/windows.zig");

pub const Instant = @import("stdx/time_units.zig").Instant;
pub const Duration = @import("stdx/time_units.zig").Duration;
pub const InstantUnix = @import("stdx/time_units.zig").InstantUnix;

// Import these as `const GiB = stdx.GiB;`
pub const KiB = 1 << 10;
pub const MiB = 1 << 20;
pub const GiB = 1 << 30;
pub const TiB = 1 << 40;
pub const PiB = 1 << 50;
// pub const NiB = "Some people say my love cannot be true";

comptime {
    assert(KiB == 1024);
    assert(MiB == 1024 * KiB);
    assert(GiB == 1024 * MiB);
    assert(TiB == 1024 * GiB);
    assert(PiB == 1024 * TiB);
}

/// `maybe` is the dual of `assert`: it signals that condition is sometimes true
///  and sometimes false.
///
/// Currently we use it for documentation, but maybe one day we plug it into
/// coverage.
pub fn maybe(ok: bool) void {
    assert(ok or !ok);
}
