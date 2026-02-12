const std = @import("std");
const mem = std.mem;
const Allocator = mem.Allocator;
const testing = std.testing;

pub const MAX_TSAP_LENGTH = 16;
pub const MAX_ISO_FRAGMENTS = 64;
pub const ISO_PAYLOAD_SIZE = 4096;
pub const TPKT_VERSION: u8 = 3;

pub const PduType = struct {
    pub const CR: u8 = 0xE0;
    pub const CC: u8 = 0xD0;
    pub const DR: u8 = 0x80;
    pub const DC: u8 = 0xC0;
    pub const DT: u8 = 0xF0;
};

pub const PDU_EOT: u8 = 0x80;

pub const CotpOption = struct {
    pub const PDU_SIZE: u8 = 0xC0;
    pub const SRC_TSAP: u8 = 0xC1;
    pub const DST_TSAP: u8 = 0xC2;
};

pub const Error = error{
    IsoShortPacket,
    IsoInvalidPdu,
    IsoPduOverflow,
    BufferTooSmall,
    OutOfMemory,
};

/// TPKT Header (RFC 1006)
pub const TpktHeader = extern struct {
    version: u8,
    reserved: u8,
    length: u16, // Big Endian

    pub const SIZE: usize = 4;

    pub fn init(len: u16) TpktHeader {
        return .{
            .version = TPKT_VERSION,
            .reserved = 0,
            .length = std.mem.nativeToBig(u16, @as(u16, SIZE) + len),
        };
    }

    pub fn from_bytes(data: []const u8) Error!TpktHeader {
        if (data.len < SIZE) return error.IsoShortPacket;
        if (data[0] != TPKT_VERSION) return error.IsoInvalidPdu;

        return TpktHeader{
            .version = data[0],
            .reserved = data[1],
            .length = mem.readInt(u16, data[2..4], .big),
        };
    }

    pub fn payload_length(self: TpktHeader) usize {
        const total_len = mem.bigToNative(u16, self.length);
        if (total_len < SIZE) return 0;
        return total_len - SIZE;
    }

    pub fn to_bytes(self: TpktHeader, buf: []u8) Error!void {
        if (buf.len < SIZE) return error.BufferTooSmall;
        buf[0] = self.version;
        buf[1] = self.reserved;
        mem.writeInt(u16, buf[2..4], self.length, .big);
    }
};

