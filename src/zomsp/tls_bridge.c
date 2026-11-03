#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
static HMODULE load_library(const char *path) {
    char absolute[32768];
    DWORD length = GetFullPathNameA(path, sizeof(absolute), absolute, NULL);
    if (!length || length >= sizeof(absolute)) return NULL;
    return LoadLibraryExA(absolute, NULL, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
}
#define LOAD(path) load_library(path)
#define SYMBOL(handle, name) ((void *)GetProcAddress(handle, name))
#else
#include <dlfcn.h>
#define LOAD(path) dlopen(path, RTLD_NOW | RTLD_LOCAL)
#define SYMBOL(handle, name) dlsym(handle, name)
#endif

typedef struct { void *ctx, *ssl, *input, *output, *pin; } Channel;
static void *library;
static int loaded;
static char loaded_path[32768];
#ifdef _WIN32
static void *crypto_library;
static void *resolve(const char *name) {
    void *result = SYMBOL(library, name);
    return result ? result : crypto_library ? SYMBOL(crypto_library, name) : NULL;
}
#else
#define resolve(name) SYMBOL(library, name)
#endif
#define API(ret, name, args) static ret (*p_##name) args
API(const void *, TLS_method, (void));
API(void *, SSL_CTX_new, (const void *));
API(void, SSL_CTX_free, (void *));
API(long, SSL_CTX_ctrl, (void *, int, long, void *));
API(int, SSL_CTX_use_certificate_file, (void *, const char *, int));
API(int, SSL_CTX_use_PrivateKey_file, (void *, const char *, int));
API(int, SSL_CTX_check_private_key, (const void *));
API(int, SSL_CTX_load_verify_locations, (void *, const char *, const char *));
API(void *, SSL_new, (void *));
API(void, SSL_free, (void *));
API(void, SSL_set_bio, (void *, void *, void *));
API(void, SSL_set_accept_state, (void *));
API(void, SSL_set_connect_state, (void *));
API(void, SSL_set_verify, (void *, int, void *));
API(void *, SSL_get0_param, (void *));
API(int, X509_VERIFY_PARAM_set1_ip_asc, (void *, const char *));
API(int, SSL_do_handshake, (void *));
API(int, SSL_get_error, (void *, int));
API(int, SSL_is_init_finished, (const void *));
API(int, SSL_export_keying_material, (void *, unsigned char *, size_t, const char *, size_t, const unsigned char *, size_t, int));
API(int, SSL_read, (void *, void *, int));
API(int, SSL_write, (void *, const void *, int));
API(const void *, BIO_s_mem, (void));
API(void *, BIO_new, (const void *));
API(int, BIO_read, (void *, void *, int));
API(int, BIO_write, (void *, const void *, int));
API(int, BIO_free, (void *));
API(void *, BIO_new_file, (const char *, const char *));
API(void *, PEM_read_bio_X509, (void *, void *, void *, void *));
API(void *, SSL_get1_peer_certificate, (const void *));
API(int, X509_cmp, (const void *, const void *));
API(void, X509_free, (void *));

int zomsp_tls_load(const char *path) {
    if (!path || strlen(path) >= sizeof(loaded_path)) return -1;
    if (loaded) return strcmp(path, loaded_path) == 0 ? 0 : -1;
#ifndef _WIN32
    const char *name = strrchr(path, '/');
    name = name ? name + 1 : path;
    if (strncmp(name, "libssl.so.", 10) == 0) {
        char crypto_path[32768];
        size_t directory = (size_t)(name - path);
        size_t suffix = strlen(name + 10);
        if (directory + 13 + suffix >= sizeof(crypto_path)) return -1;
        memcpy(crypto_path, path, directory);
        memcpy(crypto_path + directory, "libcrypto.so.", 13);
        memcpy(crypto_path + directory + 13, name + 10, suffix + 1);
        if (!dlopen(crypto_path, RTLD_NOW | RTLD_LOCAL)) return -1;
    }
#endif
    library = LOAD(path);
    if (!library) return -1;
#ifdef _WIN32
    char crypto_path[32768];
    const char *filename = strrchr(path, '\\');
    const char *slash = strrchr(path, '/');
    if (!filename || (slash && slash > filename)) filename = slash;
    filename = filename ? filename + 1 : path;
    size_t directory = (size_t)(filename - path);
    if (directory + sizeof("libcrypto-1_1-x64.dll") > sizeof(crypto_path)) return -1;
    memcpy(crypto_path, path, directory);
    const char *crypto_name = strstr(filename, "1_1") ? "libcrypto-1_1-x64.dll" : "libcrypto-3-x64.dll";
    memcpy(crypto_path + directory, crypto_name, strlen(crypto_name) + 1);
    crypto_library = LOAD(crypto_path);
#endif
#define RESOLVE(name) do { p_##name = (void *)resolve(#name); if (!p_##name) return -1; } while (0)
    RESOLVE(TLS_method); RESOLVE(SSL_CTX_new); RESOLVE(SSL_CTX_free);
    RESOLVE(SSL_CTX_ctrl); RESOLVE(SSL_CTX_use_certificate_file);
    RESOLVE(SSL_CTX_use_PrivateKey_file); RESOLVE(SSL_CTX_check_private_key);
    RESOLVE(SSL_CTX_load_verify_locations); RESOLVE(SSL_new); RESOLVE(SSL_free);
    RESOLVE(SSL_set_bio); RESOLVE(SSL_set_accept_state); RESOLVE(SSL_set_connect_state);
    RESOLVE(SSL_set_verify); RESOLVE(SSL_get0_param); RESOLVE(X509_VERIFY_PARAM_set1_ip_asc);
    RESOLVE(SSL_do_handshake); RESOLVE(SSL_get_error); RESOLVE(SSL_is_init_finished);
    RESOLVE(SSL_export_keying_material); RESOLVE(SSL_read); RESOLVE(SSL_write); RESOLVE(BIO_s_mem); RESOLVE(BIO_new);
    RESOLVE(BIO_read); RESOLVE(BIO_write); RESOLVE(BIO_free);
    RESOLVE(BIO_new_file); RESOLVE(PEM_read_bio_X509);
    p_SSL_get1_peer_certificate = (void *)resolve("SSL_get1_peer_certificate");
    if (!p_SSL_get1_peer_certificate) p_SSL_get1_peer_certificate = (void *)resolve("SSL_get_peer_certificate");
    if (!p_SSL_get1_peer_certificate) return -1;
    RESOLVE(X509_cmp); RESOLVE(X509_free);
#undef RESOLVE
    loaded = 1;
    memcpy(loaded_path, path, strlen(path) + 1);
    return 0;
}

void zomsp_tls_free(Channel *channel) {
    if (!channel) return;
    if (channel->ssl) p_SSL_free(channel->ssl);
    if (channel->ctx) p_SSL_CTX_free(channel->ctx);
    if (channel->pin) p_X509_free(channel->pin);
    free(channel);
}

Channel *zomsp_tls_new(int server, const char *certificate, const char *key, const char *peer_ip) {
    if (!library) return NULL;
    Channel *channel = calloc(1, sizeof(*channel));
    if (!channel) return NULL;
    channel->ctx = p_SSL_CTX_new(p_TLS_method());
    if (!channel->ctx) goto fail;
    if (p_SSL_CTX_ctrl(channel->ctx, 123, 0x0304, NULL) != 1 ||
        p_SSL_CTX_ctrl(channel->ctx, 124, 0x0304, NULL) != 1) goto fail;
    if (server) {
        if (p_SSL_CTX_use_certificate_file(channel->ctx, certificate, 1) != 1 ||
            p_SSL_CTX_use_PrivateKey_file(channel->ctx, key, 1) != 1 ||
            p_SSL_CTX_check_private_key(channel->ctx) != 1) goto fail;
    } else {
        if (p_SSL_CTX_load_verify_locations(channel->ctx, certificate, NULL) != 1) goto fail;
        void *bio = p_BIO_new_file(certificate, "r");
        if (!bio) goto fail;
        channel->pin = p_PEM_read_bio_X509(bio, NULL, NULL, NULL);
        p_BIO_free(bio);
        if (!channel->pin) goto fail;
    }
    channel->ssl = p_SSL_new(channel->ctx);
    if (!channel->ssl) goto fail;
    channel->input = p_BIO_new(p_BIO_s_mem());
    channel->output = p_BIO_new(p_BIO_s_mem());
    if (!channel->input || !channel->output) {
        if (channel->input) p_BIO_free(channel->input);
        if (channel->output) p_BIO_free(channel->output);
        goto fail;
    }
    p_SSL_set_bio(channel->ssl, channel->input, channel->output);
    if (server) p_SSL_set_accept_state(channel->ssl);
    else {
        p_SSL_set_verify(channel->ssl, 1, NULL);
        if (p_X509_VERIFY_PARAM_set1_ip_asc(p_SSL_get0_param(channel->ssl), peer_ip) != 1) goto fail;
        p_SSL_set_connect_state(channel->ssl);
    }
    return channel;
fail:
    zomsp_tls_free(channel);
    return NULL;
}

static int outcome(Channel *channel, int result) {
    if (result > 0) return result;
    const int error = p_SSL_get_error(channel->ssl, result);
    if (error == 2 || error == 3) return -2;
    if (error == 6) return 0;
    return -1;
}
int zomsp_tls_handshake(Channel *c) {
    const int result = outcome(c, p_SSL_do_handshake(c->ssl));
    if (result > 0 && c->pin) {
        void *peer = p_SSL_get1_peer_certificate(c->ssl);
        if (!peer) return -1;
        const int equal = p_X509_cmp(peer, c->pin) == 0;
        p_X509_free(peer);
        if (!equal) return -1;
    }
    return result;
}
int zomsp_tls_finished(Channel *c) { return p_SSL_is_init_finished(c->ssl); }
int zomsp_tls_feed(Channel *c, const void *data, int length) {
    if (length < 0 || length > 65535) return -1;
    return p_BIO_write(c->input, data, length);
}
int zomsp_tls_drain(Channel *c, void *data, int length) { return p_BIO_read(c->output, data, length); }
int zomsp_tls_read(Channel *c, void *data, int length) { return outcome(c, p_SSL_read(c->ssl, data, length)); }
int zomsp_tls_write(Channel *c, const void *data, int length) { return outcome(c, p_SSL_write(c->ssl, data, length)); }

int zomsp_tls_exporter(Channel *channel, unsigned char *output) {
    if (!channel || !output || !p_SSL_is_init_finished(channel->ssl)) return -1;
    return p_SSL_export_keying_material(channel->ssl, output, 32,
        "EXPERIMENTAL_OMS", 16, NULL, 0, 0) == 1 ? 0 : -1;
}
