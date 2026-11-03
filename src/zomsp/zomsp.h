#ifndef ZOMSP_H
#define ZOMSP_H
#include <stddef.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct zomsp_session zomsp_session;
/* Close sessions before their owning context. Dispatch/poll on a session are serialized by the caller.
   Output capacity is at least 65535 bytes. Dispatch does not require a TCP/TLS transport. */
zomsp_session *zomsp_session_open(void *context);
void zomsp_session_close(zomsp_session *session);
intptr_t zomsp_dispatch(zomsp_session *session, const uint8_t *input, size_t length, uint8_t *output, size_t capacity);
intptr_t zomsp_poll(zomsp_session *session, int64_t now_us, uint8_t *output, size_t capacity);
/* Serialize context configuration and headless session open/close in the host. */
typedef struct zomsp_context zomsp_context;
/* Quiescent class registry: 32 classes, base registered first, depth <=8.
 * Constructor defaults merge base templates then derived overrides, <=64 fields.
 * Class flags/composition are exposed by Explore; flags are not access policy.
 * Metadata is process-local; the version-1 mmap layout is unchanged. */
int32_t zomsp_class(zomsp_context *, uint32_t class_id, uint32_t base,
    uint32_t class_flags, uint32_t composition);
zomsp_context *zomsp_open(const char *path, uint8_t create);
/* Register before starting the runtime or opening sessions. Keep callback/user alive
   until all sessions close and runtime stops. Callbacks may run concurrently and
   must return promptly; they must not dispatch recursively on the same session.
   Arguments: two sparse Variant lists (slot/PValue pairs, zero terminated).
   Success result: return PValue, output list, inout list; at most 8192 bytes.
   Failure statuses (bit 63 set) ignore result bytes. Success/warnings require
   valid results. Status values are preserved. Authorization belongs to the host. */
typedef struct zomsp_invocation {
    uint32_t target, method, session, client, role;
} zomsp_invocation;
/* Application sequence modes 3..5 are opt-in. phase: 0 begin, 1 end, 2 cancel
 * on disconnect. Nonzero status rejects begin/end; failed end remains active
 * for retry/abort. Cancel status is ignored. Callbacks run outside backend locks.
 * One application sequence may nest inside a collective. Hosts own the actual
 * application semantics/resources and keep callback/user alive through stop. */
typedef uint64_t (*zomsp_sequence_handler)(void *, const zomsp_invocation *,
    uint8_t kind, uint8_t phase, uint32_t parameter_rid, uint8_t abort);
int32_t zomsp_sequences(zomsp_context *, zomsp_sequence_handler, void *);
/* Enable a bounded typed-event journal before sessions. publish accepts a DAI
 * (class 2681) PObject, <=2048 bytes. Each subscription has its own cursor;
 * lag beyond 64 events reports missed_sendings. Disabled/no-credit readers
 * retain their cursor. The host supplies alarm data and acknowledgement policy. */
int32_t zomsp_events(zomsp_context *);
int32_t zomsp_event(zomsp_context *, uint32_t subsystem, uint16_t domain,
    const uint8_t *object, size_t length);
/* Root CreateObject hook, bounded to 16 classes. Register a class template too.
 * validate is optional, side-effect free, before creation; nonzero native status
 * rejects. created runs after publication, outside locks; copy borrowed bytes
 * before queueing work. No created event on malformed/failed creation. Factories
 * cannot execute inside collectives. The host owns job state and authorization.
 * call.target is parent, call.method is class; callbacks may be concurrent. */
typedef uint64_t (*zomsp_create_validator)(void *, const zomsp_invocation *, const uint8_t *, size_t);
typedef void (*zomsp_created)(void *, const zomsp_invocation *, uint32_t rid, const uint8_t *, size_t);
int32_t zomsp_factory(zomsp_context *, uint32_t class_id, zomsp_create_validator, zomsp_created, void *);
typedef uint64_t (*zomsp_invoke_handler)(void *user, const zomsp_invocation *call,
    const uint8_t *arguments, size_t arguments_length, uint8_t *result,
    size_t result_capacity, size_t *result_length);