/// COTP Connection PDU
pub const CotpConnect = struct {
    header_length: u8,
    pdu_type: u8,
    dst_ref: u16,
    src_ref: u16,
    class_option: u8,
    src_tsap: ?[]const u8 = null,
    dst_tsap: ?[]const u8 = null,
    pdu_size: ?u8 = null,

    pub const MIN_SIZE: usize = 7;

    pub fn init_request(src_tsap: []const u8, dst_tsap: []const u8, pdu_size: u8) CotpConnect {
        var cotp = CotpConnect{
            .header_length = 6,
            .pdu_type = PduType.CR,
            .dst_ref = 0,
            .src_ref = 0,
            .class_option = 0,
            .src_tsap = src_tsap,
            .dst_tsap = dst_tsap,
            .pdu_size = pdu_size,
        };
        cotp.update_header_length();
        return cotp;
    }

    fn update_header_length(self: *CotpConnect) void {
        var len: u8 = 6;
        if (self.src_tsap) |tsap| len += 2 + @as(u8, @intCast(tsap.len));
        if (self.dst_tsap) |tsap| len += 2 + @as(u8, @intCast(tsap.len));
        if (self.pdu_size) |_| len += 3;
        self.header_length = len;
    }

    pub fn size(self: CotpConnect) usize {
        return @as(usize, self.header_length) + 1;
    }

    pub fn to_bytes(self: CotpConnect, allocator: Allocator) ![]u8 {
        const total_size = self.size();
        var buf = try allocator.alloc(u8, total_size);
        errdefer allocator.free(buf);

        buf[0] = self.header_length;
        buf[1] = self.pdu_type;
        mem.writeInt(u16, buf[2..4], self.dst_ref, .big);
        mem.writeInt(u16, buf[4..6], self.src_ref, .big);
        buf[6] = self.class_option;

        var pos: usize = 7;

        if (self.pdu_size) |sz| {
            if (pos + 3 <= total_size) {
                buf[pos] = CotpOption.PDU_SIZE;
                buf[pos + 1] = 1;
                buf[pos + 2] = sz;
                pos += 3;
            }
        }

        if (self.src_tsap) |tsap| {
            if (pos + 2 + tsap.len <= total_size) {
                buf[pos] = CotpOption.SRC_TSAP;
                buf[pos + 1] = @intCast(tsap.len);
                @memcpy(buf[pos + 2 ..][0..tsap.len], tsap);
                pos += 2 + tsap.len;
            }
        }

        if (self.dst_tsap) |tsap| {
            if (pos + 2 + tsap.len <= total_size) {
                buf[pos] = CotpOption.DST_TSAP;
                buf[pos + 1] = @intCast(tsap.len);
                @memcpy(buf[pos + 2 ..][0..tsap.len], tsap);
                pos += 2 + tsap.len;
            }
        }

        return buf;
    }

    pub fn from_bytes(allocator: Allocator, data: []const u8) Error!CotpConnect {
        if (data.len < MIN_SIZE) return error.IsoShortPacket;

        const header_length = data[0];
        if (data.len < header_length + 1) return error.IsoShortPacket;

        const pdu_type = data[1];
        const dst_ref = mem.readInt(u16, data[2..4], .big);
        const src_ref = mem.readInt(u16, data[4..6], .big);
        const class_option = data[6];

        var cotp = CotpConnect{
            .header_length = header_length,
            .pdu_type = pdu_type,
            .dst_ref = dst_ref,
            .src_ref = src_ref,
            .class_option = class_option,
        };

        // Parse Options
        var pos: usize = 7;
        const end = header_length + 1; // header_length excludes the length byte itself

        while (pos + 2 <= end) {
            const code = data[pos];
            const len = data[pos + 1];
            pos += 2;

            if (pos + len > end) break;

            const val = data[pos..][0..len];

            switch (code) {
                CotpOption.PDU_SIZE => {
                    if (len >= 1) cotp.pdu_size = val[0];
                },
                CotpOption.SRC_TSAP => {
                    cotp.src_tsap = try allocator.dupe(u8, val);
                },
                CotpOption.DST_TSAP => {
                    cotp.dst_tsap = try allocator.dupe(u8, val);
                },
                else => {},
            }
            pos += len;
        }

        return cotp;
    }
};

/// COTP Data PDU
pub const CotpData = struct {
    header_length: u8,
    pdu_type: u8,
    eot_num: u8,

    pub const SIZE: usize = 3;

    pub fn init(eot: bool) CotpData {
        return .{
            .header_length = 2,
            .pdu_type = PduType.DT,
            .eot_num = if (eot) 0x80 else 0x00,
        };
    }

    pub fn from_bytes(data: []const u8) Error!CotpData {
        if (data.len < SIZE) return error.IsoShortPacket;
        if (data[1] != PduType.DT) return error.IsoInvalidPdu;
        return CotpData{
            .header_length = data[0],
            .pdu_type = data[1],
            .eot_num = data[2],
        };
    }

    pub fn is_eot(self: CotpData) bool {
        return (self.eot_num & 0x80) != 0;
    }

    pub fn to_bytes(self: CotpData, buf: []u8) Error!void {
        if (buf.len < SIZE) return error.BufferTooSmall;
        buf[0] = self.header_length;
        buf[1] = self.pdu_type;
        buf[2] = self.eot_num;
    }
};

/// Complete ISO Data PDU
pub const IsoDataPdu = struct {
    tpkt: TpktHeader,
    cotp: CotpData,
    payload: []const u8,

    pub fn init(payload: []const u8) IsoDataPdu {
        const cotp = CotpData.init(true);
        const tpkt = TpktHeader.init(@as(u16, @intCast(CotpData.SIZE + payload.len)));
        return .{
            .tpkt = tpkt,
            .cotp = cotp,
            .payload = payload,
        };
    }

    pub fn to_bytes(self: IsoDataPdu, allocator: Allocator) ![]u8 {
        const total_len = mem.bigToNative(u16, self.tpkt.length);
        var buf = try allocator.alloc(u8, total_len);
        errdefer allocator.free(buf);

        try self.tpkt.to_bytes(buf[0..4]);
        try self.cotp.to_bytes(buf[4..7]);
        @memcpy(buf[7..], self.payload);

        return buf;
    }

    pub fn from_bytes(data: []const u8) Error!IsoDataPdu {
        const tpkt = try TpktHeader.from_bytes(data);
        const actual_len = mem.bigToNative(u16, tpkt.length);

        if (data.len < actual_len) return error.IsoShortPacket;

        const cotp_data = data[TpktHeader.SIZE..];
        const cotp = try CotpData.from_bytes(cotp_data);

        const payload_start = TpktHeader.SIZE + CotpData.SIZE;
        const payload = data[payload_start..actual_len];

        return IsoDataPdu{
            .tpkt = tpkt,
            .cotp = cotp,
            .payload = payload,
        };
    }
};

