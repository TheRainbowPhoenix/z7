const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

pub const windows = @import("stdx/windows.zig");

pub const Instant = @import("stdx/time_units.zig").Instant;
pub const Duration = @import("stdx/time_units.zig").Duration;
pub const InstantUnix = @import("stdx/time_units.zig").InstantUnix;
pub const PRNG = @import("stdx/prng.zig");
pub const parse_flag_value_fuzz = @import("stdx/flags.zig").parse_flag_value_fuzz;

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

/// Splits the `haystack` around the first occurrence of `needle`, returning parts before and after.
pub fn cut(haystack: []const u8, needle: []const u8) ?struct { []const u8, []const u8 } {
    const index = std.mem.indexOf(u8, haystack, needle) orelse return null;
    return .{ haystack[0..index], haystack[index + needle.len ..] };
}

pub fn cut_prefix(haystack: []const u8, needle: []const u8) ?[]const u8 {
    if (std.mem.startsWith(u8, haystack, needle)) {
        return haystack[needle.len..];
    }
    return null;
}

pub fn parse_dirty_semver(dirty_release: []const u8) !std.SemanticVersion {
    const release = blk: {
        var last_valid_version_character_index: usize = 0;
        var dots_found: u8 = 0;
        for (dirty_release) |c| {
            if (c == '.') dots_found += 1;
            if (dots_found == 3) {
                break;
            }

            if (c == '.' or (c >= '0' and c <= '9')) {
                last_valid_version_character_index += 1;
                continue;
            }

            break;
        }

        break :blk dirty_release[0..last_valid_version_character_index];
    };

    return std.SemanticVersion.parse(release);
}

const log = std.log.scoped(.stdx);

pub fn unexpected_errno(label: []const u8, err: std.posix.system.E) std.posix.UnexpectedError {
    log.err("unexpected errno: {s}: code={d} name={?s}", .{
        label,
        @intFromEnum(err),
        std.enums.tagName(std.posix.system.E, err),
    });

    if (builtin.mode == .Debug) {
        std.debug.dumpCurrentStackTrace(null);
    }
    return error.Unexpected;
}

pub fn array_print(
    comptime n: usize,
    buffer: *[n]u8,
    comptime fmt: []const u8,
    args: anytype,
) []const u8 {
    const Args = @TypeOf(args);
    const ArgsStruct = @typeInfo(Args).@"struct";
    comptime assert(ArgsStruct.is_tuple);

    comptime {
        // We only support integer arguments for now to calculate worst-case buffer size.
        // If needed, extend to check types.
    }

    return std.fmt.bufPrint(buffer, fmt, args) catch |err| switch (err) {
        error.NoSpaceLeft => unreachable,
    };
}

const linux_bits = if (builtin.target.os.tag == .linux) struct {
    const fsblkcnt64_t = u64;
    const fsfilcnt64_t = u64;
    const fsword_t = i64;
    const fsid_t = u64;

    pub const TmpfsMagic = 0x01021994;

    pub const StatFs = extern struct {
        f_type: fsword_t,
        f_bsize: fsword_t,
        f_blocks: fsblkcnt64_t,
        f_bfree: fsblkcnt64_t,
        f_bavail: fsblkcnt64_t,
        f_files: fsfilcnt64_t,
        f_ffree: fsfilcnt64_t,
        f_fsid: fsid_t,
        f_namelen: fsword_t,
        f_frsize: fsword_t,
        f_flags: fsword_t,
        f_spare: [4]fsword_t,
    };

    pub fn fstatfs(fd: i32, statfs_buf: *StatFs) usize {
        return std.os.linux.syscall2(
            if (@hasField(std.os.linux.SYS, "fstatfs64")) .fstatfs64 else .fstatfs,
            @as(usize, @bitCast(@as(isize, fd))),
            @intFromPtr(statfs_buf),
        );
    }
} else struct {};

pub usingnamespace linux_bits;
