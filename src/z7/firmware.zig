/// S7 Firmware Configuration & Data Bank
///
/// CONFIGURATION: Edit the `config` struct below to customize the emulated PLC.
/// All SZL response blobs are generated at compile time from these values.
///

// ===============================================================================
//  CONFIGURATION - Edit these to change the emulated PLC identity
// ===============================================================================

pub const config = struct {
    /// System name. MUST follow "S7<model>/<name>" for pystep7 compatibility.
    /// pystep7 parses: controller = int(systemName.split("/")[0][2:])
    pub const system_name = "S71200/ZalW";

    /// Module name shown in CPU info (SZL 0x001C index 0x0002)
    pub const module_name = "CPU ZalW";

    /// Module type name (SZL 0x001C index 0x0007)
    pub const module_type = "CPU 315-2 PN/DP";

    /// Order code / article number (SZL 0x0011, max 20 chars)
    pub const order_code = "6ES7 315-2EH14-0AB0 ";

    /// Copyright string (SZL 0x001C index 0x0004)
    pub const copyright = "Original Siemens Equipment";

    /// Serial number (SZL 0x001C index 0x0005)
    pub const serial_number = "S C-C2UR28922012";

    /// Memory card serial (SZL 0x001C index 0x0008)
    pub const mem_card_serial = "MMC 267FF11F";

    /// CPU status: 0x08 = RUN, 0x04 = STOP
    pub const cpu_status: u8 = 0x08;
};

// ===============================================================================
//  COMPTIME HELPERS
// ===============================================================================

fn setBE16(buf: anytype, off: usize, val: u16) void {
    buf[off] = @intCast(val >> 8);
    buf[off + 1] = @intCast(val & 0xFF);
}

fn copyStr(buf: anytype, off: usize, str: []const u8) void {
    var i: usize = 0;
    while (i < str.len) : (i += 1) {
        buf[off + i] = str[i];
    }
}

fn copyBytes(buf: anytype, off: usize, src: []const u8) void {
    var i: usize = 0;
    while (i < src.len) : (i += 1) {
        buf[off + i] = src[i];
    }
}

/// Write the 4-byte SZL data header: ReturnCode(1) TransportSize(1) DataLen(2)
fn writeDataHdr(buf: anytype, data_len: u16) void {
    buf[0] = 0xFF; // ReturnCode: success
    buf[1] = 0x09; // TransportSize: octet_string
    setBE16(buf, 2, data_len);
}

/// Write the 8-byte SZL list header at offset 4
fn writeSzlHdr(buf: anytype, szl_id: u16, index: u16, rec_len: u16, rec_count: u16) void {
    setBE16(buf, 4, szl_id);
    setBE16(buf, 6, index);
    setBE16(buf, 8, rec_len);
    setBE16(buf, 10, rec_count);
}

// ===============================================================================
//  GENERATED: SZL 0x0000 - List of supported SZL IDs
// ===============================================================================

fn buildSzl0000() [22]u8 {
    var buf: [22]u8 = [_]u8{0} ** 22;
    writeDataHdr(&buf, 18);
    writeSzlHdr(&buf, 0x0000, 0x0000, 2, 5);
    setBE16(&buf, 12, 0x0011);
    setBE16(&buf, 14, 0x001C);
    setBE16(&buf, 16, 0x0131);
    setBE16(&buf, 18, 0x0132);
    setBE16(&buf, 20, 0x0424);
    return buf;
}

pub const szl_0000 = buildSzl0000();

// ===============================================================================
//  GENERATED: SZL 0x001C - Component Identification (10 records × 34 bytes)
//  Total: 4 (data hdr) + 8 (szl hdr) + 340 (records) = 352
// ===============================================================================

