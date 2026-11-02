#define _GNU_SOURCE
#include <dlfcn.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <stdarg.h>

typedef struct { uintptr_t words[4]; } Wrapper;
_Static_assert(sizeof(Wrapper) == 32, "native wrapper ABI");

static void trace_event(unsigned module, unsigned level, unsigned event, ...) {
    fprintf(stderr, "native.trace module=%u level=%u event=%08x\n", module, level, event);
    if (event == 0x1741025e) {
        va_list arguments;
        va_start(arguments, event);
        void *handler = va_arg(arguments, void *);
        uint64_t high = va_arg(arguments, uint64_t);
        uint64_t low = va_arg(arguments, uint64_t);
        va_end(arguments);
        fprintf(stderr, "native.read_failure handler=%p status=%08x%08x\n", handler, (unsigned)high, (unsigned)low);
    }
    if (event == 0x1742038d) {
        va_list arguments;
        va_start(arguments, event);
        (void)va_arg(arguments, void *);
        unsigned char *sap = va_arg(arguments, void *);
        long result = va_arg(arguments, long);
        va_end(arguments);
        unsigned char *parser = *(void **)(sap + 0x260);
        fprintf(stderr, "native.parser result=%ld status=%016" PRIx64 "\n", result,
                parser ? *(uint64_t *)(parser + 0xa8) : 0);
    }
}

static void enable_trace(void *anchor) {
    if (!getenv("OMSP_NATIVE_TRACE")) return;
    Dl_info info;
    if (!dladdr(anchor, &info)) abort();
    unsigned char *image = info.dli_fbase;
    static void (*table[64])(unsigned, unsigned, unsigned, ...);
    for (size_t i = 0; i < 64; ++i) table[i] = trace_event;
    *(void **)(image + 0x1b24ca8) = table;
    const unsigned modules[] = {3, 17, 23, 25};
    for (size_t i = 0; i < sizeof(modules)/sizeof(modules[0]); ++i)
        ((unsigned *)(image + 0x1b256e0))[modules[i]] = 7;
}

static void *symbol(void *library, const char *name) {
    dlerror();
    void *result = dlsym(library, name);
    const char *error = dlerror();
    if (error || !result) {
        fprintf(stderr, "dlsym %s: %s\n", name, error ? error : "null");
        exit(2);
    }
    return result;
}

static void destroy(void *object) {
    void (**vtable)(void *) = *(void (***)(void *))object;
    if (!vtable || !vtable[0]) abort();
    vtable[0](object);
}

static uintptr_t unsupported_policy(void *self) {
    (void)self;
    fputs("unsupported server policy callback\n", stderr);
    abort();
}

static void *native_library;
static uintptr_t tls_policy(void *self) {
    (void)self;
    return 3; /* Require StartTLS for this loopback host. */
}

static bool certificate_provider(void *self, void **cert, void **key, void **store) {
    (void)self;
    void *(*bio_file)(const char *, const char *) = symbol(native_library, "BIO_new_file");
    void *(*read_cert)(void *, void *, void *, void *) = symbol(native_library, "PEM_read_bio_X509");
    void *(*read_key)(void *, void *, void *, void *) = symbol(native_library, "PEM_read_bio_PrivateKey");
    int (*bio_free)(void *) = symbol(native_library, "BIO_free");
    void *bio = bio_file("omsp_capture_analysis/native_test_credentials/server-cert.pem", "r");
    if (!bio) return false;
    *cert = read_cert(bio, NULL, NULL, NULL);
    bio_free(bio);
    bio = bio_file("omsp_capture_analysis/native_test_credentials/server-key.pem", "r");
    if (!bio) return false;
    *key = read_key(bio, NULL, NULL, NULL);
    bio_free(bio);
    *store = NULL;
    puts("server.certificate.loaded");
    return *cert && *key;
}

static void *(*make_context)(unsigned);
static void *tls_context(void *self, const void *address) {
    (void)self; (void)address;
    return make_context(4);
}

static bool reject_plaintext(void *session, void *context) {
    (void)session; (void)context;
    puts("client.plaintext.rejected");
    return false;
}

static bool verify_tls(void *session, bool cert_ok, unsigned chain_count, void *chain,
                       bool address_ok, void *remote, unsigned remote_len,
                       void *names, unsigned names_len, void *context) {
    (void)session; (void)chain; (void)remote; (void)remote_len;
    (void)names; (void)names_len; (void)context;
    printf("client.tls.verify cert=%d address=%d chain=%u\n", cert_ok, address_ok, chain_count);
    return cert_ok && address_ok;
}

