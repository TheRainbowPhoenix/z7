//! TigerBeetle standard Pseudo Random Number generator.
//!
//! Import qualified and use `prng` for field/variable name:
//!
//! ```
//! prng: *stdx.PRNG
//! ```
//!
//! The implementation matches Zig's `std.Random.DefaultPrng`, but we avoid using that directly in
//! order to:
//! - remove floating point from the API, to ensure determinism
//! - isolate our test suite from stdlib API churn
//! - isolate TigerBeetle from the churn in the PRNG algorithms
//! - simplify and extend the API
//! - remove dynamic-dispatch indirection (a minor bonus).

const std = @import("std");
const stdx = @import("../stdx.zig");
const assert = std.debug.assert;
const math = std.math;

s: [4]u64,

const PRNG = @This();

/// A less than one rational number, used to specify probabilities.
pub const Ratio = struct {
    // Invariant: numerator ≤ denominator.
    numerator: u64,
    // Invariant: denominator ≠ 0.
    denominator: u64,

    pub fn zero() Ratio {
        return .{ .numerator = 0, .denominator = 1 };
    }

    pub fn format(
        r: Ratio,
        comptime fmt: []const u8,
        options: std.fmt.FormatOptions,
        writer: anytype,
    ) !void {
        _ = fmt;
        _ = options;
        if (r.numerator == 0) return writer.print("0", .{});
        return writer.print("{d}/{d}", .{ r.numerator, r.denominator });
    }

    pub fn parse_flag_value(
        string: []const u8,
        static_diagnostic: *?[]const u8,
    ) error{InvalidFlagValue}!Ratio {
        assert(string.len > 0);
        if (string.len == 1 and string[0] == '0') return .zero();

        const string_numerator, const string_denominator = stdx.cut(string, "/") orelse {
            static_diagnostic.* = "expected 'a/b' ratio, but found:";
            return error.InvalidFlagValue;
        };

        const numerator = std.fmt.parseInt(u64, string_numerator, 10) catch {
            static_diagnostic.* = "invalid numerator:";
            return error.InvalidFlagValue;
        };
        const denominator = std.fmt.parseInt(u64, string_denominator, 10) catch {
            static_diagnostic.* = "invalid denominator:";
            return error.InvalidFlagValue;
        };
        if (denominator == 0) {
            static_diagnostic.* = "denominator is zero:";
            return error.InvalidFlagValue;
        }
        if (numerator > denominator) {
            static_diagnostic.* = "ratio greater than 1:";
            return error.InvalidFlagValue;
        }
        return ratio(numerator, denominator);
    }
};

test "Ratio.parse_flag_value" {
    // try stdx.parse_flag_value_fuzz(Ratio, Ratio.parse_flag_value, .{
    //     .ok = &.{
    //         .{ "0", .zero() },
    //         .{ "3/4", ratio(3, 4) },
    //         .{ "10/100", ratio(10, 100) },
    //     },
    //     .err = &.{
    //         .{ "1/0", "denominator is zero" },
    //         .{ "0/0", "denominator is zero" },
    //         .{ "3", "expected 'a/b' ratio, but found" },
    //         .{ "π/4", "invalid numerator" },
    //         .{ "3/i", "invalid denominator" },
    //         .{ "4/3", "ratio greater than 1" },
    //     },
    // });
}

/// Canonical constructor for Ratio. Import as `const ratio = stdx.PRNG.ratio`.
pub fn ratio(numerator: u64, denominator: u64) Ratio {
    assert(denominator > 0);
    assert(numerator <= denominator);
    return .{ .numerator = numerator, .denominator = denominator };
}

pub fn from_seed(seed: u64) PRNG {
    var s = seed;
    return .{ .s = .{
        split_mix_64(&s),
        split_mix_64(&s),
        split_mix_64(&s),
        split_mix_64(&s),
    } };
}

pub fn from_seed_testing() PRNG {
    comptime assert(@import("builtin").is_test);
    return .from_seed(92); // Fixed seed for testing
}

fn split_mix_64(s: *u64) u64 {
    s.* +%= 0x9e3779b97f4a7c15;

    var z = s.*;
    z = (z ^ (z >> 30)) *% 0xbf58476d1ce4e5b9;
    z = (z ^ (z >> 27)) *% 0x94d049bb133111eb;
    return z ^ (z >> 31);
}

