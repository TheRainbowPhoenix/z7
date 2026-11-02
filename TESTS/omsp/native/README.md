The pinned libwrapper_native.so and C probes are the same reference already used
by tia-tools. SHA-256 is verified by run.py before executing either role.

Linux x86-64 only. Run from the repository root:
  python TESTS/omsp/native/run.py --binary zig-out/bin/zOMSp --cc ./zig/zig

This compiles the probes, creates disposable test credentials, and requires both
zOMSp client -> native server and native client -> zOMSp server to pass TLS login
and role read/write/readback. The preload shim redirects native TCP port 102 to
loopback port 30202 without elevated privileges. JSON evidence includes logs.