/// Complete ISO Control PDU
pub const IsoControlPdu = struct {
    tpkt: TpktHeader,
    cotp: CotpConnect,

    pub fn init(cotp: CotpConnect) IsoControlPdu {
        const tpkt = TpktHeader.init(@as(u16, @intCast(cotp.size())));
        return .{
            .tpkt = tpkt,
            .cotp = cotp,
        };
    }

    pub fn to_bytes(self: IsoControlPdu, allocator: Allocator) ![]u8 {
        const total_len = mem.bigToNative(u16, self.tpkt.length);
        var buf = try allocator.alloc(u8, total_len);
        errdefer allocator.free(buf);

        try self.tpkt.to_bytes(buf[0..4]);
        const cotp_bytes = try self.cotp.to_bytes(allocator);
        defer allocator.free(cotp_bytes);
        @memcpy(buf[4..], cotp_bytes);
        return buf;
    }

    pub fn from_bytes(allocator: Allocator, data: []const u8) Error!IsoControlPdu {
        const tpkt = try TpktHeader.from_bytes(data);
        const actual_len = mem.bigToNative(u16, tpkt.length);
        if (data.len < actual_len) return error.IsoShortPacket;

        // Skip TPKT header
        const cotp_data = data[TpktHeader.SIZE..actual_len];
        const cotp = try CotpConnect.from_bytes(allocator, cotp_data);

        return IsoControlPdu{
            .tpkt = tpkt,
            .cotp = cotp,
        };
    }
};

test "TPKT Header" {
    const header = TpktHeader.init(100);
    try testing.expectEqual(@as(u8, 3), header.version);
    try testing.expectEqual(@as(usize, 100), header.payload_length());

    var buf: [4]u8 = undefined;
    try header.to_bytes(&buf);

    const parsed = try TpktHeader.from_bytes(&buf);
    try testing.expectEqual(header.length, parsed.length);
}

test "COTP Data" {
    const cotp = CotpData.init(true);
    try testing.expect(cotp.is_eot());

    var buf: [3]u8 = undefined;
    try cotp.to_bytes(&buf);

    const parsed = try CotpData.from_bytes(&buf);
    try testing.expect(parsed.is_eot());
}

test "COTP Connect" {
    const src_tsap = [_]u8{ 0x01, 0x00 };
    const dst_tsap = [_]u8{ 0x01, 0x02 };

    const cotp = CotpConnect.init_request(&src_tsap, &dst_tsap, 10);
    try testing.expectEqual(@as(u8, PduType.CR), cotp.pdu_type);

    const bytes = try cotp.to_bytes(testing.allocator);
    defer testing.allocator.free(bytes);

    try testing.expect(bytes.len >= 7);
    try testing.expectEqual(bytes[0], cotp.header_length);

    // Roundtrip
    const parsed = try CotpConnect.from_bytes(testing.allocator, bytes);
    defer {
        if (parsed.src_tsap) |t| testing.allocator.free(t);
        if (parsed.dst_tsap) |t| testing.allocator.free(t);
    }

    try testing.expectEqual(cotp.pdu_type, parsed.pdu_type);
    try testing.expectEqualSlices(u8, cotp.src_tsap.?, parsed.src_tsap.?);
}

test "ISO Data PDU" {
    const payload = [_]u8{ 0x32, 0x01, 0x00, 0x00 };
    const pdu = IsoDataPdu.init(&payload);

    const bytes = try pdu.to_bytes(testing.allocator);
    defer testing.allocator.free(bytes);

    const parsed = try IsoDataPdu.from_bytes(bytes);
    try testing.expectEqualSlices(u8, &payload, parsed.payload);
}
