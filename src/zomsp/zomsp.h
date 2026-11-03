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
#ifdef __cplusplus
}
#endif
#endif