/* Opt-in legacy SHA-1 challenge/proof profile over TLS. Password: 1..256 bytes;
 * NULL/0 disables. Configure before starting runtime or opening sessions.
 * This explicitly advertises protocol profile 0x300, not V3/UAC authentication. */
int32_t zomsp_legacy_password(zomsp_context *context, const uint8_t *password, size_t length);
/* Enable before starting/opening sessions. Application mapped objects only. */
/* Modern TLS credentials. Anonymous password or one named UAC account.
 * Password: 1..256 UTF-8 bytes; username: 1..128 UTF-8 bytes.
 * The network runtime binds proof verification to the verified TLS exporter. */
int32_t zomsp_password(zomsp_context *, const uint8_t *password, size_t length);
int32_t zomsp_user_password(zomsp_context *, const uint8_t *username, size_t username_length,
    const uint8_t *password, size_t length);
/* Activation validation runs before publishing a collective's private mapping.
 * Directives: encoded AID 1702 PValue (<=1024 bytes). Image: read-only version-1
 * shared-memory layout, valid only during the call. Zero accepts; any nonzero
 * native status rejects and discards the staged image. No external side effects
 * or recursive same-session dispatch: validation may still encounter a conflict.
 * Register before starting/opening sessions; NULL disables. */
typedef uint64_t (*zomsp_activation_handler)(void *, const zomsp_invocation *,
    const uint8_t *directives, size_t directives_length, const uint8_t *image, size_t image_length);
int32_t zomsp_activation(zomsp_context *, zomsp_activation_handler, void *user);
/* One opt-in file-backed blob per context, length 1..16 MiB, before sessions.
 * directory must exist. Uploads require a collective and contiguous chunks.
 * Validation gets an immutable staged file path valid during the callback;
 * zero accepts, nonzero preserves the host status and discards the upload.
 * Read/compile the file normally; defer external activation until publication.
 * Close host file/mmap handles before context close. Committed files are owned
 * by the context; copy them if persistence beyond its lifetime is required. */
typedef uint64_t (*zomsp_blob_validator)(void *, const zomsp_invocation *, const char *path, uint64_t length);
int32_t zomsp_blob(zomsp_context *, uint32_t rid, uint32_t aid, uint32_t length,
    const char *directory, zomsp_blob_validator, void *user);
/* Current committed immutable path, NUL terminated; byte count excludes NUL.
 * -3 before a commit, -5 for insufficient capacity. Path may change on commit. */
intptr_t zomsp_blob_path(zomsp_context *, char *output, size_t capacity);
/* Memory-backed alternative to zomsp_blob: no upload file is created.
 * validate is optional and runs before commit; complete runs exactly once after
 * successful commit, outside backend locks. No event for abort/rejection/conflict.
 * Callbacks run on server workers, must return promptly, and must not re-enter
 * dispatch on the same session. Keep callback/user alive through server stop.
 * complete receives a BORROWED immutable buffer: retain it before queueing it
 * to another thread, and release each retained reference. Retained buffers may
 * outlive their context. Hosts own queue backpressure and retained-memory limits. */
typedef struct zomsp_buffer zomsp_buffer;
typedef uint64_t (*zomsp_stream_validator)(void *, const zomsp_invocation *, const uint8_t *, size_t);
typedef void (*zomsp_stream_complete)(void *, const zomsp_invocation *, zomsp_buffer *);
int32_t zomsp_stream(zomsp_context *, uint32_t rid, uint32_t aid, uint32_t length,
    zomsp_stream_validator validate, zomsp_stream_complete complete, void *user);
void zomsp_buffer_retain(zomsp_buffer *);
void zomsp_buffer_release(zomsp_buffer *);
size_t zomsp_buffer_size(const zomsp_buffer *);
/* Commit generation orders notifications from concurrent server workers. */
uint64_t zomsp_buffer_generation(const zomsp_buffer *);
intptr_t zomsp_buffer_read(const zomsp_buffer *, size_t offset, uint8_t *, size_t capacity);

int32_t zomsp_transactions(zomsp_context *, uint8_t enabled);
int32_t zomsp_method(zomsp_context *, uint32_t target, uint32_t method,
    zomsp_invoke_handler, void *user);
