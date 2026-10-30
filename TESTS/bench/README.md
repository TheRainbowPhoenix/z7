# Linux S7 performance measurements

Run against a matching ReleaseSafe Linux shared library with Python 3 and GCC:

```sh
python3 TESTS/bench/run.py --library /absolute/path/libz7.so --output /tmp/z7-bench
```

The runner starts an isolated z7 context with a temporary, local shared-memory file.
A separate native C client performs COTP/PDU negotiation, warms each connection
with 1,000 reads, and measures synchronous S7 request/response cycles. It checks
response framing, references, per-item results and readback bytes. TCP_NODELAY is
enabled; no packet tracing or per-request formatting runs during measurements.
Each item carries four bytes. Each connection has one outstanding request,
consistent with negotiated AMQ=1. Mixed mode alternates reads and writes.

Defaults: 1/4/16 clients, 10,000 measured requests per client, three repetitions,
single-item read/write/mixed and 16-item read/write. Results include throughput,
exact measured latency percentiles, client CPU time and server-host CPU time.
The JSON file is written even if a later case fails. Cases have 120-second deadlines.
Server-host CPU includes setup and warmup; throughput/latencies exclude them.
The load generator shares the machine, so these are end-to-end loopback results,
not an independent measurement of maximum server throughput.

Optional controls:

```sh
# Separate server and client onto allowed CPUs (optional; not universally faster).
python3 TESTS/bench/run.py --library /absolute/path/libz7.so --output /tmp/z7-pinned \
  --server-cpu 0 --client-cpu 1 --clients 1,16 --cases read:1,write:1

# Simulate a cooperating shared-memory user: lock for 10 ms, release for 10 ms.
python3 TESTS/bench/run.py --library /absolute/path/libz7.so --output /tmp/z7-contended \
  --lock-hold-ms 10 --clients 16 --cases write:1

# Syscall counts; do not use traced timings as performance results.
strace -f -c -e trace=io_uring_enter,flock python3 TESTS/bench/run.py \
  --library /absolute/path/libz7.so --output /tmp/z7-syscalls \
  --clients 1 --requests 1000 --repeats 1 --cases read:1,write:1
```

CPU sampling, if supported by the host:

```sh
perf record -F 199 -e cpu-clock --call-graph dwarf -- \
  python3 TESTS/bench/run.py --library /absolute/path/libz7.so \
  --output /tmp/z7-profile --clients 16 --requests 20000 --repeats 1 --cases read:1,write:1
perf report --stdio --no-children -g none --comms python3 --sort dso
```

Run unprofiled trials separately, alternate candidates and baselines, and compare
multiple repetitions. WSL scheduling and host load can materially change results.

## Measured on 2026-10-30

Baseline: commit f05e817, Zig 0.14.1 ReleaseSafe musl shared library, Alpine under
WSL2, Linux 6.6.87.2-microsoft-standard-WSL2, two visible logical CPUs, local /tmp
storage. The table gives medians across three unprofiled, unpinned repetitions.
Latency is complete TCP request/response latency observed by the native client.

| Clients | Request | Requests/sec | p50 | p99 |
|---|---|---:|---:|---:|
| 1 | Read, 1 item | 15,382 | 56.6 us | 139.3 us |
| 1 | Write, 1 item | 15,014 | 57.4 us | 140.0 us |
| 4 | Read, 1 item | 61,350 | 55.0 us | 171.3 us |
| 16 | Read, 1 item | 72,528 | 199.4 us | 438.2 us |
| 16 | Write, 1 item | 64,908 | 230.2 us | 487.9 us |
| 16 | Read, 16 items | 67,871 | 218.8 us | 673.8 us |
| 16 | Write, 16 items | 60,583 | 244.2 us | 530.0 us |

The last two cases deliver about 1.09 million item reads/sec and 969,000 item
writes/sec. This is item throughput, not requests/sec or bytes/sec. Protocol
correctness and the full Java integration tests remain separate regression checks.

### What limits this workload

1. Kernel networking/scheduling dominates the sampled server process. One CPU-clock
   profile of the buffered-receive experiment attributed approximately 89.5% of
   samples to the kernel and 2.6% to libz7. TCP wakeups, network-stack processing,
   spin locks and io_uring submission/wait paths appeared in the stacks. This is
   a WSL-specific observation, not a universal Linux CPU breakdown.
2. The current receive path submits separate header and body reads for each TPKT.
   A buffered stream parser reduced io_uring_enter calls from 12,069 to 8,072
   for the same small traced workload (roughly one third). Initial throughput
   results varied; alternating CPU-pinned trials still included batched-read
   regressions. The experiment was not retained in production. Fewer syscalls
   alone did not establish a reliable throughput/latency improvement.
3. Every write takes/relinquishes a whole-file flock, synchronously on the I/O
   thread. An isolated no-lock diagnostic improved 16-client single-item write
   throughput from about 76,300 to 80,251 requests/sec, roughly 5%. No lock bypass
   is included in the server or benchmark. Removing these locks would change the
   shared-memory cooperation contract.
4. Lock contention is a much larger tail-latency problem. With simulated 1 ms
   holds, 16-client write p99 was about 1.61 ms; 10 ms holds increased it to
   10.52 ms, versus 0.55 ms without contention in the corresponding fixture.
   Because acquisition blocks the one I/O thread, an external holder can also
   delay unrelated clients. Only cooperating participants obey flock; ordinary
   reads currently do not take this lock.

### Improvement order

