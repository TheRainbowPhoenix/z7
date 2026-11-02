# zOMSp mapped application endpoint

`zig build zomsp test:zomsp -Doptimize=ReleaseSafe` builds the proxy executable,
the endpoint executable, `zomsp.dll` / `libzomsp.so`, and `include/zomsp.h`.
The existing asynchronous forwarding mode preserves upstream packets and errors.
`--server PORT CERT KEY TLS_LIBRARY [SHM_FILE]` runs the independent endpoint;
its current implementation uses at most 16 connection threads on loopback.

The application supplies objects and encoded OMSp PValues. The endpoint does not
populate PLC memory or infer successful PLC job results.

```
zOMSp LISTEN_PORT UPSTREAM_IPV4 UPSTREAM_PORT
zOMSp --server PORT CERT_PEM KEY_PEM TLS_LIBRARY [SHM_FILE]
zOMSp --client IPV4 PORT CERT_PEM TLS_LIBRARY
```

Forwarding uses z7's io_uring / IOCP layer without terminating TLS. Independent
endpoints use Zig protocol code and a C bridge solely for OpenSSL. They require
StartTLS and TLS 1.3; the client verifies the IP address and certificate and pins
the supplied leaf certificate. No Siemens protocol functions implement endpoint
requests. Read/write integrity counters are independent of message sequence.

## Shared data and headless API

Use `TESTS/omsp/mapped.py:Store` as a small ctypes example. Open a file with
`zomsp_open`, populate it with `zomsp_object` and `zomsp_set`, and start serving
with `zomsp_start`. Port zero selects an available port, returned by `zomsp_port`.
Another process can open the same file and publish changes. Network writes
update that same file. Stop is synchronous and repeatable; close stops first.
Serialize lifecycle calls and close all session handles before their context.

`zomsp_session_open`, `zomsp_dispatch`, and `zomsp_poll` expose the protocol engine
without sockets, useful for embedding, replay, and Python-driven simulations.
Dispatch and poll require a 65535-byte output buffer and serialized calls on each
session. Negative returns indicate a rejected operation, not an OMSp success.

The little-endian ABI is version 1, magic `zOMSp001`, size 539712 bytes:

| Region | Elements | Element bytes |
| --- | ---: | ---: |
| Header | 1 | 64 |
| Objects | 128 | 24 |
| Values / associations | 512 | 1048 |

Objects hold RID, parent RID, class RID, flags, and generation. Values hold RID,
AID, length, flags, generation, and up to 1024 encoded bytes. Value flags are
0 for read-only, 1 for writable, and 2 for an explicit association. Header counts
and generations change under a process file lock. Use the API for mutation;
uncoordinated raw mmap writes bypass those locks. Existing malformed files are
rejected rather than overwritten. Busy network operations retry for at most one
second; headless dispatch returns -6 for contention.

Call `zomsp_template` on a host-populated object to explicitly allow creation of
its class. New objects copy its declared defaults; supplied attributes must
already exist, be writable, and have the same type. Structure class IDs are part
of the type. A request can create at most eight nested objects with 32 attribute
overrides. Validation and allocation checks precede mutation. Templates cannot
be changed or deleted by network clients. Assigned application RIDs increase
within `0x60000000..0x6fffffff`; deletion does not recycle a RID. The next RID
is stored in the first four reserved header bytes.

`zomsp_link` declares an association with up to 16 existing target objects.
GetLink returns its RID list. Deleting a subtree removes its values and cleans
incoming associations. Undefined associations retain the observed native error.

## Implemented and verified

- RID/AID addressing, multi-object address lists, and up to three nested struct
  path elements for reads and writes. Multi-writes validate the entire batch
  before mutation. Nested writes detect concurrent host changes.
- GetVarSubStreamed, GetMultiVariables, SetVariable, SetMultiVariables, and
  SetVarSubStreamed. Scalar, numeric array, sparse variant, blob, string, and
  unpacked structure values are bounded. Packed structures are preserved as
  opaque encoded values; their PLC layout is not synthesized.
- Four subscriptions per connection, 64 references each, initial/value/change
  notifications, cyclic heartbeat, absolute credit renewal through AID 1053,
  disable/re-enable and deletion. Python decodes typed notification records;
  the Zig client separates unsolicited frames into a bounded queue, with an
  explicit overflow error.
- Explore with bounded recursion and attribute selection, explicit GetLink
  associations, and best-effort BeginSequence/EndSequence. Explore filters and
  ancestor serialization are not yet implemented. The tested native class 255
  container does not serialize itself during Explore.
- Windows and Linux live TLS tests, independent mapping visibility, restart and
  partial-handshake cancellation. Native client checks cover mapped read/write,
  subscription callbacks, Explore, GetLink, and best-effort sequence completion.
  An eight-session run checks 4000 application requests with exact readbacks.

## Remaining protocol work

This is not complete OMSp PLC application support. Typed values and changes can
carry host-provided alarm data, but ASOM alarm event lifecycle and AckJob execution
are not implemented. Generic Invoke handlers, collective transactions, full
sequence/upload activation, filtered Explore, and full V3 endpoint behavior also
remain, as does password authentication. Clients currently send DeleteObject and
close their transport without waiting for a deletion acknowledgement. The bare
native host did not successfully complete the collective
transaction/application-create/Invoke probes; those are unresolved reference
tests, not evidence that real PLCs lack these operations. The forwarding proxy
continues to transport such operations to an actual upstream implementation.

## CI and local checks

CI builds x64 Linux, ARM64 Linux and Windows, tests the mapped and protocol ABIs,
then bundles the runner's matching libssl/libcrypto pair, license and SHA-256
manifest. A standard-library Python TLS test loads that bundled pair and checks
verified login and mapped reads/writes. Supply both `ZOMSP_TEST_CERT` and
`ZOMSP_TEST_KEY` to reuse test credentials on machines without an openssl CLI.

```
python TESTS/omsp/mapped.py zig-out/lib/libzomsp.so
python TESTS/omsp/wire.py zig-out/lib/libzomsp.so
python TESTS/omsp/package_runtime.py zig-out/bin
python TESTS/omsp/tls.py zig-out/lib/libzomsp.so zig-out/bin
```

The native oracle and live Python interoperability runner reside in tia-tools
under `sps7/native/omsp_capture_analysis`; its reports distinguish native checks
from application-model-only tests.
