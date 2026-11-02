# zOMSp reference interoperability

Build with Zig 0.14.1:

```sh
zig build zomsp test:zomsp
zig build zomsp -Dtarget=x86_64-windows
```

The separate `zOMSp` binary has three modes:

```sh
zOMSp LISTEN_PORT UPSTREAM_IPV4 UPSTREAM_PORT
zOMSp --server PORT CERT_PEM KEY_PEM TLS_LIBRARY
zOMSp --client IPV4 PORT CERT_PEM TLS_LIBRARY
```

Listeners bind to loopback. The default proxy forwards bounded TPKT/COTP frames,
including encrypted traffic, using z7's asynchronous I/O layer (io_uring on Linux,
IOCP on Windows). It does not terminate TLS.

The endpoint modes implement OMSp in Zig. They use a C bridge solely for the
OpenSSL API; no Siemens protocol functions or private native offsets implement
their requests. `TLS_LIBRARY` can be the reference `libwrapper_native.so`, whose
exported OpenSSL implementation was tested, or a compatible OpenSSL library.
The client requires TLS 1.3, verifies the certificate and IP address, and pins the
provided leaf certificate. The server requires StartTLS before session creation.

The implemented subset covers COTP connection, StartTLS, CreateObject session
creation, version/role setup, session ping, reading session capabilities and
Role, and the Role 2 -> 32 write/readback. It supports the observed V1 creation
and V2 compact replies. Read and write integrity counters are independent of
the message sequence. Qualifiers, lengths, counters, value recursion and
collection sizes are bounded and checked.

Endpoint servers currently use at most 16 blocking workers, socket deadlines and
128 requests per connection. This is an interoperability baseline; the endpoint
engine has not yet been moved onto the asynchronous proxy machinery or benchmarked.
Arbitrary PLC objects, program transfer, subscriptions, password authentication,
and complete V3 negotiation are not implemented.

DeleteObject is sent before closing the client transport. The test does not
assert an acknowledged graceful session deletion. The native implementation
handles self-session deletion through special callbacks and SAP shutdown, rather
than an ordinary request/reply exchange; reproducing that lifecycle remains work.

The repeatable native/Python/Zig pipeline and its compact results live in
`tia-tools/sps7/native/omsp_capture_analysis/PORTING_PIPELINE.md` and
`porting_results.json`. Linux runtime interoperability was tested under WSL;
Windows client/server runtime tests now also pass through the Python pivot,
using a matched OpenSSL SSL/crypto DLL pair. See `OPERATIONS_AUDIT.md` and
`operations_audit_results.json` in that directory for current coverage and gaps.
