const std = @import("std");
const assert = std.debug.assert;
const stdx = @import("../stdx.zig");

/// Fuzz parse_flag_value function:
///
/// - Check that ok cases return a value.
/// - Check that err cases return an error with a properly formatted diagnostics.
/// - Check that the diagnostic contains specified substring
/// - Random tests with the input alphabet seeded from explicit cases.
/// - Random tests with uniform input.
pub fn parse_flag_value_fuzz(
    comptime T: type,
    parse_flag_value: fn ([]const u8, *?[]const u8) error{InvalidFlagValue}!T,
    cases: struct {
        ok: []const struct { []const u8, T },
        err: []const struct { []const u8, []const u8 },
    },
) !void {
    // comptime assert(T.parse_flag_value == parse_flag_value);

    const test_count = 50_000;
    const string_size_max = 32;

    const gpa = std.testing.allocator;
    // var prng = stdx.PRNG.from_seed_testing();
    // Using a simpler PRNG common to standard library to avoid stdx dependency issues
    var prng = stdx.PRNG.from_seed_testing();
    // const rand = prng.random(); // PRNG doesn't have .random() yet in my copy, so I use PRNG methods directly.

    for (cases.ok) |case| {
        const string, const want = case;
        assert(string.len > 0);

        var diagnostic: ?[]const u8 = null;
        const got = try parse_flag_value(string, &diagnostic);
        assert(diagnostic == null);
        try std.testing.expectEqual(want, got);
    }

    for (cases.err) |case| {
        const string, const want_message = case;
        assert(string.len > 0); // Empty value are rejected early.

        var diagnostic: ?[]const u8 = null;
        if (parse_flag_value(string, &diagnostic)) |value| {
            std.debug.print("expected an error, got value: input='{s}', value={}", .{
                string,
                value,
            });
            return error.TestUnexpectedResult;
        } else |err| switch (err) {
            error.InvalidFlagValue => {
                try parse_flag_value_check_diagnostic(string, diagnostic);
                if (std.mem.indexOf(u8, diagnostic.?, want_message) == null) {
                    std.debug.print(
                        "expected diagnostic to contain substring='{s}' diagnostic='{s}'",
                        .{ want_message, diagnostic.? },
                    );
                    return error.TestUnexpectedResult;
                }
            },
        }
    }

    var corpus = std.ArrayList(u8).init(gpa);
    defer corpus.deinit();

    for (cases.ok) |case| try corpus.appendSlice(case[0]);
    for (cases.err) |case| try corpus.appendSlice(case[0]);
    for (0..5) |_| try corpus.append(prng.int(u8));

    std.mem.sort(u8, corpus.items, {}, std.sort.asc(u8));

    const alphabet = unique(corpus.items);

    var string_buffer: [string_size_max]u8 = @splat(0);
    for (0..test_count) |_| {
        // range_inclusive equivalent
        const string_size = prng.range_inclusive(usize, 1, string_size_max);
        const string = string_buffer[0..string_size];
        assert(string.len > 0);
        if (prng.boolean()) {
            for (string) |*c| c.* = alphabet[prng.index(alphabet)];
        } else {
            for (string) |*c| c.* = prng.int(u8);
        }

        var diagnostic: ?[]const u8 = null;
        if (parse_flag_value(string, &diagnostic)) |_| {
            assert(diagnostic == null);
        } else |err| switch (err) {
            error.InvalidFlagValue => try parse_flag_value_check_diagnostic(string, diagnostic),
        }
    }
}

fn parse_flag_value_check_diagnostic(string: []const u8, diagnostic: ?[]const u8) !void {
    const message = diagnostic orelse {
        std.debug.print("expected a diagnostic: string='{s}'", .{string});
        return error.TestUnexpectedResult;
    };
    if (!(message.len > 0 and
        std.ascii.isLower(message[0]) and
        message[message.len - 1] == ':'))
    {
        std.debug.print("wrong diagnostic format: string='{s}' diagnostic='{s}'", .{
            string,
            message,
        });
        return error.TestUnexpectedResult;
    }
}

fn unique(sorted: []u8) []u8 {
    assert(sorted.len > 0);

    var count: usize = 1;
    for (1..sorted.len) |index| {
        assert(sorted[count - 1] <= sorted[index]);
        if (sorted[count - 1] == sorted[index]) {
            // Duplicate! Skip to the next index.
        } else {
            sorted[count] = sorted[index];
            count += 1;
        }
    }

    return sorted[0..count];
}
