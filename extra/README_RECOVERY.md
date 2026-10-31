# Connection and host recovery

z7 accepts a reconnect as a new association. Its connection slot is reused only
after pending I/O has completed. RX/TX state, PDU negotiation, subscription and
alarm delivery cursor are reset. The shared-memory data belongs to the server,
not to a connection, so it survives client disconnects and host stop/start.

The shared-library host must serialize `z7_start`, `z7_stop` and `z7_deinit`, and
must not call them from a server I/O callback. `z7_init` reserves the endpoint and
returns null on failure, releasing acquired resources. `z7_start` starts the worker;
`z7_get_status` reports its running state. On start failure status remains stopped
and the host may retry after the cause is removed. Calling start on a running
context is harmless. An exited worker is joined before a later start.

`z7_stop` closes active associations, drains I/O, discards retained work and releases
the listener. It is safe before the first start or repeatedly. Starting the same
context again creates a listener at the original resolved address. Windows uses
exclusive endpoint ownership; a second server cannot share that listening port.
Deinit also stops the worker before releasing memory and the I/O runtime.

Client reconnect/retry is the client's responsibility. After a failed request,
discard the old socket, retry connection with bounded backoff, perform COTP and
PDU negotiation, then resume reads. Do not automatically replay a write whose
response was lost: it may already have been applied. A partial request that was
never complete is not applied. Re-read data to resolve an uncertain outcome where
the application can do so safely.

Alarm subscriptions belong to each association. After reconnect, query outstanding
alarms and subscribe again. The existing API does not provide an atomic
query-plus-subscribe transaction; consumers needing continuity must reconcile
snapshots and indications. Alarm state survives stop/start of the same context,
but is not persisted across context destruction or process death. Data retained in
the same backing file can be reopened after process death; this is not a
power-loss durability guarantee.

The recovery changes do not add per-request work or tighten accepted S7 types.
They cover observed disconnects, failed startup, stop/start and process restart.
They do not introduce an application heartbeat or change OS TCP failure-detection
timers. A silent network partition can still wait for client/OS timeouts; reconnect
does not by itself provide exactly-once delivery.

Run `python TESTS/test_recovery.py PATH_TO_LIBRARY` and the Ignition harness for
bounded regression tests. The latter uses the original vendor wire codecs with
adapter-owned lifecycle control and retry, rather than a full Ignition gateway.

SPS7 reference: the imported VPLC `Sps7Sap__virt_064` at 0x10525180 delegates
disconnect then invokes queue cleanup at 0x1052b6b0. This supports the teardown
model; it is static implementation evidence, not a live Siemens differential test.
