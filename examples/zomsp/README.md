# Drive zOMSp from Python or Deno

Both sides use the **zOMSp shared library**. Your host owns values and program
execution; Zig handles TCP, verified TLS, sessions and upload assembly. These
examples do not launch the CLI or implement OMSp in the host language.

Build: `zig build zomsp -Doptimize=ReleaseSafe`. Windows library:
`zig-out/bin/zomsp.dll`; Linux: `zig-out/lib/libzomsp.so`. Bundle matching OpenSSL
with `python TESTS/omsp/package_runtime.py zig-out/bin`. Use its libssl path and
a PEM certificate/key whose SAN includes `IP:127.0.0.1`. Disposable credentials:

```sh
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 1 -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1 -keyout server-key.pem -out server-cert.pem
```

## Python examples

```sh
python examples/zomsp/simple.py --tls-library PATH_TO_LIBSSL --credentials CERT_DIRECTORY
python examples/zomsp/upload.py --tls-library PATH_TO_LIBSSL --credentials CERT_DIRECTORY
```

The first checks named reads/writes. The second uploads `ADD Counter 1\n`,
commits, compiles it on a worker, and checks that Counter advances. Import the
binding from `examples/zomsp/zomsp.py` in your application:

```python
with Server("values.shm") as server:
    server.variable("Counter", 12, writable=False)
    server.variable("Setpoint", 10)
    port = server.start("server-cert.pem", "server-key.pem", tls_library)
    with Client("127.0.0.1", port, "server-cert.pem", tls_library) as client:
        print(client.read("Counter"))
        client.write("Setpoint", 25)
        assert client.read("Setpoint") == 25
```

`read/write` take a name or numeric RID and optional AID (default 42). Names
resolve through recursive Explore/Name(233) under root 201, with ambiguity
rejected. This is application object lookup, not a universal Siemens symbolic
path resolver. Use `read_raw` for other encoded PValues.

Separate processes: start `server.py --tls-library PATH_TO_LIBSSL --credentials
CERT_DIRECTORY`, then `client.py --tls-library PATH_TO_LIBSSL --certificate
PATH_TO_CERTIFICATE`. Both accept `--library` and `--port`.

## Deno examples

Deno 2.9.2 is tested. Use absolute library and certificate paths:

```sh
deno run --allow-ffi --allow-read --allow-write examples/zomsp/server.ts PATH_TO_ZOMSP_LIBRARY PATH_TO_LIBSSL PATH_TO_CERTIFICATE PATH_TO_KEY 1102
```

The Deno application exposes Counter, writable Setpoint, and Uploads. Counter
starts after a client uploads exactly `ADD Counter 1\n` to RID 2000/AID 42:

```python
with Client("127.0.0.1", 1102, certificate, tls_library) as client:
    client.begin()
    client.upload(2000, 42, b"ADD Counter 1\n")
    client.end()
    print(client.read("Counter"))
```

The thread-safe completion callback retains the buffer, queues compilation,
checks every byte, then starts execution. No program file is created. Ctrl+C
stops the server; an optional final argument sets an automatic stop delay in ms.
Run a Deno client against this activated server or the always-counting Python
server:

```sh
deno run --allow-ffi examples/zomsp/client.ts PATH_TO_ZOMSP_LIBRARY PATH_TO_LIBSSL PATH_TO_CERTIFICATE 1102
```

It prints and verifies five increasing values. Network calls use nonblocking
Deno FFI bindings; operations on each connection remain serialized. Shutdown
keeps the event loop available until native callbacks finish.

## Upload completion and ownership

For typed alarms and host-driven acknowledgement, run:

```sh
python examples/zomsp/alarm.py --tls-library PATH_TO_LIBSSL --credentials CERT_DIRECTORY
```

It subscribes, raises a typed DAI, creates an AckJob, executes it on a Python
worker, verifies the changed DAI and job state, then deletes both objects.
See `src/zomsp/README.md` for bounds and the distinction between the demo's
acknowledgement policy and verified PLC behaviour.

Register `server.stream(rid, aid, exact_length, on_complete, validate=None)`
before starting. The callback means the collective **committed**, rather than
merely receiving its last chunk. Abort, conflict, incomplete data and rejection
emit no completion. Validation must not activate external code.

Python receives an owned, seekable `Upload`: put it on a bounded queue, then
consume with `with uploaded:` and normal `read/seek`. The C callback receives a
borrowed immutable buffer: retain before queueing and release after use. Buffers
may outlive the context. Commit generation orders concurrent worker events.
Hosts must bound queues and retained memory; callbacks must return promptly.

Limits: one configured blob/context, length 1..16 MiB, contiguous upload chunks
inside a collective. Inline mmap values remain limited to 1024 bytes. Full
uploads reach the callback transparently across wire chunks. The SDK test hashes
every byte of an 8 MiB LUT and compares five returned REALs against source values.
The original file-backed upload API remains supported.

The C API is declared in `src/zomsp/zomsp.h`. Client handles are blocking:
serialize operations/close and use host workers for asynchronous frontends.
Error -9 preserves a native status and permits recovery; -8 requires reconnect.
Call `client.authenticate(password, username="")` immediately after opening.
Configure a Python server with `server.password(password, username=None)` before
starting.

CI runs Python and Deno FFI client/server checks on Windows, Linux x64 and Linux
ARM64. Linux x64 also checks the library client against the native server.
## V2 discovery and callbacks

Run a self-contained Python server/client demo:

```powershell
python examples/zomsp/discover.py --library zig-out/bin/zomsp.dll --tls-library zig-out/bin/libssl-1_1-x64.dll
```

On Linux use `zig-out/lib/libzomsp.so` and the platform TLS library path.
`discover.py` shows Explore, GetLink, an application method returning 42, and a
subscription delivering a changed Counter. `discover.ts` uses Deno FFI to visit
objects and resolve links through the same C interface.

Python clients offer `explore`, `get_link`, `invoke`, `subscribe`, `next_event`,
`read_path` and `write_path`. Explore returns an object tree with raw encoded
attributes; `decode` converts supported values. `next_event` includes typed
records and credit/phase/sequence metadata. Subscription owners support
`disabled`, `credits` and `close`.

Hosts configure `class_`, `template`, `method` and `sequences` before starting
sessions. Sequence callbacks receive begin/end/disconnect phases and return
native status codes. They own application actions; zOMSp supplies routing and
bounds. C callbacks can run on session threads: synchronize host state and copy
borrowed buffers before returning. Keep each client connection serialized.