fn buildSzl001c() [352]u8 {
    var buf: [352]u8 = [_]u8{0} ** 352;
    writeDataHdr(&buf, 348); // 352 - 4
    writeSzlHdr(&buf, 0x001C, 0x0000, 34, 10);

    // Each record: Index(2) + Name(32) = 34 bytes, starting at offset 12
    const R = 34; // record stride
    const B = 12; // base offset

    // 0x0001: System Name
    setBE16(&buf, B + R * 0, 0x0001);
    copyStr(&buf, B + R * 0 + 2, config.system_name);

    // 0x0002: Module Name
    setBE16(&buf, B + R * 1, 0x0002);
    copyStr(&buf, B + R * 1 + 2, config.module_name);

    // 0x0003: Plant ID (empty)
    setBE16(&buf, B + R * 2, 0x0003);

    // 0x0004: Copyright
    setBE16(&buf, B + R * 3, 0x0004);
    copyStr(&buf, B + R * 3 + 2, config.copyright);

    // 0x0005: Serial Number
    setBE16(&buf, B + R * 4, 0x0005);
    copyStr(&buf, B + R * 4 + 2, config.serial_number);

    // 0x0007: Module Type Name
    setBE16(&buf, B + R * 5, 0x0007);
    copyStr(&buf, B + R * 5 + 2, config.module_type);

    // 0x0008: Memory Card Serial
    setBE16(&buf, B + R * 6, 0x0008);
    copyStr(&buf, B + R * 6 + 2, config.mem_card_serial);

    // 0x0009: Manufacturer/Profile (binary, Siemens default)
    setBE16(&buf, B + R * 7, 0x0009);
    buf[B + R * 7 + 2] = 0x00;
    buf[B + R * 7 + 3] = 0x2A;
    buf[B + R * 7 + 4] = 0xF6;
    buf[B + R * 7 + 5] = 0x00;
    buf[B + R * 7 + 6] = 0x00;
    buf[B + R * 7 + 7] = 0x01;

    // 0x000A: OEM ID (empty)
    setBE16(&buf, B + R * 8, 0x000A);

    // 0x000B: Location (empty)
    setBE16(&buf, B + R * 9, 0x000B);

    return buf;
}

pub const szl_001c = buildSzl001c();

// ===============================================================================
//  GENERATED: SZL 0x0011 - Module Identification (4 records × 28 bytes)
//  Total: 4 + 8 + 112 = 124
//  Record: Index(2) + OrderCode(20) + HWVersion(6) = 28
// ===============================================================================

fn buildSzl0011() [124]u8 {
    var buf: [124]u8 = [_]u8{0} ** 124;
    writeDataHdr(&buf, 120);
    writeSzlHdr(&buf, 0x0011, 0x0000, 28, 4);

    const R = 28;
    const B = 12;
    const hw_ver = [6]u8{ 0x00, 0xC0, 0x00, 0x04, 0x00, 0x01 };
    const fw_ver = [6]u8{ 0x00, 0xC0, 0x56, 0x03, 0x02, 0x06 };
    const boot_ver = [6]u8{ 0x00, 0x00, 0x41, 0x20, 0x09, 0x09 };

    // Record 0x0001: Order code (hardware)
    setBE16(&buf, B + R * 0, 0x0001);
    copyStr(&buf, B + R * 0 + 2, config.order_code);
    copyBytes(&buf, B + R * 0 + 22, &hw_ver);

    // Record 0x0006: Order code (firmware)
    setBE16(&buf, B + R * 1, 0x0006);
    copyStr(&buf, B + R * 1 + 2, config.order_code);
    copyBytes(&buf, B + R * 1 + 22, &hw_ver);

    // Record 0x0007: (spaces - "no name")
    setBE16(&buf, B + R * 2, 0x0007);
    {
        var i: usize = 0;
        while (i < 20) : (i += 1) {
            buf[B + R * 2 + 2 + i] = ' ';
        }
    }
    copyBytes(&buf, B + R * 2 + 22, &fw_ver);

    // Record 0x0081: Boot Loader
    setBE16(&buf, B + R * 3, 0x0081);
    copyStr(&buf, B + R * 3 + 2, "Boot Loader         ");
    copyBytes(&buf, B + R * 3 + 22, &boot_ver);

    return buf;
}

pub const szl_0011 = buildSzl0011();

// ===============================================================================
//  GENERATED: SZL 0x0424 - CPU Status (1 record × 20 bytes)
//  Total: 4 + 8 + 20 = 32
// ===============================================================================