int32_t zomsp_object(zomsp_context *, uint32_t rid, uint32_t parent, uint32_t class_id);
int32_t zomsp_delete(zomsp_context *, uint32_t rid);
int32_t zomsp_template(zomsp_context *, uint32_t rid);
int32_t zomsp_link(zomsp_context *, uint32_t rid, uint32_t aid, const uint32_t *targets, size_t count);
int32_t zomsp_set(zomsp_context *, uint32_t rid, uint32_t aid, const uint8_t *, size_t length, uint8_t writable);
intptr_t zomsp_get(zomsp_context *, uint32_t rid, uint32_t aid, uint8_t *, size_t capacity);
/* Bytes occupied by the first bounded encoded PValue, or -1 if unsupported. */
intptr_t zomsp_value_size(const uint8_t *, size_t length);
size_t zomsp_size(void);
int32_t zomsp_start(zomsp_context *, uint16_t port, const char *certificate, const char *key, const char *tls_library);
uint16_t zomsp_port(zomsp_context *);
void zomsp_stop(zomsp_context *);
void zomsp_close(zomsp_context *);
/* Persistent blocking OMSp client. IPv4 and certificate-verified TLS.
 * Serialize operations/close on a handle; execute them on host workers for async
 * frontends. No environment variables or subprocess are needed. Close/reopen
 * after -8 (transport/protocol failure); -9 preserves a native remote status.
 * read/write exchange encoded PValues. find performs scoped Explore Name(233)
 * lookup, rejects ambiguity, and is not a universal PLC symbolic-address resolver.
 * Credentials, if needed, must be supplied immediately after open.
 * Errors: -1 arguments, -2 name missing, -5 capacity, -8 failed connection,
 * -9 remote status, -10 ambiguous name. Returned buffers belong to the caller. */
typedef struct zomsp_client zomsp_client;
typedef struct zomsp_object_record {
    uint32_t kind, rid, class_id, class_flags, aid, target, depth, reserved;
    const uint8_t *data;
    size_t length;
} zomsp_object_record;
/* Object record kinds: 1 begin, 2 end, 3 attribute PValue, 4 relation target.
 * Entire input is validated before any callback. All byte pointers are borrowed
 * for the call. Visitors must not modify input. Bounds: depth8, 128 objects. */
typedef void (*zomsp_object_visitor)(void *, const zomsp_object_record *);
int32_t zomsp_objects_visit(const uint8_t *, size_t, zomsp_object_visitor, void *);
typedef struct zomsp_notification_info_data {
    uint32_t subscription, sequence;
    uint16_t missed, ticks;
    uint8_t credit, phase;
    uint16_t reserved;
    uint64_t status, timestamp;
} zomsp_notification_info_data;
int32_t zomsp_notification_info(const uint8_t *, size_t, zomsp_notification_info_data *);
/* kind 1=value, 2=typed PObject. Validates before delivery; max64 records.
 * Both value updates and ASOM events use this decoder. */
typedef void (*zomsp_event_visitor)(void *, uint32_t subscription, uint32_t sequence,
    uint32_t kind, uint32_t reference, uint64_t status, uint32_t flags, const uint8_t *, size_t);
int32_t zomsp_notification_visit(const uint8_t *, size_t, zomsp_event_visitor, void *);
/* Invoke result sections: 0 return value, 1 outputs, 2 inout. */
typedef void (*zomsp_value_visitor)(void *, uint32_t section, uint32_t index, const uint8_t *, size_t);
int32_t zomsp_invoke_result_visit(const uint8_t *, size_t, zomsp_value_visitor, void *);
typedef struct zomsp_filter {
    uint32_t operation, address_count, address[4];
    const uint8_t *value;
    size_t length;
} zomsp_filter;
/* Encodes up to10 filters, <=4 address components, <=1024 bytes/operand.
 * Output capacity >=8192. Operations1..6, InstanceOf8, sequence upload11.
 * Operation7 (modulo comparison) is rejected until native-verified. */