static void *install_tls_policy(Wrapper *root) {
    static uintptr_t (*vtable[8])(void *) = {
        unsupported_policy, unsupported_policy, unsupported_policy, tls_policy,
        unsupported_policy, unsupported_policy, unsupported_policy, unsupported_policy};
    static void *policy = vtable;
    vtable[2] = (void *)certificate_provider;
    void **slot = (void **)(root->words[1] + 0x1a8);
    void *previous = *slot;
    *slot = &policy;
    Dl_info info;
    if (!dladdr(symbol(native_library, "_ZN11OMSpWrapper4Root11StartClientEv"), &info)) abort();
    make_context = (void *)((char *)info.dli_fbase + 0x5915d0);
    static void *context_vtable[5] = {0};
    for (unsigned i = 0; i < 5; ++i) context_vtable[i] = unsupported_policy;
    context_vtable[3] = tls_context;
    static void *context_provider = context_vtable;
    *(void **)(root->words[1] + 0x1a0) = &context_provider;
    /* Host system family/version used by the native negotiation code. */
    *(uint32_t *)(root->words[1] + 0x158) = 0x802001;
    *(uint32_t *)(root->words[1] + 0x15c) = 0x802001;
    puts("server.policy=tls-required");
    return previous;
}

static int64_t start_server_runtime(void *library) {
    /* Private startup ABI for this exact analyzed image; no code patching. */
    Dl_info info;
    void *anchor = symbol(library, "_ZN11OMSpWrapper4Root11StartClientEv");
    if (!dladdr(anchor, &info)) return -1;
    unsigned char *image = info.dli_fbase;
    int64_t (*initialize)(void *) = (void *)(image + 0x3cc3e0);
    struct { uint32_t type, padding; const char *local, *remote; } address = {
        .type = 0x80, .local = "6::127.0.0.1:SIMATIC-ROOT-ES:6.0:", .remote = NULL};
    union { uint64_t align; unsigned char bytes[104]; } config = {0};
    uint32_t count = 1;
    memcpy(config.bytes + 0x10, &count, sizeof(count));
    void *addresses = &address;
    memcpy(config.bytes + 0x18, &addresses, sizeof(addresses));
    void *entropy = image + 0x2a58f0;
    memcpy(config.bytes + 0x40, &entropy, sizeof(entropy));
    uint64_t rid_range = UINT64_C(0x17d7840011e1a300);
    memcpy(config.bytes + 0x48, &rid_range, sizeof(rid_range));
    void *callback = image + 0x2a5890;
    memcpy(config.bytes + 0x50, &callback, sizeof(callback));
    config.bytes[0x60] = 1;
    config.bytes[0x61] = 1;
    /* Runtime retains this configuration pointer; keep it until shutdown. */
    static unsigned char retained_config[104] __attribute__((aligned(8)));
    static unsigned char retained_address[24] __attribute__((aligned(8)));
    memcpy(retained_address, &address, sizeof(address));
    addresses = retained_address;
    memcpy(config.bytes + 0x18, &addresses, sizeof(addresses));
    memcpy(retained_config, config.bytes, sizeof(retained_config));
    int64_t status = initialize(retained_config);
    printf("server.runtime.status=0x%016" PRIx64 "\n", (uint64_t)status);
    return status;
}

typedef struct { uint8_t temporary, native; uint16_t pad; uint32_t reserved, user; } CreationFlags;
typedef struct { int32_t position; uint32_t pad; void *relative; } Placement;
typedef struct { uint32_t parent, composition, key; } Qualifier;

static void subscription_event(const void *data, void *object, int reason, void *context) {
    (void)data; (void)object; (void)context;
    printf("subscription.callback.reason=%d\n", reason);
}