fn buildSzl0424() [32]u8 {
    var buf: [32]u8 = [_]u8{0} ** 32;
    writeDataHdr(&buf, 28);
    writeSzlHdr(&buf, 0x0424, 0x0000, 20, 1);

    // Record (20 bytes) - status byte at record offset 3
    buf[12] = 0x51;
    buf[13] = 0x44;
    buf[14] = 0xFF;
    buf[15] = config.cpu_status; // ← RUN or STOP
    // Timestamp/version tail
    copyBytes(&buf, 24, &[_]u8{ 0x94, 0x02, 0x05, 0x02, 0x01, 0x55, 0x90, 0x67 });

    return buf;
}

pub const szl_0424 = buildSzl0424();

// =============================================================================
//  GENERATED: Individual SZL 0x011C records (46 bytes each)
//  Total per record: 4 (data hdr) + 8 (szl hdr) + 34 (one record) = 46
// ===============================================================================

fn buildRecord011c(comptime index: u16, comptime name: []const u8) [46]u8 {
    var buf: [46]u8 = [_]u8{0} ** 46;
    writeDataHdr(&buf, 42);
    writeSzlHdr(&buf, 0x011C, index, 34, 1);
    setBE16(&buf, 12, index);
    copyStr(&buf, 14, name);
    return buf;
}

pub const szl_011c_idx_0001 = buildRecord011c(0x0001, config.system_name);
pub const szl_011c_idx_0002 = buildRecord011c(0x0002, config.module_name);
pub const szl_011c_idx_0005 = buildRecord011c(0x0005, config.serial_number);
pub const szl_011c_idx_0007 = buildRecord011c(0x0007, config.module_type);

// ===============================================================================
//  STATIC: Protocol/system blobs (not identity-related)
// ===============================================================================

/// Returned for unknown / unsupported SZL IDs
pub const szl_not_avail = [4]u8{ 0x0A, 0x00, 0x00, 0x00 };

/// Partial header for SZL 0x0F1C
pub const szl_0f1c = [12]u8{
    0xFF, 0x09, 0x00, 0x08, 0x0F, 0x1C, 0x00, 0x00, 0x00, 0x22, 0x00, 0x0A,
};

/// Partial header for SZL 0x0F11
pub const szl_0f11 = [12]u8{
    0xFF, 0x09, 0x00, 0x08, 0x0F, 0x11, 0x00, 0x00, 0x00, 0x1C, 0x00, 0x04,
};

/// SZL 0x0131 idx 0x0001 - Comm processor general info
pub const szl_0131_idx_0001 = [52]u8{
    0xFF, 0x09, 0x00, 0x30, 0x01, 0x31, 0x00, 0x01, 0x00, 0x28, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x0E, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x03,
};

/// SZL 0x0131 idx 0x0002 - Comm processor extended info
pub const szl_0131_idx_0002 = [52]u8{
    0xFF, 0x09, 0x00, 0x30, 0x01, 0x31, 0x00, 0x02, 0x00, 0x28, 0x00, 0x01,
    0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0E, 0x00, 0x00,
    0x00, 0x00, 0x06, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
};

/// SZL 0x0131 idx 0x0004
pub const szl_0131_idx_0004 = [52]u8{
    0xFF, 0x09, 0x00, 0x30, 0x01, 0x31, 0x00, 0x04, 0x00, 0x28, 0x00, 0x01,
    0x00, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x00,
    0x00, 0x00, 0x56, 0x56, 0x10, 0x01, 0x33, 0x7B, 0x02, 0x00, 0x75, 0xF4,
    0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
};

/// SZL 0x0232 idx 0x0004 - Protection
pub const szl_0232_idx_0004 = [52]u8{
    0xFF, 0x09, 0x00, 0x30, 0x02, 0x32, 0x00, 0x04, 0x00, 0x28, 0x00, 0x01,
    0x00, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x00,
    0x00, 0x00, 0x56, 0x56, 0x10, 0x01, 0x33, 0x7B, 0x02, 0x00, 0x75, 0xF4,
    0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
};

