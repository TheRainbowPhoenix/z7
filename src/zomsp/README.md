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
- Explore with bounded recursion, attribute selection, up to ten filters, and
  mapped ancestor serialization. Scalar comparisons support equality/ordering;
  class filters match exact mapped class IDs (no synthesized inheritance).
  Combining WithParent and filters is rejected. Explicit GetLink associations
  and best-effort BeginSequence/EndSequence remain available. The tested native
  class 255 container does not serialize itself during Explore.
- Registered application Invoke methods: 32 methods, two bounded sparse input
  lists, 8192-byte validated result and preserved host status. Register using
  `zomsp_method` before starting/opening sessions. Callbacks may run concurrently;
  the host owns authorization, callback lifetime and atomic application effects.
  Invalid callback results are rejected, but host side effects cannot be undone.
- Opt-in collective transactions (`zomsp_transactions`): StartTransaction's
  class-1700 descriptor, transaction RID result, isolated mapped reads/writes,
  commit, abort and disconnect rollback. Publishing checks the original mapping's
  generation and fails on host conflicts. Notifications pause during a collective.
  Invokes and control-plane mutation are rejected inside it. There are at most
  2047 collective starts per connection; reconnect after exhaustion.
- Opt-in legacy password profile (`zomsp_legacy_password`), explicitly advertised
  as version 0x300. The TLS endpoint verifies SHA-1 digest XOR challenge, consumes
  the nonce once, gates mapped application operations until authenticated and
  reports access level 1/4. A failed attempt requires a new session. The digest
  is held outside shared memory. Headless dispatch is a trusted transport API;
  its caller must provide confidentiality.
- Modern TLS credentials (`zomsp_password`) and one named UAC account
  (`zomsp_user_password`): native structure 40400, types 1/2, exporter label
  `EXPERIMENTAL_OMS`, SHA-256-derived AES-256-CBC key, challenge IV and single-use
  proof. Passwords/usernames are bounded to 256/128 bytes; only hashes remain in
  the context. The network endpoint binds verification to its own TLS connection.
  Native SDK and Python tests cover correct/incorrect credentials and application
  access. Named-user SDK return status alone is insufficient: inspect the granted
  access level. Account administration, password changes, and token login are
  outside this single-account proxy policy.
- Native UploadWithoutStreamedBlobs over a best-effort sequence, including the
  internal Explore filter 11. The mapped backend supplies inline values; this
  does not activate or compile PLC programs.
- Windows and Linux live TLS tests, independent mapping visibility, restart and
  partial-handshake cancellation. Native client checks cover mapped read/write,
  subscription callbacks, Explore, GetLink, and best-effort sequence completion.
  An eight-session run checks 4000 application requests with exact readbacks.

## Remaining protocol work

Typed ASOM alarm event execution/AckJob acknowledgement, upload activation
(including DLTransaction AID 1702 directives) and full V3 security negotiation
remain unsupported. Collective success
only commits the mapped application model; it does not compile or activate PLC
programs. Unsupported activation directives are rejected. Unknown Invoke keeps
the native error instead of inventing PLC data. Unauthorized operations fail
closed; access-denied status translation is not claimed as native parity.

Native SDK tests validate registered Invoke results, matching/nonmatching filters,
mapped ancestors, sequenced upload, collective isolation/commit/abort, and legacy
and modern password/UAC success and rejection. The SDK's generic BeginSequence(type=2) fails locally; proper
StartTransaction sends a class-1700 descriptor. The bare native server rejects
that descriptor without an application transaction implementation. Our mapped
transaction backend is explicit opt-in application behavior.

## CI and local checks

CI builds x64 Linux, ARM64 Linux and Windows, tests the mapped and protocol ABIs,
then bundles the runner's matching libssl/libcrypto pair, license and SHA-256
manifest. A standard-library Python TLS test loads that bundled pair and checks
verified login and mapped reads/writes. Supply both `ZOMSP_TEST_CERT` and
`ZOMSP_TEST_KEY` to reuse test credentials on machines without an openssl CLI.

```
python TESTS/omsp/mapped.py zig-out/lib/libzomsp.so
python TESTS/omsp/wire.py zig-out/lib/libzomsp.so
python TESTS/omsp/invoke.py zig-out/lib/libzomsp.so
python TESTS/omsp/transactions.py zig-out/lib/libzomsp.so
python TESTS/omsp/authentication.py zig-out/lib/libzomsp.so
python TESTS/omsp/package_runtime.py zig-out/bin
python TESTS/omsp/tls.py zig-out/lib/libzomsp.so zig-out/bin
```

The native oracle and live Python interoperability runner reside in tia-tools
under `sps7/native/omsp_capture_analysis`; its reports distinguish native checks
from application-model-only tests.

## Authenticated client

The executable client uses `ZOMSP_PASSWORD` and optional `ZOMSP_USERNAME` for
modern TLS password/UAC login. Set them in the launching process environment,
then run `zOMSp --client HOST PORT TRUSTED_CERT LIBSSL`. Credentials are bounded,
never printed, and password buffers are cleared after use. A login must grant
access level 1 before the client performs its read/write/readback roundtrip.
Incorrect passwords and unknown usernames fail the client process.

The bundled TLS test now exercises authenticated zOMSp client/server pairs on
Windows, Linux x64 and Linux ARM64 in CI. The x64 native-reference job additionally
uses the native SDK against zOMSp's modern/password and UAC server profiles.
Python client usage and its optional TLS exporter dependencies are documented in
tia-tools at `sps7/s7commplus/omsp/MODERN_CLIENT.md`.