static int64_t probe_subscription(void *library, void *session, uint32_t rid) {
    uintptr_t subscription[3] = {0}, response[3] = {0};
    void (*ctor)(void *) = symbol(library, "_ZN11OMSpWrapper12SubscriptionC2Ev");
    void (*response_ctor)(void *) = symbol(library, "_ZN11OMSpWrapper17ResponseExtensionC2Ev");
    int64_t (*create)(void *, void *, unsigned char, unsigned, void *, unsigned, void *, void *) = symbol(library,
        "_ZN11OMSpWrapper13ClientSession18CreateSubscriptionEPNS_12SubscriptionEhjPFvPKNS_13ServiceCBDataEPNS_6ObjectEiPvEjS8_S8_");
    int64_t (*add)(void *, unsigned *, unsigned, unsigned, unsigned, unsigned char, uintptr_t, unsigned) = symbol(library,
        "_ZN11OMSpWrapper12Subscription21AddAttributeReferenceERjjjjhmj");
    int64_t (*download)(void *, void *, unsigned char, int *, void *, bool *) = symbol(library,
        "_ZN11OMSpWrapper13ClientSession20DownloadSubscriptionEPNS_12SubscriptionEhRiPNS_6ObjectERb");
    ctor(subscription);
    response_ctor(response);
    int64_t status = create(session, subscription, 1, 100, subscription_event, 0, NULL, NULL);
    printf("subscription.create.status=0x%016" PRIx64 "\n", (uint64_t)status);
    if (status >= 0 && subscription[1]) {
        Dl_info info;
        if (dladdr(create, &info)) printf("subscription.vtable=%" PRIxPTR "\n", *(uintptr_t *)subscription[1] - (uintptr_t)info.dli_fbase + 0x100000);
        if (getenv("OMSP_SUBS_CREDIT")) {
            void (*flow)(void *, int16_t, int16_t) = symbol(library, "_ZN11OMSpWrapper12Subscription14SetFlowControlEss");
            flow(subscription, 1, 1);
        }
    }
    unsigned handle = 0;
    if (status >= 0) {
        unsigned aid = getenv("OMSP_APP_RID") ? 42 : 299;
        unsigned target = getenv("OMSP_APP_RID") ? (unsigned)strtoul(getenv("OMSP_APP_RID"), NULL, 0) : rid;
        status = add(subscription, &handle, target, aid, 1, 0, 0, 0);
        printf("subscription.add.status=0x%016" PRIx64 " handle=%u\n", (uint64_t)status, handle);
    }
    if (status >= 0) {
        int request = -1;
        bool extension = false;
        status = download(session, subscription, 0, &request, response, &extension);
        printf("subscription.download.status=0x%016" PRIx64 "\n", (uint64_t)status);
        if (status >= 0) usleep(300000);
        if (status >= 0 && getenv("OMSP_SUBS_CREDIT")) {
            int64_t (*credit)(void *, unsigned char, unsigned char *) = symbol(library, "_ZN11OMSpWrapper12Subscription9AddCreditEhRh");
            unsigned char current = 0;
            status = credit(subscription, 2, &current);
            printf("subscription.credit.status=0x%016" PRIx64 " current=%u\n", (uint64_t)status, current);
            usleep(300000);
        }
    }
    destroy(response);
    destroy(subscription);
    return status;
}

static int64_t create_child(void *library, void *parent, uint32_t class_id, void *child) {
    void (*ctor)(void *) = symbol(library, "_ZN11OMSpWrapper6ObjectC2Ev");
    int64_t (*create)(void *, uint32_t, void *, void *, const Placement *, uint32_t, CreationFlags) = symbol(library,
        "_ZN11OMSpWrapper6Object17CreateChildObjectEjPS0_PNS_11CompositionEPNS_15ObjectPlacementEjNS_18ObjectCreationFlagE");
    ctor(child);
    Placement placement = {.position = 1};
    CreationFlags flags = {0};
    uint32_t rid = class_id == 0x11c ? 0x11d : class_id == 0x148 ? 0x146 : 0xd2;
    int64_t status = create(parent, class_id, child, NULL, &placement, rid, flags);
    if (status >= 0) {
        unsigned (*get_rid)(void *) = symbol(library, "_ZN11OMSpWrapper6Object6GetRIDEv");
        printf("server.object.%04x.rid=%08x\n", class_id, get_rid(child));
    }
    printf("server.create.%04x.status=0x%016" PRIx64 "\n", class_id, (uint64_t)status);
    return status;
}

