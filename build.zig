const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // --- Modules ---

    const stdx_module = b.addModule("stdx", .{
        .root_source_file = b.path("reference_src/stdx/stdx.zig"),
    });

    const vsr_options = b.addOptions();
    // Default options for VSR module to compile
    vsr_options.addOption(?[40]u8, "git_commit", null);
    vsr_options.addOption(bool, "config_verify", optimize == .Debug);
    vsr_options.addOption(?[]const u8, "release", "0.0.1");
    vsr_options.addOption(?[]const u8, "release_client_min", "0.0.0");

    const vsr_module = b.addModule("vsr", .{
        .root_source_file = b.path("reference_src/vsr.zig"),
    });
    vsr_module.addImport("stdx", stdx_module);
    vsr_module.addOptions("vsr_options", vsr_options);

    // --- z7 Executable ---

    const z7 = b.addExecutable(.{
        .name = "z7",
        .root_source_file = b.path("src/z7/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    z7.root_module.addImport("stdx", stdx_module);
    z7.root_module.addImport("vsr", vsr_module);

    // Link against system libraries if needed by IO (e.g. ntdll on Windows is usually handled by zig std,
    // but io_uring might need something on Linux. Reference build handles it,
    // let's assume standard Zig library handling covers it for now).

    b.installArtifact(z7);

    const run_cmd = b.addRunArtifact(z7);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the z7 server");
    run_step.dependOn(&run_cmd.step);

    // --- Tests ---
    const unit_tests = b.addTest(.{
        .root_source_file = b.path("src/z7/packet.zig"),
        .target = target,
        .optimize = optimize,
    });

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
}
