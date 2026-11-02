The pinned libwrapper_native.so and C probes are the same reference already used
by tia-tools. SHA-256 is verified by run.py before executing either role. A generated test
copy clears only PT_GNU_STACK PF_X for current Ubuntu/glibc loaders; the checked-in
vendor binary stays unchanged. The child runner pins the normalized hash too.

Linux x86-64 only. Run from the repository root:
  python TESTS/omsp/native/run.py --binary zig-out/bin/zOMSp --cc ./zig/zig

This compiles the probes, creates disposable test credentials, and requires both
zOMSp client -> native server and native client -> zOMSp server to pass TLS login
and role read/write/readback. The preload shim redirects native TCP port 102 to
loopback port 30202 without elevated privileges. JSON evidence includes logs.