- Batch useful data into each PDU. Adjacent byte-block reads reduce descriptors
  further. The Java driver's optimizer already provides byte-block grouping;
  application polling patterns should preserve that benefit. Avoid unnecessary
  connection churn and excessive polling for unchanged data.
- Keep cooperating shared-memory critical sections short. A nonblocking/deferred
  acquisition path could protect other clients from lock contention, but requires
  bounded pending-write state, fair retries and lifecycle tests. A server-owned
  memory mode could avoid external locks only with an explicit ownership contract.
- Next test io_uring submission/wakeup batching and completion-wait overhead,
  then multishot receives/provided buffers. The current timed loop creates timeout
  SQEs repeatedly while processing traffic. Changes must preserve stop/restart,
  alarm scheduling, fairness, partial transfers and bounded backpressure.
- Test SQPOLL or busy polling only as opt-in experiments on a machine with spare
  cores. They spend CPU to reduce wakeups and may hurt a two-vCPU workload.
- Re-evaluate larger structural changes on native Linux and over a real network.
  Tiny-response zero-copy and parser micro-optimizations have lower priority
  given this profile; their benefit has not been measured here.

`TESTS/test_stream.py` adds a regression for fragmented headers/bodies, coalesced
frames, bounded response-queue backpressure, response ordering and invalid TPKT
lengths. Its deliberately oversized outstanding-job burst is a robustness probe,
not a claim that the server negotiates a larger AMQ window.

## Deferred writes and bounded completion waits

The follow-up implementation keeps lock acquisition nonblocking on both platforms:
Linux uses `LOCK_NB`; Windows uses `LOCKFILE_FAIL_IMMEDIATELY`. A contested write
retains one validated request of at most 960 bytes per connection and pauses that
connection's next receive. The I/O owner retries pending writers in round-robin
order, at most once per millisecond, with at most eight requests per acquisition.
Other readers, new connections and alarm work keep progressing. A one-second wait
expires with an explicit S7 resource error (0x8301), without later applying the write.
Stop/disconnect cleanup cancels retained work; no producer-owned buffers are borrowed.

On Linux with IORING_FEAT_EXT_ARG, the loop now submits and waits for one completion
batch with a kernel deadline instead of adding timeout SQEs on every pass. Submission
accounting uses the consumed SQ head even on an interrupted wait. Kernels without
that feature retain the prior path; the fallback is explicitly exercised by the IO
regression executable. Absolute fallback deadlines also normalize nanoseconds across
second boundaries. This does not enable SQPOLL or busy polling.

Windows similarly returns after one IOCP batch/deadline. This host's idle IOCP
`timeout=1 ms` waits measured about 15.6 ms at the default timer resolution. While
one-millisecond retries are needed, Windows requests a one-millisecond timer period,
keeps it for a 50 ms quiet grace period and balances the request on stop/deinit.
Failure to obtain finer resolution retains correct, coarser scheduling. Finer timer
resolution can increase scheduling/power costs while active. Its process/global and
Windows 11 visibility behavior follows [Microsoft's API documentation](https://learn.microsoft.com/en-us/windows/win32/api/timeapi/nf-timeapi-timebeginperiod).

Three alternating baseline/candidate rounds on the same Alpine/WSL host produced
these medians (fresh comparisons, so baseline differs from the earlier table):

| Case | Before | After |
|---|---:|---:|
| 1 client, single-item read p50 | 60.9 us | 50.9 us |
| 1 client, single-item read throughput | 14,745 req/s | 17,512 req/s |
| 16 clients, single-item read throughput | 77,161 req/s | 79,773 req/s |
| 16 clients, single-item write throughput | 71,340 req/s | 69,465 req/s |
| 16 mixed reader/writer clients, 10 ms holder: reader p99 | 10,536 us | 335 us |
| Same contended case: writer p99 | 10,534 us | 10,482 us |
| Same contended case: combined throughput | 41,887 req/s | 57,905 req/s |

The large gain is reader isolation under contention. Writes still wait for a
cooperating holder; high-concurrency uncontended throughput changes were small and
mixed. These are WSL results, not native-Linux/bare-metal performance promises.
`mixed_clients:1` assigns odd clients to writes and even clients to reads; its
JSON reports separate read/write p99 latencies. All clients have finite work, so
readers and writers may finish at different times.

Native Windows original-Java-driver load medians were 5,182 ms before and 5,010 ms
after for 320,000 requests: a small difference. With the same-host 10 ms lock fixture,
32,000 requests took about 21 seconds before finer retry timing and 1.5 seconds
after. This last fixture runs in the same process, so its own wait granularity also
changes; it is integration evidence, not an isolated cross-process speedup claim.
Native Windows and Alpine both passed independent-reader/accept, timeout/no-late-
mutation and stop/restart tests while a file lock was held, plus the Java read/write,
alarm and concurrency suites.

```sh
python3 TESTS/bench/run.py --library /absolute/path/libz7.so --output /tmp/z7-mixed \
  --clients 16 --cases mixed_clients:1 --lock-hold-ms 10
python3 TESTS/test_deferred_writes.py /absolute/path/libz7.so
```

CI runs the contention regression and an additional original-driver run with
`--lock-hold-ms 10 --load-iterations 1000` on Windows and Ubuntu. `zig build test`
also executes bounded-wait checks, including more operations than SQ slots and
forced legacy Linux waiting. Linux validation here used Alpine/WSL; Ubuntu CI
provides a separate non-WSL kernel environment.
