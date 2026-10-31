# Classic S7 ALARM_8

The server implements a bounded ALARM_8 profile over classic S7comm (protocol ID 0x32).
Use the library API to produce alarms from your simulation; TCP clients subscribe and
acknowledge/query them. This does not add S7commPlus or S7-1500 native alarming.

## Produce alarms

Rebuild the library and restart its host process. In the Python server wrapper:

```python
from extra.client import Z7Client

server = Z7Client("zig-out/bin/z7.dll", port=1102)  # Linux: zig-out/lib/libz7.so
server.start()
try:
    server.set_alarm(1001, 0b00000001)  # SIG_1 comes in.
    server.set_alarm(1001, 0b00000101)  # SIG_3 also comes in.
    server.clear_alarm(1001)          # Both signals go out.
finally:
    server.close()
```

In a real application keep the server running while clients receive/acknowledge events.
Use stable IDs: each nonzero uint32 event ID represents eight independent signals.
An update with the same signals emits no duplicate. Clearing an unknown ID is a no-op.

C ABI:

```c
int32_t z7_alarm_set(Context *context, uint32_t event_id, uint8_t signals);
```

Returns 0 for success, -1 for null context/zero ID/unrepresentable clock time,
-2 when all 64 alarm IDs are allocated, and -3 for sequence exhaustion.
The Python wrapper validates integer ranges before ctypes conversion.
Updates are mutex-protected and may come from producer threads while the server runs.
The caller must keep the context alive; do not race stop/deinit/close with lifecycle
operations or call lifecycle functions from server callbacks.

A standalone executable has the same wire handlers, but does not itself generate alarms.
Use the library host API to connect your simulation's conditions to alarm signals.

## Wire services

| CPU userdata subfunction | Support |
|---|---|
| 0x02 message service | ALARM_INITIATE (5) / ALARM_ABORT (4), events mask 0x80 |
| 0x05 | Unsolicited ALARM_8 indications, eight signal bits, UTC BCD timestamp |
| 0x0B | One or multiple acknowledgement objects, per-item results |
| 0x0C | Acknowledgement indications to all current subscribers |
| 0x13 | Outstanding alarms by type 2 (ALARM_8) or by nonzero event ID |

A subscription is owned by its TCP connection. New subscriptions start at the current
event position; use a query to retrieve already outstanding alarms. Duplicate subscribe
requests preserve the cursor. Abort/disconnect clears the subscription. Alarm state is
global: an acknowledgement from one client is visible to all clients.

Coming and going transitions each require acknowledgement. Fully cleared and acknowledged
alarms are omitted from queries, but their ID slots remain allocated until context
destruction. Alarm state is in memory, persists across stop/start, and is not persisted
to disk. Indications contain no associated values in this profile.

Requests require the standard userdata parameter header (8 bytes, or an unfragmented
12-byte request), request method 0x11, CPU request group 0x44, and an exact
FF/09/byte-length data envelope. Entire acknowledgement batches are parsed before
changing state. Unsupported services/types return 0x8702; invalid requests return
0x0112. An unavailable acknowledgement item returns 0x0A.

## Bounds and overload policy

- 64 stable alarm IDs; eight signals each.
- 256 transition/acknowledgement events in a shared circular log.
- Four fixed transmit buffers per connection, separate from the response builder.
- One event per subscribed connection per IO-loop poll; all socket state belongs to
  the IO owner. Producers only touch the mutex-protected alarm store.
- A connection that falls more than 256 events behind is shut down. It must reconnect,
  subscribe and query. It is never silently moved forward over missing transitions.
- TCP reads accumulate short headers/bodies. Sends complete partial writes before
  releasing a queue slot. Reads pause when the transmit queue fills.
- Setup negotiates at most 960 bytes and honors proposals of at least 240 bytes.
  Alarm responses/indications fit that budget.
- Query snapshots are never truncated. If the snapshot does not fit the negotiated
  PDU, the server returns 0x8301; query individual IDs instead. Fragmented alarm
  requests and query-response continuation are not implemented.
- The eight-byte S7 timestamp represents UTC years 1990..2089. Updates outside that
  window return an error.
- Alarm work allocates no heap memory after context initialization.

Lock/unlock, ALARM_S/SQ, NOTIFY, diagnostic subscriptions, mode transitions, associated
values, historical queries and S7commPlus are not implemented by this profile.
This profile has raw-wire and decoder validation, not live Siemens/HMI certification.

## Validation

```bash
zig build test
python TESTS/test_alarms.py /absolute/path/to/z7.dll
python TESTS/test_shared_library.py /absolute/path/to/z7.dll
# Alpine: pass /absolute/path/to/libz7.so instead.
```

The unit suite exercises state transitions, duplicate suppression, capacity/sequence
limits, slow consumers, timestamp boundaries, parser truncation/trailing data, random
malformed payloads and partial-send queue behavior. Integration tests exercise two
subscribers, coming/going ACKs, queries, concurrent producers, subscription cleanup,
fragmented TCP input, invalid packets, small-PDU errors and connection recovery.

The test harness runs native code in a child process with a deadline. Both Windows
and Alpine WSL have been exercised. Captured response layouts were also decoded with
Wireshark/tshark without malformed-packet warnings.

Protocol reference:
[Wireshark S7comm decoder](https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-s7comm.c).
Safety/design conventions:
[TigerStyle](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md).
