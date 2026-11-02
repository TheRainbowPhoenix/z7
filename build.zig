const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // --- Modules ---

    const stdx_module = b.addModule("stdx", .{
        .root_source_file = b.path("src/common/stdx.zig"),
    });

    const zCom_options = b.addOptions();
    // Default options for zCom module to compile
    zCom_options.addOption(?[40]u8, "git_commit", null);
    zCom_options.addOption(bool, "config_verify", optimize == .Debug);
    zCom_options.addOption(?[]const u8, "release", "0.0.1");
    zCom_options.addOption(?[]const u8, "release_client_min", "0.0.0");

    const zCom_module = b.addModule("zCom", .{
        .root_source_file = b.path("src/common/zCom.zig"),
    });
    zCom_module.addImport("stdx", stdx_module);
    zCom_module.addOptions("zCom_options", zCom_options); // Keep option name as vsr_options if code expects it

    // --- z7 Library ---
    const z7_lib = b.addSharedLibrary(.{
        .name = "z7",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/z7/exports.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    z7_lib.root_module.addImport("stdx", stdx_module);
    z7_lib.root_module.addImport("zCom", zCom_module);
    // A loaded Linux library must use the host libc's pthread/TLS runtime.
    // Zig's freestanding Linux thread setup expects executable startup to initialize TLS.
    if (target.result.os.tag == .linux) z7_lib.linkLibC();
    b.installArtifact(z7_lib);

    // --- z7 Executable ---

    const z7 = b.addExecutable(.{
        .name = "z7",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/z7/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    z7.root_module.addImport("stdx", stdx_module);
    z7.root_module.addImport("zCom", zCom_module);

    // Link against system libraries if needed by IO (e.g. ntdll on Windows is usually handled by zig std,
    // but io_uring might need something on Linux. Reference build handles it,
    // let's assume standard Zig library handling covers it for now).

    b.installArtifact(z7);

    const zomsp = b.addExecutable(.{
        .name = "zOMSp",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/zomsp/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    zomsp.root_module.addImport("zCom", zCom_module);
    zomsp.addCSourceFile(.{ .file = b.path("src/zomsp/tls_bridge.c"), .flags = &.{ "-std=c11", "-Wall", "-Wextra", "-Werror" } });
    zomsp.linkLibC();
    if (target.result.os.tag == .linux) zomsp.linkSystemLibrary("dl");
    const install_zomsp = b.addInstallArtifact(zomsp, .{});
    b.step("zomsp", "Build the OMSp proxy and endpoints").dependOn(&install_zomsp.step);
    const zomsp_lib = b.addSharedLibrary(.{
        .name = "zomsp",
        .root_module = b.createModule(.{ .root_source_file = b.path("src/zomsp/exports.zig"), .target = target, .optimize = optimize }),
    });
    zomsp_lib.addCSourceFile(.{ .file = b.path("src/zomsp/tls_bridge.c"), .flags = &.{ "-std=c11", "-Wall", "-Wextra", "-Werror" } });
    zomsp_lib.linkLibC();
    if (target.result.os.tag == .linux) zomsp_lib.linkSystemLibrary("dl");
    const install_zomsp_lib = b.addInstallArtifact(zomsp_lib, .{});
    b.top_level_steps.get("zomsp").?.step.dependOn(&install_zomsp_lib.step);
    const install_zomsp_header = b.addInstallFile(b.path("src/zomsp/zomsp.h"), "include/zomsp.h");
    b.top_level_steps.get("zomsp").?.step.dependOn(&install_zomsp_header.step);
    const zomsp_tests = b.addTest(.{ .root_module = b.createModule(.{
        .root_source_file = b.path("src/zomsp/protocol.zig"),
        .target = target,
        .optimize = optimize,
    }) });
    b.step("test:zomsp", "Test bounded OMSp framing").dependOn(&b.addRunArtifact(zomsp_tests).step);
    const zomsp_wire_tests = b.addTest(.{ .root_module = b.createModule(.{
        .root_source_file = b.path("src/zomsp/wire.zig"),
        .target = target,
        .optimize = optimize,
    }) });
    b.top_level_steps.get("test:zomsp").?.step.dependOn(&b.addRunArtifact(zomsp_wire_tests).step);

    const check_step = b.step("check", "Check if z7 compiles");
    check_step.dependOn(&z7.step);
    check_step.dependOn(&zomsp.step);

    const run_cmd = b.addRunArtifact(z7);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the z7 server");
    run_step.dependOn(&run_cmd.step);

    // --- Tests ---
    const unit_tests = b.addTest(.{
        .name = "test",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/z7/tests.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
    const io_wait_check = b.addExecutable(.{
        .name = "io_wait_check",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/io_wait_check.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    io_wait_check.root_module.addImport("zCom", zCom_module);
    const run_io_wait_check = b.addRunArtifact(io_wait_check);
    test_step.dependOn(&run_io_wait_check.step);
    const install_io_wait_check = b.addInstallArtifact(io_wait_check, .{});
    b.step("test:io:build", "Build the IO wait regression executable").dependOn(&install_io_wait_check.step);

    const run_fmt = b.addFmt(.{ .paths = &.{"."}, .check = true });
    const fmt_step = b.step("test:fmt", "Check formatting");
    fmt_step.dependOn(&run_fmt.step);

    // --- CI ---
    const ci_step = b.step("ci", "Run CI checks");
    const CIMode = enum { @"test", smoke, default };
    const ci_mode = if (b.args) |args| mode: {
        if (args.len > 0) {
            break :mode std.meta.stringToEnum(CIMode, args[0]) orelse .default;
        }
        break :mode .default;
    } else .default;

    if (ci_mode == .smoke or ci_mode == .default) {
        ci_step.dependOn(fmt_step);
        ci_step.dependOn(check_step);
    }
    if (ci_mode == .@"test" or ci_mode == .default) {
        ci_step.dependOn(test_step);
        ci_step.dependOn(&b.top_level_steps.get("test:zomsp").?.step);
        // reference_build.zig also does check in smoke, and test usually implies smoke or depends on it.
        // For simplicity we follow the logic:
        if (ci_mode == .@"test") {
            ci_step.dependOn(check_step);
        }
    }

    if (ci_mode == .default) {
        // TODO: ...
    } else {
        // unit tests support filters if not running ci modes that consume the arg
        // but wait, if it's 'test' or 'smoke', args[0] is the mode.
        if (b.args) |args| {
            if (args.len > 1) {
                unit_tests.filters = args[1..];
            }
        }
    }
}