static int64_t set_property(void *library, void *object, uint32_t aid, int kind, const char *text, uint32_t number) {
    uintptr_t value[2] = {0};
    if (kind == 0) {
        void (*ctor)(void *) = symbol(library, "_ZN11OMSpWrapper5ValueC2Ev");
        int64_t (*assign)(void *, const unsigned char *, uint32_t) = symbol(library, "_ZN11OMSpWrapper5Value14SetStringValueEPhj");
        ctor(value);
        int64_t status = assign(value, (const unsigned char *)text, (int)strlen(text));
        if (status < 0) return status;
    } else if (kind == 1) {
        void (*ctor)(void *, bool) = symbol(library, "_ZN11OMSpWrapper5ValueC2Eb");
        ctor(value, number != 0);
    } else {
        void (*ctor)(void *, uint32_t, uint32_t) = symbol(library, "_ZN11OMSpWrapper5ValueC2ENS_11ValueOpcodeEj");
        ctor(value, 0, number);
    }
    int64_t (*set)(void *, uint32_t, void *, void *) = symbol(library, "_ZN11OMSpWrapper6Object11SetVariableEjPNS_5ValueEPNS_3OCBE");
    int64_t status = set(object, aid, value, NULL);
    void (*dtor)(void *) = symbol(library, "_ZN11OMSpWrapper5ValueD2Ev");
    dtor(value);
    printf("server.set.%04x.status=0x%016" PRIx64 "\n", aid, (uint64_t)status);
    return status;
}

static int64_t serve_native(void *library, Wrapper *root) {
    uintptr_t sessions[3] = {0}, folder[3] = {0}, endpoint[3] = {0};
    int64_t status = create_child(library, root, 0x11c, sessions);
    if (status < 0) { destroy(sessions); return status; }
    status = create_child(library, root, 0x148, folder);
    if (status < 0) { destroy(folder); destroy(sessions); return status; }
    status = create_child(library, folder, 0x158, endpoint);
    if (status < 0) goto cleanup;
    status = set_property(library, endpoint, 0x155, 2, NULL, 0x80);
    if (status < 0) goto cleanup;
    status = set_property(library, endpoint, 0x153, 2, NULL, 0);
    if (status < 0) goto cleanup;
    status = set_property(library, endpoint, 0x151, 0, "6::127.0.0.1:SIMATIC-ROOT-ES:6.0:", 0);
    if (status < 0) goto cleanup;
    status = set_property(library, endpoint, 0x152, 0, "", 0);
    if (status < 0) goto cleanup;
    status = set_property(library, endpoint, 0x150, 1, NULL, 1);
    if (status < 0) goto cleanup;
    printf("server.endpoint.native=%p flags178=%08x\n", (void *)endpoint[1], *(uint32_t *)(endpoint[1] + 0x178));
    status = set_property(library, endpoint, 0x14f, 1, NULL, 1);
    if (status < 0) goto cleanup;
    puts("server.ready");
    sleep(15);
    status = set_property(library, endpoint, 0x14f, 1, NULL, 0);
cleanup:
    destroy(endpoint);
    destroy(folder);
    destroy(sessions);
    return status;
}