intptr_t zomsp_filters_encode(const zomsp_filter *, size_t count, uint8_t *, size_t capacity);
typedef struct zomsp_explore_options {
    uint32_t flags, reserved; /* bit0 recursive, bit1 recursive-filter, bit2 with-parent */
    const uint32_t *aids;
    size_t aid_count;
    const uint8_t *filters; /* encoded filter list; NULL/0 means no filter */
    size_t filters_length;
} zomsp_explore_options;
/* Explore returns encoded PObject list, excluding reply/trailer; capacity>=65535.
 * NULL options defaults flags3, all attributes. GetLink returns target count.
 * Invoke arguments are input/inout sparse lists; result is PValue/output/inout.
 * GetLink capacity>=16; Invoke capacity>=8192. */
intptr_t zomsp_client_explore(zomsp_client *, uint32_t rid, const zomsp_explore_options *, uint8_t *, size_t, uint32_t *parent);
intptr_t zomsp_client_get_link(zomsp_client *, uint32_t rid, uint32_t aid, uint32_t *, size_t capacity);
intptr_t zomsp_client_invoke(zomsp_client *, uint32_t rid, uint32_t method,
    const uint8_t *arguments, size_t length, uint8_t *, size_t capacity);
typedef struct zomsp_reference {
    uint32_t handle, rid, aid, path_length, path[3], reserved;
} zomsp_reference;
/* <=64 unique nonzero handles; <=3 nested components; cycle0..60000 ms;
 * credits=-1 unlimited or >=0 finite. Control via AIDs1051/1053; Delete to stop. */
int32_t zomsp_client_subscribe(zomsp_client *, const zomsp_reference *, size_t count,
    uint32_t cycle_ms, int16_t credits, uint32_t *subscription);
int32_t zomsp_client_begin_best_effort(zomsp_client *);
int32_t zomsp_client_begin_application(zomsp_client *, uint8_t kind, uint32_t parameter_rid);
zomsp_client *zomsp_client_open(const char *ipv4, uint16_t port, const char *certificate, const char *tls_library);
void zomsp_client_close(zomsp_client *);
uint32_t zomsp_client_session(const zomsp_client *);
uint32_t zomsp_client_context(const zomsp_client *);
/* Complete bounded PObject descriptor; output capacity must be >=8 RIDs. */
intptr_t zomsp_client_create(zomsp_client *, uint32_t parent, const uint8_t *, size_t,
    uint32_t *assigned, size_t capacity);
int32_t zomsp_client_delete(zomsp_client *, uint32_t rid);
/* Complete encoded notification frame; capacity >=65535. wait=0 drains queued
 * notifications, wait=1 waits up to transport deadline (10 seconds). Serialize
 * with requests. Queue overflow/transport failure requires reconnect. */
intptr_t zomsp_client_notification(zomsp_client *, uint8_t *, size_t capacity, uint8_t wait);
uint64_t zomsp_client_status(const zomsp_client *);
int32_t zomsp_client_authenticate(zomsp_client *, const uint8_t *username, size_t username_length,
    const uint8_t *password, size_t password_length);
intptr_t zomsp_client_read(zomsp_client *, uint32_t rid, uint32_t aid, uint8_t *, size_t capacity);
/* Path contains AID followed by up to3 struct member AIDs. */
intptr_t zomsp_client_read_path(zomsp_client *, uint32_t rid, const uint32_t *path, size_t count, uint8_t *, size_t capacity);
int32_t zomsp_client_write_path(zomsp_client *, uint32_t rid, const uint32_t *path, size_t count, const uint8_t *, size_t length);
int32_t zomsp_client_write(zomsp_client *, uint32_t rid, uint32_t aid, const uint8_t *, size_t length);
int32_t zomsp_client_find(zomsp_client *, uint32_t root, const uint8_t *name, size_t name_length, uint32_t *rid);
int32_t zomsp_client_begin(zomsp_client *);
int32_t zomsp_client_end(zomsp_client *, uint8_t abort);
int32_t zomsp_client_upload(zomsp_client *, uint32_t rid, uint32_t aid, const uint8_t *, size_t length);

#ifdef __cplusplus
}
#endif
#endif
