# Ignition Siemens 5.0.1 interoperability harness

Run the supplied, unchanged `driver-siemens-5.0.1.jar` against an isolated z7 library instance.
Requires Java/Javac 11+ and Python 3.9+. No Maven downloads or running Ignition gateway are needed.

## Run

From the z7 repository root, build the current server:

```powershell
zig build -Doptimize=ReleaseSafe
python TESTS/ignition/run.py --driver-jar TESTS/ignition/vendor/driver-siemens-5.0.1.jar --z7-library zig-out/bin/z7.dll
```

For Linux use `zig-out/lib/libz7.so` and a matching Linux JDK. The Java harness itself
was exercised on Windows with JDK 11.0.28; the server's separate alarm/lifecycle tests
were also exercised on Alpine WSL.

Optional `--output PATH` selects the artifact directory (default:
`.zig-cache/ignition-harness`). The runner chooses an available loopback port, compiles
the glue, starts z7 through its C ABI, runs Java in a child process with a 120-second
deadline, then stops the server and removes its fixture memory file. It does not
connect to an existing PLC/server or reuse the user's shared-memory file.

Artifacts:
- `results.json`: cases, driver/library SHA256, loaded class origins, alarm capability
  scan, fixture updates, and every transmitted/received TPKT.
- `java.log`: Java diagnostics.
- `wire.pcap`: actual TPKT payloads wrapped in reconstructed TCP/IP headers for
  Wireshark inspection. This is not an OS-level packet capture.
- `classes/`: compiled harness and dependency stubs.

## What runs from the original JAR

The JAR's COTP/TPKT stack, request factories, address/value-block classes, request
writers, response readers, and ReadResponseHandler perform the protocol operations.
The harness verifies key classes' runtime CodeSource locations and rejects any
dependency stub that would shadow a class in the JAR. The original JAR is read-only,
is included unchanged as the pinned CI fixture in `vendor/`. Its SHA-256 is
`681e85b9082a469a0a735fefe0e4d0f9dee4cccc5940855e700535c89b98c919`.

Stubs supply missing gateway/platform plumbing: driver item interfaces, generic
OPC UA value/status containers, numeric byte conversion, type coercion, logging,
preconditions, a bounded reusable object bag, and byte-array fill. Numeric adapters
support only the types exercised by this test and throw on unsupported conversions.

This is a test of the driver's actual wire codecs and response-to-item handling,
not a complete Ignition gateway installation. The S71500Driver lifecycle, scheduling,
optimizer, OPC UA publishing and gateway licensing infrastructure are not instantiated.
No vendor module-hook or licensing class is replaced or modified.

## Alarm capability is reported separately

The supplied 5.0.1 JAR has no alarm-related classes or constant-pool strings and no
S7 alarm request/response service alongside its connect/PDU/read/write services.
It therefore does not provide a native PLC-alarm subscription API for this harness.

The Java glue includes a separate classic ALARM_8 adapter, using the JAR's framing
stack and common header writer. Its case is named
`alarm_adapter_subscribe_raise_ack_clear_query`; the native capability is explicitly
reported as UNSUPPORTED, independently of the adapter's PASS result.

The adapter subscribes to z7, asks the Python fixture to raise an alarm through the
real C API, receives the wire indication while ordinary driver reads are active,
acknowledges it, clears it, receives/acknowledges the going transition, checks the
outstanding-alarm query, and unsubscribes. Alarm assertions use packets received
over TCP, not the fixture API's return value alone.

This does not establish native Ignition alarm integration or S7commPlus support.
A running Ignition gateway may separately compute its own alarms from polled tags.

## Cases and observed fixes

23 cases cover:
- COTP connection and 480-byte PDU negotiation.
- BYTE, INT, DINT, REAL, WORD, unsigned DWORD wire data, and STRING round trips.
- BIT writes, bit clearing, and preservation of neighboring bits.
- Multi-item writes including mixed BIT/BYTE payloads and odd-length padding.
- Rejection of a write crossing a DB boundary.
- Multi-item reads with odd-length padding.
- The separate alarm adapter.
- Reconnection and 240-byte PDU negotiation.

Initial real-driver testing exposed successful ACKs for no-op BIT writes and a
one-item response to two-item writes. z7 now parses the entire WriteVar payload
before mutation, handles bit masks, applies all items with per-item results, and
checks each mapped area's/DB's 64 KiB boundary. Malformed framing is rejected
before an earlier item's write can be applied. The WriteVar parser has bounded
capacity, truncation tests and random malformed-input coverage.

This is interoperability evidence for these cases, not general CPU conformance
or a replacement for testing within the real Ignition gateway.


## Newer driver capability scan

A local scan of all class names and class constant pools found no `alarm` references
in `siemens-drivers-0.7.8.jar` (233 classes) or
`driver-siemens-7.3.2-SNAPSHOT.jar` (211 classes). Their request factories expose
connection, PDU negotiation, ReadVar and WriteVar; no native alarm subscription,
acknowledgement or query service was found. This is static inspection, not a
runtime interoperability claim for those versions.

## Continuous integration

The `ignition` CI matrix builds the current server on Windows and Ubuntu, runs
native parser, lifecycle and alarm tests, then runs all 23 interoperability cases.
Failures fail CI; JSON results, Java logs and packet captures are uploaded even
when a case fails. The required merge pipeline includes this job.

## Data exchange regression and load coverage

The suite now verifies I/Q/M/DB exchange between separate Java clients, last-byte
access, cross-DB and cross-area rejection, missing-DB errors, mixed successful and
failed items, WORD element counts, packed BIT reads, numeric transport metadata,
exact PDU capacity, maximum-size request batches and recovery after oversized reads.

Normal polling and the load test use the unchanged vendor factories, writers,
readers and ReadResponseHandler. Typed requests the driver does not normally issue
and error responses use an explicit bounded wire-inspection adapter. The vendor
ReadResultReader consumes three bytes for four-byte error results and recognizes
bit-based lengths only for transport 4; that vendor limitation is not changed or
counted as native-driver support for those paths.

The bounded load case runs 16 Java clients, each doing 10,000 two-request cycles:
320,000 read/write requests and 960,000 checked item operations, plus negotiation
traffic. Each cycle exchanges a private DB value, a marker DINT and one shared-byte
BIT. Distinct clients update neighboring bits concurrently. Every readback is checked,
and a final observer checks both shared bytes. Clients use 240/480-byte PDUs and
reconnect nine times each. The test has a 90-second workload deadline within the
runner's 120-second deadline. Per-packet tracing is disabled during load to keep
artifacts bounded; case outcomes and elapsed time remain in java.log. This is a
bounded concurrency regression, not a long-duration soak or throughput benchmark.

Timer/counter execution, CPU simulation, block transfers and S7commPlus are outside
this data-exchange change. Timer/counter-specific wire formats remain unsupported.

## Shared-memory contention

`--lock-hold-ms 10` enables a cooperating file-lock fixture for the Java run.
`--load-iterations 1000` selects a shorter, bounded concurrency case (100..10000,
divisible by ten). Default load coverage remains 320,000 requests. The fixture
uses flock on Linux and LockFileEx on Windows, releases its lock before cleanup,
and records configuration/errors in results.json. CI runs this additional case
on both operating systems. This fixture is in the server host process; Windows
process timer-resolution changes also affect the fixture's own waits.
