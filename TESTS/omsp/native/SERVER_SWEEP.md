# Server reference sweep

This is a partial implementation checkpoint, not complete PLC application parity.

## Validated changes

* Invoke 0x056b uses a fixed-width target/method RID, two sparse Variant argument
  lists, write integrity, and a zero trailer. Inputs are bounded to 16 slots per
  list, reject duplicate slots, and validate all bytes before advancing state.
  No application methods are registered yet. Unknown methods receive native
  0x8020ab00199afff4 instead of disconnecting. Native client parses the reply and
  successfully pings afterwards; the native server returns the same status.
* Explore request order is LinkAID, Recursive, RecursiveFilter, WithParent,
  Filters, Trimmers, integrity, ExclTrimmers, trailer. Previously Recursive was
  required to be 1 and RecursiveFilter incorrectly controlled tree recursion.
  Corrected both. Native session WithParent returns parent RID 285 and no object
  payload; zOMSp matches this and preserves the read counter. Generic mapped
  ancestor serialization is still unsupported.
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

## Still open / unsuccessful probes

Native -> native collective BeginSequence(type=2, null descriptor) returns
0xa6021400215aff94. No successful collective descriptor/upload activation
exchange is established. Do not emulate collective success from this test.

A native-wrapper-generated filtered Explore also failed to complete against the
bare native host. Its filter operation/32-slot address encoding was captured
through the Python TLS pivot. Earlier hand-built filter probes used the wrong
array length and cannot be used as behavior references. Filter matching and
mapped ancestor trees still need a successful oracle or a fuller application
host before enabling those paths.

Typed ASOM event/reference creation, AckJob execution and completion, positive
registered Invoke dispatch, collective commit/rollback and upload activation,
V3 security negotiation/trailers, and password authentication remain open.
The current TLS/no-password endpoint must not advertise these as implemented.