/// SZL 0x0232 idx 0x0001 - Protection
pub const szl_0232_idx_0001 = [52]u8{
    0xFF, 0x09, 0x00, 0x30, 0x02, 0x32, 0x00, 0x01, 0x00, 0x28, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x0E, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x03,
};

/// SZL 0x0132 idx 0x0001 - Communication parameters
pub const szl_0132_idx_0001 = [52]u8{
    0xFF, 0x09, 0x00, 0x30, 0x01, 0x32, 0x00, 0x01, 0x00, 0x28, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x0E, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x03,
};

/// SZL 0x0132 idx 0x0002
pub const szl_0132_idx_0002 = [52]u8{
    0xFF, 0x09, 0x00, 0x30, 0x01, 0x32, 0x00, 0x02, 0x00, 0x28, 0x00, 0x01,
    0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0E, 0x00, 0x00,
    0x00, 0x00, 0x06, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
};

/// SZL 0x0132 idx 0x0004
pub const szl_0132_idx_0004 = [52]u8{
    0xFF, 0x09, 0x00, 0x30, 0x01, 0x32, 0x00, 0x04, 0x00, 0x28, 0x00, 0x01,
    0x00, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x00,
    0x00, 0x00, 0x56, 0x56, 0x10, 0x01, 0x33, 0x7B, 0x02, 0x00, 0x75, 0xF4,
    0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
};

// ===============================================================================
//  DISPATCH: Look up SZL data by (ID, Index)
// ===============================================================================

const SzlEntry = struct {
    id: u16,
    index: u16 = 0xFFFF, // 0xFFFF = any index
    data: []const u8,
};

const szl_table = [_]SzlEntry{
    // Generated blobs (any index)
    .{ .id = 0x0000, .data = &szl_0000 },
    .{ .id = 0x0011, .data = &szl_0011 },
    .{ .id = 0x001C, .data = &szl_001c },
    .{ .id = 0x0424, .data = &szl_0424 },

    // Partial headers
    .{ .id = 0x0F1C, .data = &szl_0f1c },
    .{ .id = 0x0F11, .data = &szl_0f11 },

    // Individual 0x011C records
    .{ .id = 0x011C, .index = 0x0001, .data = &szl_011c_idx_0001 },
    .{ .id = 0x011C, .index = 0x0002, .data = &szl_011c_idx_0002 },
    .{ .id = 0x011C, .index = 0x0005, .data = &szl_011c_idx_0005 },
    .{ .id = 0x011C, .index = 0x0007, .data = &szl_011c_idx_0007 },

    // Comm processor
    .{ .id = 0x0131, .index = 0x0001, .data = &szl_0131_idx_0001 },
    .{ .id = 0x0131, .index = 0x0002, .data = &szl_0131_idx_0002 },
    .{ .id = 0x0131, .index = 0x0004, .data = &szl_0131_idx_0004 },

    // Protection
    .{ .id = 0x0232, .index = 0x0001, .data = &szl_0232_idx_0001 },
    .{ .id = 0x0232, .index = 0x0004, .data = &szl_0232_idx_0004 },

    // Communication parameters
    .{ .id = 0x0132, .index = 0x0001, .data = &szl_0132_idx_0001 },
    .{ .id = 0x0132, .index = 0x0002, .data = &szl_0132_idx_0002 },
    .{ .id = 0x0132, .index = 0x0004, .data = &szl_0132_idx_0004 },
};

/// Look up SZL data for a given (ID, Index) pair.
/// Returns the pre-built data blob, or `szl_not_avail` if not found.
pub fn lookup(szl_id: u16, szl_index: u16) []const u8 {
    // First pass: exact (id, index) match
    for (&szl_table) |entry| {
        if (entry.id == szl_id and entry.index == szl_index) {
            return entry.data;
        }
    }
    // Second pass: wildcard index match
    for (&szl_table) |entry| {
        if (entry.id == szl_id and entry.index == 0xFFFF) {
            return entry.data;
        }
    }
    return &szl_not_avail;
}