static int64_t connect_client(void *library, Wrapper *root, const char *address) {
    uintptr_t sessions[3] = {0}, session[6] = {0}, remote[2] = {0}, local[2] = {0};
    void (*sessions_ctor)(void *) = symbol(library, "_ZN11OMSpWrapper14ClientSessionsC2Ev");
    void (*session_ctor)(void *) = symbol(library, "_ZN11OMSpWrapper13ClientSessionC2Ev");
    void (*address_ctor)(void *) = symbol(library, "_ZN11OMSpWrapper12OMS_ACE_AddrC2Ev");
    void *(*get_sessions)(void *, void *) = symbol(library, "_ZN11OMSpWrapper4Root26GetClientSessionsContainerEPNS_14ClientSessionsE");
    int64_t (*set_address)(void *, const char *, int, bool) = symbol(library, "_ZN11OMSpWrapper12OMS_ACE_Addr10SetAddressEPKcib");
    int64_t (*create)(void *, void *, void *, unsigned char, void *, bool) = symbol(library, "_ZN11OMSpWrapper14ClientSessions13CreateSessionEPNS_12OMS_ACE_AddrES2_hPNS_13ClientSessionEb");
    int64_t (*release)(void *, void *) = symbol(library, "_ZN11OMSpWrapper14ClientSessions14DestroySessionEPNS_13ClientSessionE");
    sessions_ctor(sessions);
    session_ctor(session);
    address_ctor(remote);
    address_ctor(local);
    int64_t status = -1;
    if (!get_sessions(root, sessions)) goto cleanup;
    status = set_address(remote, address, 0x80, false);
    printf("address.status=0x%016" PRIx64 "\n", (uint64_t)status);
    if (status < 0) goto cleanup;
    status = set_address(local, "6::127.0.0.1:6.0:6.0:", 0x80, true);
    printf("local_address.status=0x%016" PRIx64 "\n", (uint64_t)status);
    if (status < 0) goto cleanup;
    puts("session.create");
    status = create(sessions, remote, local, 1, session, true);
    printf("session.create.status=0x%016" PRIx64 " native=%p\n", (uint64_t)status, (void *)session[1]);
    if (status >= 0 && session[1]) {
        union { uint64_t align; unsigned char bytes[72]; } login_data = {0};
        void (*login_ctor)(void *) = symbol(library, "_ZN11OMSpWrapper9LoginDataC2Ev");
        int64_t (*set_login)(void *, const void *) = symbol(library, "_ZN11OMSpWrapper13ClientSession12SetLoginDataEPKNS_9LoginDataE");
        login_ctor(&login_data);
        uint32_t role = 2;
        memcpy(login_data.bytes + 60, &role, sizeof(role));
        status = set_login(session, &login_data);
        printf("session.set_login.status=0x%016" PRIx64 "\n", (uint64_t)status);
        void (*set_tls)(void *, void *, void *, void *, void *) = symbol(library,
            "_ZN11OMSpWrapper13ClientSession26TLSSetVerificationCallbackEPFbPS0_PvES2_PFbS1_bjPPNS_18TLSCertificateInfoEbPhjS8_jS2_ES2_");
        set_tls(session, reject_plaintext, NULL, verify_tls, NULL);
        unsigned char cert_data[8192];
        const char *pin_path = getenv("OMSP_PIN_CERT");
        if (!pin_path) pin_path = "omsp_capture_analysis/native_test_credentials/server-cert.der";
        FILE *cert_file = fopen(pin_path, "rb");
        if (!cert_file) abort();
        size_t cert_bytes = fread(cert_data, 1, sizeof(cert_data), cert_file);
        if (ferror(cert_file) || !feof(cert_file) || cert_bytes == 0) abort();
        fclose(cert_file);
        uintptr_t blob[6] = {0};
        void (*blob_ctor)(void *) = symbol(library, "_ZN11OMSpWrapper4BlobC2Ev");
        int64_t (*blob_set)(void *, const void *, unsigned) = symbol(library, "_ZN11OMSpWrapper4Blob7SetDataEPhj");
        int64_t (*pin_cert)(void *, void *) = symbol(library, "_ZN11OMSpWrapper13ClientSession26TLSSetEndEntityCertificateEPNS_4BlobE");
        blob_ctor(blob);
        if (blob_set(blob, cert_data, (unsigned)cert_bytes) < 0) abort();
        status = pin_cert(session, blob);
        printf("client.pin.status=0x%016" PRIx64 "\n", (uint64_t)status);
        destroy(blob);
        if (status < 0) abort();
        int64_t (*login)(void *) = symbol(library, "_ZN11OMSpWrapper13ClientSession5LoginEv");
        puts("session.login");
        status = login(session);
        printf("session.login.status=0x%016" PRIx64 "\n", (uint64_t)status);
        if (status >= 0) {
            unsigned (*security_type)(void *) = symbol(library, "_ZN11OMSpWrapper13ClientSession15GetSecurityTypeEv");
            unsigned type = security_type(session);
            printf("session.security_type=%u\n", type);
            if (type != 4) status = -1;
        }
        if (status >= 0) {
            int64_t (*ping)(void *) = symbol(library, "_ZN11OMSpWrapper13ClientSession17PingServerSessionEv");
            status = ping(session);
            printf("session.ping.status=0x%016" PRIx64 "\n", (uint64_t)status);
        }
        if (status >= 0) {
            uintptr_t value[2] = {0};
            void (*value_ctor)(void *) = symbol(library, "_ZN11OMSpWrapper5ValueC2Ev");
            int64_t (*get_remote)(void *, uint32_t, uint32_t, void *, bool, int *, void *, bool *, Qualifier, bool) = symbol(library,
                "_ZN11OMSpWrapper13ClientSession17GetVariableRemoteEjjPNS_5ValueEbRiPNS_6ObjectERbNS_15ObjectQualifierEb");
            int64_t (*get_uint)(void *, uint32_t *) = symbol(library, "_ZN11OMSpWrapper5Value8GetValueERj");
            void (*value_dtor)(void *) = symbol(library, "_ZN11OMSpWrapper5ValueD2Ev");
            uint32_t (*server_rid)(void *) = symbol(library, "_ZN11OMSpWrapper13ClientSession16ServerSessionRIDEv");
            value_ctor(value);
            int request_id = -1;
            bool extension = false;
            uintptr_t response[3] = {0};
            void (*response_ctor)(void *) = symbol(library, "_ZN11OMSpWrapper17ResponseExtensionC2Ev");
            response_ctor(response);
            uint32_t rid = server_rid(session);
            status = get_remote(session, rid, 0x12b, value, false, &request_id, response, &extension, (Qualifier){0}, false);
            printf("session.read.status=0x%016" PRIx64 " request=%d\n", (uint64_t)status, request_id);
            if (status >= 0) {
                uint32_t role = 0;
                status = get_uint(value, &role);
                if (status >= 0 && role == 2)
                    printf("session.read.role=%u rid=%08x\n", role, rid);
                else status = -1;
            }
            if (status >= 0) {
                int64_t (*set_uint)(void *, uint32_t) = symbol(library, "_ZN11OMSpWrapper5Value8SetValueEj");
                int64_t (*set_remote)(void *, uint32_t, uint32_t, void *, unsigned char, int *, void *, bool *, Qualifier, bool) = symbol(library,
                    "_ZN11OMSpWrapper13ClientSession17SetVariableRemoteEjjPNS_5ValueEhRiPNS_6ObjectERbNS_15ObjectQualifierEb");
                status = set_uint(value, 0x20);
                if (status >= 0) {
                    request_id = -1;
                    status = set_remote(session, rid, 0x12b, value, 0, &request_id, response, &extension, (Qualifier){0}, false);
                    printf("session.write.status=0x%016" PRIx64 "\n", (uint64_t)status);
                }
                if (status >= 0) {
                    request_id = -1;
                    status = get_remote(session, rid, 0x12b, value, false, &request_id, response, &extension, (Qualifier){0}, false);
                    printf("session.readback.status=0x%016" PRIx64 "\n", (uint64_t)status);
                    uint32_t updated_role = 0;
                    if (status >= 0) status = get_uint(value, &updated_role);
                    if (status >= 0 && updated_role == 0x20) puts("session.readback.role=32");
                    else status = -1;
                }
            }
            value_dtor(value);
            if (status >= 0 && getenv("OMSP_INVOKE")) {
                uintptr_t arguments[4][2] = {{0}};
                int64_t (*invoke)(void *, uint32_t, uint32_t, void *, void *, void *, void *, int *) = symbol(library,
                    "_ZN11OMSpWrapper13ClientSession18InvokeRemoteMethodEjjPNS_5ValueES2_S2_S2_Ri");
                for (unsigned i = 0; i < 4; ++i) value_ctor(arguments[i]);
                void (*empty)(void *, uint32_t, uint32_t) = symbol(library, "_ZN11OMSpWrapper5Value18SetEmptyArrayValueEjj");
                for (unsigned i = 1; i < 4; ++i) empty(arguments[i], 0x40000016, 0);
                request_id = -1;
                status = invoke(session, server_rid(session), 0xffffffff, arguments[0], arguments[1], arguments[2], arguments[3], &request_id);
                printf("application.invoke.status=0x%016" PRIx64 "\n", (uint64_t)status);
                if ((uint64_t)status == UINT64_C(0x8020ab00199afff4)) {
                    int64_t (*recover)(void *) = symbol(library, "_ZN11OMSpWrapper13ClientSession17PingServerSessionEv");
                    status = recover(session);
                    printf("application.invoke.recovery=0x%016" PRIx64 "\n", (uint64_t)status);
                }
                for (unsigned i = 0; i < 4; ++i) value_dtor(arguments[i]);
            }
            if (status >= 0 && getenv("OMSP_LINK_RID")) {
                uintptr_t links[2] = {0};
                int64_t (*get_link)(void *, uint32_t, uint32_t, void *, int *, void *, bool *, uint32_t, bool) = symbol(library,
                    "_ZN11OMSpWrapper13ClientSession13GetLinkRemoteEjjPNS_5ValueERiPNS_6ObjectERbjb");
                value_ctor(links);
                request_id = -1;
                status = get_link(session, (uint32_t)strtoul(getenv("OMSP_LINK_RID"), NULL, 0), 2699, links,
                    &request_id, response, &extension, 0, false);
                printf("application.get_link.status=0x%016" PRIx64 "\n", (uint64_t)status);
                value_dtor(links);
            }
            if (status >= 0 && getenv("OMSP_SEQUENCE")) {
                int64_t (*begin)(void *, unsigned char, unsigned char *, int *, void *, void *, bool *) = symbol(library,
                    "_ZN11OMSpWrapper13ClientSession13BeginSequenceEhRhRiPNS_5ValueEPNS_6ObjectERb");
                int64_t (*end)(void *, bool, int *, void *, bool *) = symbol(library,
                    "_ZN11OMSpWrapper13ClientSession11EndSequenceEbRiPNS_6ObjectERb");
                unsigned char sequence = 0;
                request_id = -1;
                status = begin(session, getenv("OMSP_COLLECTIVE") ? 2 : 1, &sequence, &request_id, NULL, response, &extension);
                printf("sequence.begin.status=0x%016" PRIx64 " sequence=%u\n", (uint64_t)status, sequence);
                if (status >= 0) {
                    request_id = -1;
                    status = end(session, false, &request_id, response, &extension);
                    printf("sequence.end.status=0x%016" PRIx64 "\n", (uint64_t)status);
                }
            }
            if (status >= 0 && getenv("OMSP_OBJECT_OPS")) {
                uintptr_t object[4] = {0};
                void (*ctor)(void *) = symbol(library, "_ZN11OMSpWrapper6ObjectC2Ev");
                int64_t (*explore)(void *, uint32_t, bool, bool, bool, void *, int *) = symbol(library,
                    "_ZN11OMSpWrapper13ClientSession7ExploreEjbbbPNS_6ObjectERi");
                ctor(object);
                int request = -1;
                uint32_t target = getenv("OMSP_APP_RID") ? (uint32_t)strtoul(getenv("OMSP_APP_RID"), NULL, 0) : 201;
                if (getenv("OMSP_EXPLORE_SESSION")) target = server_rid(session);
                if (getenv("OMSP_EXPLORE_RID")) target = (uint32_t)strtoul(getenv("OMSP_EXPLORE_RID"), NULL, 0);
                status = explore(session, target, true, getenv("OMSP_EXPLORE_PARENT") != NULL, getenv("OMSP_EXPLORE_FLAG3") != NULL, object, &request);
                printf("application.explore.status=0x%016" PRIx64 "\n", (uint64_t)status);
                destroy(object);
            }
            destroy(response);
            if (status >= 0 && getenv("OMSP_EXTENDED")) {
                const uint32_t aids[] = {1842, 1903, 65535};
                for (size_t i = 0; i < sizeof(aids)/sizeof(aids[0]); ++i) {
                    value_ctor(value);
                    response_ctor(response);
                    request_id = -1;
                    int64_t observed = get_remote(session, rid, aids[i], value, false, &request_id, response, &extension, (Qualifier){0}, false);
                    printf("extended.read.aid=%u status=0x%016" PRIx64 "\n", aids[i], (uint64_t)observed);
                    if (aids[i] == 65535 ? observed != (int64_t)UINT64_C(0xa03388000088ffe0) : observed < 0) status = -1;
                    if (observed >= 0) {
                        uint32_t actual = 0;
                        if (get_uint(value, &actual) < 0 || actual != (aids[i] == 1842 ? 4u : 4096u)) status = -1;
                    }
                    value_dtor(value);
                    destroy(response);
                }
                int64_t (*ping_again)(void *) = symbol(library, "_ZN11OMSpWrapper13ClientSession17PingServerSessionEv");
                if (status >= 0) status = ping_again(session);
                printf("extended.recovery.status=0x%016" PRIx64 "\n", (uint64_t)status);
            }
            if (status >= 0 && getenv("OMSP_SUBSCRIPTIONS")) status = probe_subscription(library, session, rid);
            if (status >= 0 && getenv("OMSP_APP_RID")) {
                unsigned application_rid = (unsigned)strtoul(getenv("OMSP_APP_RID"), NULL, 0);
                unsigned application_aid = 42;
                value_ctor(value);
                response_ctor(response);
                request_id = -1;
                status = get_remote(session, application_rid, application_aid, value, false, &request_id, response, &extension, (Qualifier){0}, false);
                uint32_t actual = 0;
                if (status >= 0) status = get_uint(value, &actual);
                if (status >= 0 && actual != 123) status = -1;
                if (status >= 0) {
                    int64_t (*set_uint)(void *, uint32_t) = symbol(library, "_ZN11OMSpWrapper5Value8SetValueEj");
                    int64_t (*set_remote)(void *, uint32_t, uint32_t, void *, unsigned char, int *, void *, bool *, Qualifier, bool) = symbol(library,
                        "_ZN11OMSpWrapper13ClientSession17SetVariableRemoteEjjPNS_5ValueEhRiPNS_6ObjectERbNS_15ObjectQualifierEb");
                    status = set_uint(value, 789);
                    request_id = -1;
                    if (status >= 0) status = set_remote(session, application_rid, application_aid, value, 0, &request_id, response, &extension, (Qualifier){0}, false);
                    request_id = -1;
                    if (status >= 0) status = get_remote(session, application_rid, application_aid, value, false, &request_id, response, &extension, (Qualifier){0}, false);
                    if (status >= 0) status = get_uint(value, &actual);
                    if (status >= 0 && actual != 789) status = -1;
                }
                printf("application.roundtrip.status=0x%016" PRIx64 " value=%u\n", (uint64_t)status, actual);
                value_dtor(value);
                destroy(response);
            }
        }
    }
    if (session[1]) {
        int64_t cleanup_status = release(sessions, session);
        printf("session.release.status=0x%016" PRIx64 "\n", (uint64_t)cleanup_status);
        if (status >= 0 && cleanup_status < 0) status = cleanup_status;
    }
cleanup:
    destroy(local);
    destroy(remote);
    destroy(session);
    destroy(sessions);
    return status;
}

