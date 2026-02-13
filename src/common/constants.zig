const std = @import("std");

pub const config = @import("config.zig").configs.current;

pub const sector_size = 4096;
pub const tick_ms = config.process.tick_ms;
pub const verify = config.process.verify;
