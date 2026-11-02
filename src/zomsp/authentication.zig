const std = @import("std");

pub const Policy = struct {
    digest: ?[20]u8 = null,

    pub fn configure(self: *Policy, password: []const u8) !void {
        if (password.len > 256) return error.PasswordLimit;
        if (self.digest) |*digest| std.crypto.utils.secureZero(u8, digest);
        self.digest = null;
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

    pub fn verify(self: *Session, policy: *const Policy, proof: []const u8) !u64 {
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
