//! Exercise native bounded waits and the old-kernel fallback without network fixtures.
const std = @import("std");
const builtin = @import("builtin");
const IO = @import("zCom").io.IO;
const assert = std.debug.assert;

const Context = struct {
    done: bool = false,
    fn complete(self: *Context, completion: *IO.Completion, result: IO.TimeoutError!void) void {
        _ = completion;
        result catch @panic("timeout operation failed");
        assert(!self.done);
        self.done = true;
    }
};

const Batch = struct {
    count: u32 = 0,
    fn complete(self: *Batch, completion: *IO.Completion, result: IO.TimeoutError!void) void {
        _ = completion;
        result catch @panic("batch timeout operation failed");
        self.count += 1;
        assert(self.count <= 128);
    }
};

fn check(legacy: bool) !void {
    var io = try IO.init(32, 0);
    defer io.deinit();
    if (builtin.os.tag == .linux and legacy) io.ring.features &= ~@as(u32, std.os.linux.IORING_FEAT_EXT_ARG);
    var context = Context{};
    var completion: IO.Completion = undefined;
    io.timeout(*Context, &context, Context.complete, &completion, 0);
    const ready_at = try std.time.Instant.now();
    try io.run_once_for_ns(100 * std.time.ns_per_ms);
    assert(context.done);
    assert((try std.time.Instant.now()).since(ready_at) < std.time.ns_per_s);

    context.done = false;
    io.timeout(*Context, &context, Context.complete, &completion, std.time.ns_per_ms);
    const started = try std.time.Instant.now();
    while (!context.done) {
        try io.run_once_for_ns(10 * std.time.ns_per_ms);
        assert((try std.time.Instant.now()).since(started) < std.time.ns_per_s);
    }
    // More operations than SQ slots exercises queued work and completion batching.
    var batch = Batch{};
    var completions: [128]IO.Completion = undefined;
    for (&completions) |*operation| {
        io.timeout(*Batch, &batch, Batch.complete, operation, std.time.ns_per_ms);
    }
    const batch_started = try std.time.Instant.now();
    while (batch.count < completions.len) {
        try io.run_once_for_ns(10 * std.time.ns_per_ms);
        assert((try std.time.Instant.now()).since(batch_started) < std.time.ns_per_s);
    }
    // No temporary wait-timeout SQEs or stack references survive a return.
    try io.run_once_for_ns(0);
    if (builtin.os.tag == .linux) {
        assert(io.ios_queued == 0 and io.ios_in_kernel == 0);
    } else {
        assert(io.io_pending == 0 and io.timeouts.empty() and io.completed.empty());
        try io.run_once_for_ns(std.time.ns_per_ms);
        assert(io.precise_wait);
        io.release_wait_precision();
        assert(!io.precise_wait);
    }
}

pub fn main() !void {
    try check(false);
    if (builtin.os.tag == .linux) try check(true);
}
