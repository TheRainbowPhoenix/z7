const std = @import("std");

pub const frame_limit = 65535;
pub const Kind = enum { connect, confirm, data, omsp, tls };

pub fn frameSize(header: []const u8) !usize {
    if (header.len < 4) return error.Truncated;
    if (header[0] != 3 or header[1] != 0) return error.InvalidTpkt;
    const length = std.mem.readInt(u16, header[2..4], .big);
    if (length < 7) return error.InvalidLength;
    return length;
}

pub fn classify(frame: []const u8) !Kind {
    if (try frameSize(frame) != frame.len) return error.InvalidLength;
    const cotp_size = @as(usize, frame[4]) + 1;
    if (cotp_size < 3 or cotp_size > frame.len - 4) return error.InvalidCotp;
    switch (frame[5] & 0xf0) {
        0xe0, 0xd0 => {
            if (cotp_size < 7) return error.InvalidCotp;
            return if (frame[5] & 0xf0 == 0xe0) .connect else .confirm;
        },
        0xf0 => {},
        else => return error.UnsupportedCotp,
    }
    const payload = frame[4 + cotp_size ..];
    if (payload.len == 0) return .data;
    if (payload[0] == 0x72) {
        if (payload.len < 4 or payload[1] < 1 or payload[1] > 4) return error.InvalidOmsp;
        return .omsp;
    }
    if (payload[0] >= 0x14 and payload[0] <= 0x17) return .tls;
    return .data;
}

test "bounded TPKT and OMSp classification" {
    const testing = std.testing;
    try testing.expectError(error.Truncated, frameSize(&.{3}));
    try testing.expectError(error.InvalidLength, frameSize(&.{ 3, 0, 0, 6 }));
    try testing.expectError(error.InvalidTpkt, frameSize(&.{ 3, 1, 0, 7 }));
    try testing.expectEqual(Kind.omsp, try classify(&.{ 3, 0, 0, 11, 2, 0xf0, 0x80, 0x72, 1, 0, 0 }));
    try testing.expectEqual(Kind.tls, try classify(&.{ 3, 0, 0, 8, 2, 0xf0, 0x80, 0x17 }));
    try testing.expectError(error.InvalidCotp, classify(&.{ 3, 0, 0, 7, 9, 0xf0, 0x80 }));
}
