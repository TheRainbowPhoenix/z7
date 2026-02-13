const std = @import("std");
const assert = std.debug.assert;

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

pub const Config = struct {
    cluster: struct {
        clients_max: u32 = 64,
        message_size_max: u32 = 1 * MiB,
        journal_slot_count: u32 = 1024,
        vsr_releases_max: u32 = 64,
        quorum_replication_max: u8 = 3,
        pipeline_prepare_queue_max: u32 = 8,
        view_change_headers_suffix_max: u32 = 9,
    },
    process: struct {
        log_level: std.log.Level = .info,
        verify: bool = true,
        // release: zCom.Release = zCom.Release{ .value = 1 },
        // release_client_min: zCom.Release = zCom.Release{ .value = 1 },
        git_commit: ?[40]u8 = null,
        port: u16 = 102,
        address: []const u8 = "127.0.0.1",
        tick_ms: u63 = 10,
        direct_io: bool = true,
    },
};

pub const configs = struct {
    pub const current = Config{
        .cluster = .{},
        .process = .{},
    };
};
