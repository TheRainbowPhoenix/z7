# Server reference sweep

This is a partial implementation checkpoint, not complete PLC application parity.

## Validated changes

* Invoke 0x056b uses a fixed-width target/method RID, two sparse Variant argument
  lists, write integrity, and a zero trailer. Inputs are bounded to 16 slots per
  list, reject duplicate slots, and validate all bytes before advancing state.
  Application methods can be registered explicitly. Unknown methods receive native
  0x8020ab00199afff4 instead of disconnecting. Native client parses the reply and
  successfully pings afterwards; the native server returns the same status.
* Explore request order is LinkAID, Recursive, RecursiveFilter, WithParent,
  Filters, Trimmers, integrity, ExclTrimmers, trailer. Previously Recursive was
  required to be 1 and RecursiveFilter incorrectly controlled tree recursion.
  Corrected both. Native session WithParent returns parent RID 285 and no object
  payload; zOMSp matches this and preserves the read counter. Generic mapped
  ancestor serialization is now supported for the mapped application model.
* CI now runs native -> native as an oracle in addition to both zOMSp/native
  directions, and compares session Explore with/without WithParent. Invoke
  rejection and subsequent recovery are exercised in every native-client run.

## Reference anchors (Ghidra addresses)

libwrapper_native.so:
* 0060b900 OMS_ReqExplore_RegisterFields
* 005efd10 OMS_Filter_RegisterFields
* 005f1dd0 OMS_ReqInvoke_RegisterFields
* 005f0970 OMS_ReqBeginSequence_RegisterFields
* 003ba320 OMSpWrapper::Filter::CopyOut: 144-byte wrapper, 32 address slots,
  Value pointer at +0x88. Native filter addresses serialize all 32 slots.
* 003bf2a0 LegitimateTls(byte*,uint,int) returns 0x986a2b00080effa1 directly.
  This overload is not an authentication success oracle.
* 00575cd0 BuildSecurityKeyFromChallenge selects version-specific key profiles;
  this is separate from the plain legacy password hash.

VPLC:
* 1042e980 OMS_SReqInvoke_Execute validates session, resolves target and method
  objects, checks class/method metadata and permissions, then dispatches through
  the target interface. This is not a universal fixed method-number switch.
* 1042ae00 OMS_SReqBeginSequence_Execute distinguishes types 1..5, rejects
  incompatible active sequences, and invokes application transaction machinery.
  Type 2 is not equivalent to buffering a few writes and returning success.

main.fw:
* 0024ca00 OMS_var_AlarmSubsystem_init registers AlarmCategories (3612),
  TextListIDs (3613), ManufSpecInfo (3707), AlarmAliasTable (4671).
* 002692d0 OMS_var_AlarmSubscriptionRef_init is the typed alarm reference schema.
* 0029d0f4 OMS_var_AlarmingJob_init is the alarm job schema.

Managed ASOM IDs confirm AlarmSubscriptionRef class 2662/domain AID 2659/link
2660; AckJob class 3636 derives from AlarmingJob 3640, with job state 3641,
job timestamp 3642, and acknowledgements 3647. Acknowledgement element class
3651 contains alarm domain 3648, states info 3649, CPU alarm ID 3650. These IDs
alone do not establish event delivery or acknowledgement execution semantics.
AS_AlarmJobState defines Waiting=0, Processing=1, Distributing=2; there is no
verified terminal state in that enum. Do not invent a Completed=3 response.

## Application backend and native SDK validation

Registered Invoke now dispatches to a bounded host registry; the native client
parses return/output/inout values. Filtered Explore handles scalar predicates
and exact-class checks; native SDK matching/nonmatching session filters and a
mapped ancestor tree deserialize successfully. Class inheritance and combining
WithParent with filters are explicitly unsupported.

Collectives are opt-in private mapping snapshots. The proper StartTransaction
API (wrapper 003b9890 -> 00583340) generates a class-1700 descriptor and expects
a RID result. Generic BeginSequence(type=2) rejects locally at 00582ca0, so its
old failure was not a server oracle. Native client mapped writes remain isolated
until commit; abort and disconnect discard them. Host generation conflicts reject
publication. The bare native server returns 0xa201a3002ae3ff19 to StartTransaction;
that remains the default response when the mapped feature is disabled.

Legacy password profile is opt-in and advertises 0x300, retaining required TLS.
Native Legitimate (003beac0 -> 00577230 -> 0058cb20) reads AID 303 and submits
SHA-1(password) XOR challenge at AID 304. Server validation at 0059ffb0 and
0059f060 supplies wrong-proof status 0x26051900092d0016; repeat proof status
0xa6054c00040afea1 comes from 005a07a0. Native SDK success and incorrect-password
access levels are tested. Modern Blob-1846/TLS-exporter authentication is distinct and is now supported
for password-only and one named UAC account. TLSHandler_ServiceHandshakeIO at
00692e90 verifies the exporter label: `EXPERIMENTAL_OMS` (16 bytes), not the old
Python client's guessed label. Native-generated ciphertext decrypts with
SHA256(exporter) and the first 16 challenge bytes, PKCS#7 AES-256-CBC. The payload
is structure 40400: Type 40401, Username Blob 40402, Password Blob 40403. Type 1
contains SHA1(password), type 2 contains UTF-8 username/password. Native modern
entry 0058d300 is synchronous vtable slot 0x628; the public LegitimateTls overload
still returns unsupported and must not be used as a success oracle. Native and
Python clients pass correct/incorrect credential checks. Native named-user login
can return zero with access level 4, so tests verify granted access and data
access rather than status alone.

UploadWithoutStreamedBlobs (003c76c0 -> 00590250) creates request 0x4bb and
requires a sequence context; it is not a standalone Explore alias. Its internal
filter 11 has no address and a Null value. VPLC 1041f8a0 handles it by setting
bit 0 at +0x83c in the active sequence object, failing if no sequence exists.
zOMSp accepts that filter only during a best-effort sequence and supplies mapped
inline objects/values. The native SDK upload call now succeeds. Captured
DLTransaction AID 1702 directives still require an application activation model.
The mapped backend rejects them rather than claiming PLC activation.

Typed ASOM event/reference execution, AckJob acknowledgement, upload activation,
and V3 security negotiation/trailers remain open. The endpoint must not advertise
those as implemented. `invoke.py`, `transactions.py`, and `authentication.py`
cover the added application behavior; the Linux native runner also exercises the
live SDK paths, while Windows/ARM run their headless bounds/lifecycle checks.

VPLC AlarmSubsystem_Imp virtual slot 0x110 (107bd9c0) returns fixed
0x8000001900008005 after recording an unsupported status. This simulator path
cannot be treated as a positive alarm execution oracle. The class IDs above
are schema evidence, not an acknowledgement state machine.
