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

The default suite also uses native -> native as an oracle for unknown-method
Invoke (0x8020ab00199afff4), verifies a follow-up ping, and compares session
Explore with/without WithParent in both native and zOMSp servers. Seven role/
Explore combinations must pass. This does not claim successful application
method execution, filtered Explore, or PLC collective/alarm/authentication parity.
