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
typedef struct zomsp_context zomsp_context;
zomsp_context *zomsp_open(const char *path, uint8_t create);
int32_t zomsp_object(zomsp_context *, uint32_t rid, uint32_t parent, uint32_t class_id);
int32_t zomsp_delete(zomsp_context *, uint32_t rid);
int32_t zomsp_template(zomsp_context *, uint32_t rid);
int32_t zomsp_link(zomsp_context *, uint32_t rid, uint32_t aid, const uint32_t *targets, size_t count);
int32_t zomsp_set(zomsp_context *, uint32_t rid, uint32_t aid, const uint8_t *, size_t length, uint8_t writable);
intptr_t zomsp_get(zomsp_context *, uint32_t rid, uint32_t aid, uint8_t *, size_t capacity);
size_t zomsp_size(void);
int32_t zomsp_start(zomsp_context *, uint16_t port, const char *certificate, const char *key, const char *tls_library);
uint16_t zomsp_port(zomsp_context *);
void zomsp_stop(zomsp_context *);
void zomsp_close(zomsp_context *);
#ifdef __cplusplus
}
#endif
#endif
