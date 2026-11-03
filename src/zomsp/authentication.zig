const std = @import("std");

pub const Policy = struct {
    digest: ?[20]u8 = null,
    profile: u32 = 0x300,
    user: ?[32]u8 = null,
    password: ?[32]u8 = null,

    pub fn configure(self: *Policy, password: []const u8) !void {
        if (password.len > 256) return error.PasswordLimit;
        if (self.digest) |*digest| std.crypto.utils.secureZero(u8, digest);
        if (self.user) |*user| std.crypto.utils.secureZero(u8, user);
        if (self.password) |*hash| std.crypto.utils.secureZero(u8, hash);
        self.digest = null;
        self.user = null;
        self.password = null;
        self.profile = 0x300;
        if (password.len != 0) {
            var digest: [20]u8 = undefined;
            std.crypto.hash.Sha1.hash(password, &digest, .{});
            self.digest = digest;
            std.crypto.utils.secureZero(u8, &digest);
        }
    }
};

pub const Session = struct {
    challenge: [20]u8 = @splat(0),
    issued: bool = false,
    attempted: bool = false,
    authenticated: bool = false,

    pub fn issue(self: *Session) void {
        if (self.issued or self.attempted) return;
        std.crypto.random.bytes(&self.challenge);
        self.issued = true;
    }

    fn decrypt(self: *Session, secret: [32]u8, raw: []const u8, output: *[1024]u8) ![]const u8 {
        var reader: @import("wire.zig").Reader = .{ .data = raw };
        if (try reader.byte() != 0 or try reader.byte() != 0x14 or try reader.vlq() != 0) return error.InvalidProof;
        const length = try reader.vlq();
        if (length == 0 or length > output.len or length % 16 != 0) return error.InvalidProof;
        const ciphertext = try reader.take(@intCast(length));
        if (reader.offset != raw.len) return error.InvalidProof;
        var key: [32]u8 = undefined;
        std.crypto.hash.sha2.Sha256.hash(&secret, &key, .{});
        defer std.crypto.utils.secureZero(u8, &key);
        var aes = std.crypto.core.aes.Aes256.initDec(key);
        defer std.crypto.utils.secureZero(u8, std.mem.asBytes(&aes));
        var previous = self.challenge[0..16].*;
        var offset: usize = 0;
        while (offset < ciphertext.len) : (offset += 16) {
            var block: [16]u8 = undefined;
            defer std.crypto.utils.secureZero(u8, &block);
            aes.decrypt(&block, ciphertext[offset..][0..16]);
            for (block, previous, output[offset..][0..16]) |byte, iv, *out| out.* = byte ^ iv;
            previous = ciphertext[offset..][0..16].*;
        }
        const padding = output[ciphertext.len - 1];
        if (padding == 0 or padding > 16) return error.InvalidProof;
        for (output[ciphertext.len - padding .. ciphertext.len]) |byte| if (byte != padding) return error.InvalidProof;
        return output[0 .. ciphertext.len - padding];
    }

    pub fn verifyModern(self: *Session, policy: *const Policy, secret: [32]u8, raw: []const u8) !u64 {
        if (policy.digest == null or policy.profile != 0x400) return error.AuthenticationDisabled;
        if (!self.issued or self.attempted) return 0xa6054c0005b8fea1;
        var plaintext: [1024]u8 = undefined;
        defer std.crypto.utils.secureZero(u8, &plaintext);
        const decoded = try self.decrypt(secret, raw, &plaintext);
        const Reader = @import("wire.zig").Reader;
        var reader: Reader = .{ .data = decoded };
        if (try reader.byte() != 0 or try reader.byte() != 0x17 or try reader.u32be() != 40400) return error.InvalidProof;
        var seen: u3 = 0;
        var kind: u64 = 0;
        var username: []const u8 = &.{};
        var password: []const u8 = &.{};
        while (true) {
            const field = try reader.vlq();
            if (field == 0) break;
            if (field < 40401 or field > 40403) return error.InvalidProof;
            const bit = @as(u3, 1) << @as(u2, @intCast(field - 40401));
            if (seen & bit != 0) return error.InvalidProof;
            seen |= bit;
            if (try reader.byte() != 0) return error.InvalidProof;
            if (field == 40401) {
                if (try reader.byte() != 4) return error.InvalidProof;
                kind = try reader.vlq();
            } else {
                if (try reader.byte() != 0x14 or try reader.vlq() != 0) return error.InvalidProof;
                const length = try reader.vlq();
                if (length > (if (field == 40402) @as(u64, 128) else 256)) return error.InvalidProof;
                const bytes = try reader.take(@intCast(length));
                if (field == 40402) username = bytes else password = bytes;
            }
        }
        if (seen != 7 or reader.offset != decoded.len) return error.InvalidProof;
        var accepted = false;
        if (kind == 1 and policy.user == null and username.len == 0 and password.len == 20) {
            accepted = std.crypto.utils.timingSafeEql([20]u8, policy.digest.?, password[0..20].*);
        } else if (kind == 2 and policy.user != null and policy.password != null) {
            var user_hash: [32]u8 = undefined;
            var password_hash: [32]u8 = undefined;
            defer std.crypto.utils.secureZero(u8, &password_hash);
            std.crypto.hash.sha2.Sha256.hash(username, &user_hash, .{});
            std.crypto.hash.sha2.Sha256.hash(password, &password_hash, .{});
            const user_match = @intFromBool(std.crypto.utils.timingSafeEql([32]u8, policy.user.?, user_hash));
            const password_match = @intFromBool(std.crypto.utils.timingSafeEql([32]u8, policy.password.?, password_hash));
            accepted = (user_match & password_match) != 0;
        }
        self.attempted = true;
        self.issued = false;
        self.authenticated = accepted;
        std.crypto.utils.secureZero(u8, &self.challenge);
        return if (accepted) 0 else 0x26051900092d0016;
    }

    pub fn verify(self: *Session, policy: *const Policy, proof: []const u8) !u64 {
        if (policy.profile != 0x300) return error.AuthenticationDisabled;
        const digest = policy.digest orelse return error.AuthenticationDisabled;
        if (proof.len != 20) return error.InvalidProof;
        if (!self.issued or self.attempted) return 0xa6054c00040afea1;
        var expected: [20]u8 = undefined;
        defer std.crypto.utils.secureZero(u8, &expected);
        for (&expected, digest, self.challenge) |*octet, hash, nonce| octet.* = hash ^ nonce;
        self.attempted = true;
        self.issued = false;
        self.authenticated = std.crypto.utils.timingSafeEql([20]u8, expected, proof[0..20].*);
        std.crypto.utils.secureZero(u8, &self.challenge);
        return if (self.authenticated) 0 else 0x26051900092d0016;
    }
};