fn next(prng: *PRNG) u64 {
    const r = std.math.rotl(u64, prng.s[0] +% prng.s[3], 23) +% prng.s[0];

    const t = prng.s[1] << 17;

    prng.s[2] ^= prng.s[0];
    prng.s[3] ^= prng.s[1];
    prng.s[1] ^= prng.s[2];
    prng.s[0] ^= prng.s[3];

    prng.s[2] ^= t;

    prng.s[3] = math.rotl(u64, prng.s[3], 45);

    return r;
}

pub fn fill(prng: *PRNG, target: []u8) void {
    var i: usize = 0;
    const aligned_len = target.len - (target.len & 7);

    // Complete 8 byte segments.
    while (i < aligned_len) : (i += 8) {
        var n = prng.next();
        comptime var j: usize = 0;
        inline while (j < 8) : (j += 1) {
            target[i + j] = @as(u8, @truncate(n));
            n >>= 8;
        }
    }

    // Remaining (cuts the stream).
    if (i != target.len) {
        var n = prng.next();
        while (i < target.len) : (i += 1) {
            target[i] = @as(u8, @truncate(n));
            n >>= 8;
        }
    }
}

/// Generate an unbiased, uniformly distributed integer r such that 0 ≤ r ≤ max.
///
/// No biased version is provided --- while biased generation is simpler&faster, the bias can be
/// quite high depending on max!
pub fn int_inclusive(prng: *PRNG, Int: anytype, max: Int) Int {
    comptime assert(@typeInfo(Int).int.signedness == .unsigned);
    if (max == std.math.maxInt(Int)) {
        return prng.int(Int);
    }

    comptime assert(@typeInfo(Int).int.signedness == .unsigned);
    const bits = @typeInfo(Int).int.bits;
    const less_than = max + 1;

    // adapted from:
    //   http://www.pcg-random.org/posts/bounded-rands.html
    //   "Lemire's (with an extra tweak from Zig)"
    var x = prng.int(Int);
    var m = math.mulWide(Int, x, less_than);
    var l: Int = @truncate(m);
    if (l < less_than) {
        var t = -%less_than;

        if (t >= less_than) {
            t -= less_than;
            if (t >= less_than) {
                t %= less_than;
            }
        }
        while (l < t) {
            x = prng.int(Int);
            m = math.mulWide(Int, x, less_than);
            l = @truncate(m);
        }
    }
    return @intCast(m >> bits);
}

// Deliberately excluded from the API to normalize everything to closed ranges.
// Somewhat surprisingly, closed ranges are more convenient for generating random numbers:
// - passing zero is not a subtle error
// - passing intMax allows generating any integer
// - at the call-site, inclusive is usually somewhat more obvious.
pub const int_exclusive = @compileError("intentionally not implemented");

/// Given a slice, generates a random valid index for the slice.
pub fn index(prng: *PRNG, slice: anytype) usize {
    assert(slice.len > 0);
    return prng.int_inclusive(usize, slice.len - 1);
}

/// Generates a uniform, unbiased integer r such that max ≤ r ≤ max.
pub fn range_inclusive(prng: *PRNG, Int: type, min: Int, max: Int) Int {
    comptime assert(@typeInfo(Int).int.signedness == .unsigned);
    assert(min <= max);
    return min + prng.int_inclusive(Int, max - min);
}

/// Returns a uniformly distributed integer of type T.
///
/// That is, fills @sizeOf(T) bytes with random bits.
pub fn int(prng: *PRNG, Int: type) Int {
    comptime assert(@typeInfo(Int).int.signedness == .unsigned);
    if (Int == u64) return prng.next();
    if (@sizeOf(Int) < @sizeOf(u64)) return @truncate(prng.next());
    var result: Int = undefined;
    prng.fill(std.mem.asBytes(&result));
    return result;
}

/// Returns true with probability 0.5.
pub fn boolean(prng: *PRNG) bool {
    return prng.next() & 1 == 1;
}

/// Returns true with the given rational probability.
pub fn chance(prng: *PRNG, probability: Ratio) bool {
    assert(probability.denominator > 0);
    assert(probability.numerator <= probability.denominator);
    return prng.int_inclusive(u64, probability.denominator - 1) < probability.numerator;
}

pub fn error_uniform(prng: *PRNG, Error: type) Error {
    const errors = @typeInfo(Error).error_set.?;
    return switch (prng.index(errors)) {
        inline 0...(errors.len - 1) => |i| @field(Error, errors[i].name),
        else => unreachable,
    };
}