int main(int argc, char **argv) {
    setvbuf(stdout, NULL, _IONBF, 0);
    if (argc != 2 && argc != 3) {
        fprintf(stderr, "usage: %s /absolute/path/libwrapper_native.so [127.0.0.1:port]\n", argv[0]);
        return 2;
    }
    void *library = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL);
    if (!library) { fprintf(stderr, "dlopen: %s\n", dlerror()); return 2; }
    native_library = library;
    void (*construct)(void *) = symbol(library, "_ZN11OMSpWrapper4RootC2Ev");
    int64_t (*start)(void *) = symbol(library, "_ZN11OMSpWrapper4Root11StartClientEv");
    void (*stop)(void *) = symbol(library, "_ZN11OMSpWrapper4Root10StopClientEv");
    Wrapper root = {0};
    puts("root.construct");
    construct(&root);
    enable_trace(construct);
    puts("root.start");
    bool server_mode = argc == 3 && strcmp(argv[2], "--server") == 0;
    if (server_mode && start_server_runtime(library) < 0) return 1;
    int64_t status = start(&root);
    printf("root.start.status=0x%016" PRIx64 "\n", (uint64_t)status);
    enable_trace(construct);
    if (status >= 0) {
        if (server_mode) {
            void *old_policy = install_tls_policy(&root);
            uintptr_t sessions[3] = {0};
            uintptr_t fixture[3] = {0};
            status = create_child(library, &root, 0x11c, sessions);
            destroy(sessions);
            if (status < 0) { stop(&root); destroy(&root); return 1; }
            if (getenv("OMSP_OBJECT_FIXTURE")) {
                status = create_child(library, &root, 0xff, fixture);
                if (status >= 0) status = set_property(library, fixture, 233, 0, "NativeOmspFixture", 0);
                if (status < 0) { stop(&root); destroy(&root); return 1; }
            }
            puts("server.ready");
            if (getenv("OMSP_OBJECT_FIXTURE")) {
                sleep(1);
                set_property(library, fixture, 233, 0, "NativeOmspChanged", 0);
                sleep(14);
                destroy(fixture);
            } else sleep(15);
            *(void **)(root.words[1] + 0x1a8) = old_policy;
        } else if (argc == 3 && strcmp(argv[2], "--server-objects") == 0) {
            status = serve_native(library, &root);
        } else if (argc == 3) status = connect_client(library, &root, argv[2]);
        puts("root.stop");
        stop(&root);
    }
    puts("root.destroy");
    destroy(&root);
    puts("done");
    /* Keep the image loaded until process exit: runtime static destructors
       may still refer to its code during shutdown. */
    return status < 0 ? 1 : 0;
}
