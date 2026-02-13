const std = @import("std");

/// S7 Block Type constants
pub const BlockType = enum(u8) {
    OB = 0x38,
    DB = 0x41,
    SDB = 0x42,
    FC = 0x43,
    SFC = 0x44,
    FB = 0x45,
    SFB = 0x46,
};

/// S7 Block Language constants
pub const BlockLang = enum(u8) {
    LAD = 0x01,
    FBD = 0x02,
    STL = 0x03,
    SCL = 0x04,
    GRAPH = 0x05,
    HIGHRAPH = 0x06,
    DB = 0x11,
    SDB = 0x12,
};

/// Detailed block information record (61 bytes payload portion)
/// This matches the structure unpacked by pystep7 starting at offset 42.
pub const BlockInfo = struct {
    flags: u8 = 0x01,
    language: u8 = @intFromEnum(BlockLang.DB),
    block_type: u8 = @intFromEnum(BlockType.DB),
    number: u16,
    load_memory: u32 = 410,
    security: u32 = 0,
    code_timestamp_ms: u32 = 0x0043ec92, // Mock: 2022-09-08
    code_timestamp_days: u16 = 0x2236,
    interface_timestamp_ms: u32 = 0x0043ec92,
    interface_timestamp_days: u16 = 0x2236,
    ssb_length: u16 = 42,
    add_length: u16 = 0,
    local_data_length: u16 = 0,
    mc7_length: u16 = 32768,
    author: [8]u8 = [_]u8{' '} ** 8,
    family: [8]u8 = [_]u8{' '} ** 8,
    name: [8]u8 = [_]u8{' '} ** 8,
    version: u8 = 0x11, // "1.1" in nibbles
    reserved: u8 = 0x00,
    checksum: u16 = 0xF3DB,

    pub fn write(self: BlockInfo, buf: []u8) void {
        buf[0] = self.flags;
        buf[1] = self.language;
        buf[2] = self.block_type;
        std.mem.writeInt(u16, buf[3..5], self.number, .big);
        std.mem.writeInt(u32, buf[5..9], self.load_memory, .big);
        std.mem.writeInt(u32, buf[9..13], self.security, .big);
        std.mem.writeInt(u32, buf[13..17], self.code_timestamp_ms, .big);
        std.mem.writeInt(u16, buf[17..19], self.code_timestamp_days, .big);
        std.mem.writeInt(u32, buf[19..23], self.interface_timestamp_ms, .big);
        std.mem.writeInt(u16, buf[23..25], self.interface_timestamp_days, .big);
        std.mem.writeInt(u16, buf[25..27], self.ssb_length, .big);
        std.mem.writeInt(u16, buf[27..29], self.add_length, .big);
        std.mem.writeInt(u16, buf[29..31], self.local_data_length, .big);
        std.mem.writeInt(u16, buf[31..33], self.mc7_length, .big);
        @memcpy(buf[33..41], &self.author);
        @memcpy(buf[41..49], &self.family);
        @memcpy(buf[49..57], &self.name);
        buf[57] = self.version;
        buf[58] = self.reserved;
        std.mem.writeInt(u16, buf[59..61], self.checksum, .big);
    }
};