test "legacy proof is session bound, single use and bounded" {
    var policy: Policy = .{};
    try policy.configure("example");
    defer policy.configure(&.{}) catch unreachable;
    var first: Session = .{};
    var second: Session = .{};
    first.issue();
    second.issue();
    try std.testing.expect(!std.mem.eql(u8, &first.challenge, &second.challenge));
    var proof: [20]u8 = undefined;
    for (&proof, policy.digest.?, first.challenge) |*octet, hash, nonce| octet.* = hash ^ nonce;
    try std.testing.expectError(error.InvalidProof, first.verify(&policy, proof[0..19]));
    try std.testing.expect(!first.attempted);
    try std.testing.expectEqual(@as(u64, 0), try first.verify(&policy, &proof));
    try std.testing.expect(first.authenticated);
    try std.testing.expectEqual(@as(u64, 0xa6054c00040afea1), try first.verify(&policy, &proof));
    try std.testing.expectEqual(@as(u64, 0x26051900092d0016), try second.verify(&policy, &proof));
    try std.testing.expect(!second.authenticated);
    second.issue();
    try std.testing.expect(!second.issued);
}

test "modern native-format proof is bound to TLS and one challenge" {
    var policy: Policy = .{};
    try policy.configure("disposable-modern");
    defer policy.configure(&.{}) catch unreachable;
    policy.profile = 0x400;
    var secret: [32]u8 = undefined;
    var nonce: [20]u8 = undefined;
    for (&secret, 0..) |*byte, index| byte.* = @intCast(index);
    for (&nonce, 0..) |*byte, index| byte.* = @intCast(index);
    const hex = "001400301276b94e95e6c5a1ca61dd4a75b1976f24eaa60dc0bf653d7f787b8a0e0fa79770ad05fdf296eaa2bcc5ac5ac447fbc8";
    var proof: [hex.len / 2]u8 = undefined;
    _ = try std.fmt.hexToBytes(&proof, hex);
    var session: Session = .{ .challenge = nonce, .issued = true };
    var malformed = proof;
    malformed[3] -= 1;
    try std.testing.expectError(error.InvalidProof, session.verifyModern(&policy, secret, &malformed));
    try std.testing.expect(!session.attempted);
    var different_secret = secret;
    different_secret[0] ^= 1;
    try std.testing.expectError(error.InvalidProof, session.verifyModern(&policy, different_secret, &proof));
    try std.testing.expect(!session.authenticated);
    try std.testing.expectEqual(@as(u64, 0), try session.verifyModern(&policy, secret, &proof));
    try std.testing.expect(session.authenticated);
    try std.testing.expectEqual(@as(u64, 0xa6054c0005b8fea1), try session.verifyModern(&policy, secret, &proof));
    session = .{ .challenge = nonce, .issued = true };
    try policy.configure("wrong-password");
    policy.profile = 0x400;
    try std.testing.expectEqual(@as(u64, 0x26051900092d0016), try session.verifyModern(&policy, secret, &proof));
    try std.testing.expect(!session.authenticated);
}
