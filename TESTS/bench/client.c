#define _GNU_SOURCE
#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <errno.h>
#include <netinet/tcp.h>
#include <pthread.h>
#include <sched.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#define FRAME 16384
#define CLIENTS 64
static pthread_barrier_t barrier;
static int port, clients, requests, items, mode;
static uint64_t *samples;
static uint64_t now(void) {
    struct timespec t;
    if (clock_gettime(CLOCK_MONOTONIC, &t)) abort();
    return (uint64_t)t.tv_sec * 1000000000 + t.tv_nsec;
}
static void check(int condition, const char *message) {
    if (!condition) { fprintf(stderr, "%s: %s\n", message, strerror(errno)); exit(1); }
}
static void exact(int fd, unsigned char *data, size_t length, int sending) {
    while (length) {
        ssize_t n = sending ? send(fd, data, length, MSG_NOSIGNAL) : recv(fd, data, length, 0);
        if (n < 0 && errno == EINTR) continue;
        check(n > 0 && (size_t)n <= length, "socket transfer");
        data += n; length -= (size_t)n;
    }
}
static size_t response(int fd, unsigned char *buffer) {
    exact(fd, buffer, 4, 0);
    size_t length = ((size_t)buffer[2] << 8) | buffer[3];
    check(buffer[0] == 3 && buffer[1] == 0 && length >= 7 && length <= FRAME, "TPKT length");
    exact(fd, buffer + 4, length - 4, 0);
    return length;
}
static void be16(unsigned char *p, unsigned value) { p[0] = value >> 8; p[1] = value; }
static size_t request(unsigned char *p, int writing, int owner) {
    size_t parameters = 2 + items * 12, data = writing ? items * 8 : 0;
    size_t length = 17 + parameters + data;
    check(length <= 967, "request exceeds negotiated PDU");
    memset(p, 0, length);
    p[0] = 3; be16(p + 2, length); p[4] = 2; p[5] = 0xf0; p[6] = 0x80;
    p[7] = 0x32; p[8] = 1; be16(p + 11, 42); be16(p + 13, parameters); be16(p + 15, data);
    p[17] = writing ? 5 : 4; p[18] = items;
    for (int i = 0; i < items; i++) {
        unsigned char *d = p + 19 + i * 12;
        d[0] = 0x12; d[1] = 10; d[2] = 0x10; d[3] = 2;
        be16(d + 4, 4); be16(d + 6, owner + 10); d[8] = 0x84;
        unsigned address = i * 32; d[9] = address >> 16; d[10] = address >> 8; d[11] = address;
        if (writing) {
            unsigned char *v = p + 17 + parameters + i * 8;
            v[0] = 0; v[1] = 4; be16(v + 2, 32);
            v[4] = owner; v[5] = i; v[6] = 0x55; v[7] = 0xaa;
        }
    }
    return length;
}
static void exchange(int fd, unsigned char *tx, size_t length, unsigned char *rx, int writing, int owner) {
    exact(fd, tx, length, 1);
    size_t got = response(fd, rx);
    check(got == (size_t)(21 + items * (writing ? 1 : 8)), "response size");
    check(rx[7] == 0x32 && rx[8] == 3 && rx[11] == 0 && rx[12] == 42 && rx[17] == 0 && rx[18] == 0, "S7 response header");
    check(rx[19] == (writing ? 5 : 4) && rx[20] == items, "response item count");
    for (int i = 0; i < items; i++) {
        size_t offset = 21 + i * (writing ? 1 : 8);
        check(rx[offset] == 255, "item error");
        if (!writing) {
            check(rx[offset + 1] == 4 && rx[offset + 2] == 0 && rx[offset + 3] == 32, "read transport");
            check(rx[offset + 4] == owner && rx[offset + 5] == i && rx[offset + 6] == 0x55 && rx[offset + 7] == 0xaa, "data mismatch");
        }
    }
}
static void *worker(void *argument) {
    int owner = (int)(intptr_t)argument;
    int fd = socket(AF_INET, SOCK_STREAM, 0), one = 1;
    check(fd >= 0, "socket");
    check(!setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one)), "TCP_NODELAY");
    struct timeval timeout = { .tv_sec = 5 };
    check(!setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout)), "receive timeout");
    check(!setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout)), "send timeout");
    struct sockaddr_in address = { .sin_family = AF_INET, .sin_port = htons(port), .sin_addr.s_addr = htonl(INADDR_LOOPBACK) };
    check(!connect(fd, (struct sockaddr *)&address, sizeof(address)), "connect");
    unsigned char rx[FRAME], read[FRAME], write[FRAME];
    unsigned char cr[] = {3,0,0,22,17,0xe0,0,0,0,1,0,0xc0,1,9,0xc1,2,0x4b,0x54,0xc2,2,3,1};
    exact(fd, cr, sizeof(cr), 1); check(response(fd, rx) >= 11 && rx[5] == 0xd0, "COTP setup");
    unsigned char setup[] = {3,0,0,25,2,0xf0,0x80,0x32,1,0,0,0,2,0,8,0,0,0xf0,0,0,1,0,1,3,0xc0};
    exact(fd, setup, sizeof(setup), 1); check(response(fd, rx) == 27 && rx[25] == 3 && rx[26] == 0xc0, "PDU setup");
    size_t nr = request(read, 0, owner), nw = request(write, 1, owner);
    exchange(fd, write, nw, rx, 1, owner);
    for (int i = 0; i < 1000; i++) exchange(fd, read, nr, rx, 0, owner);
    pthread_barrier_wait(&barrier);
    for (int i = 0; i < requests; i++) {
        int writing = mode == 1 || (mode == 2 && (i & 1));
        uint64_t begin = now();
        exchange(fd, writing ? write : read, writing ? nw : nr, rx, writing, owner);
        samples[(size_t)owner * requests + i] = now() - begin;
    }
    check(!close(fd), "close"); return NULL;
}
static int compare(const void *a, const void *b) {
    uint64_t x = *(const uint64_t *)a, y = *(const uint64_t *)b;
    return (x > y) - (x < y);
}
int main(int argc, char **argv) {
    check(argc == 6, "Usage: client port clients requests items mode(0=read,1=write,2=mixed)");
    const char *cpu = getenv("Z7_BENCH_CLIENT_CPU");
    if (cpu) {
        int index = atoi(cpu);
        check(index >= 0 && index < CPU_SETSIZE, "client CPU bound");
        cpu_set_t set; CPU_ZERO(&set); CPU_SET(index, &set);
        check(!sched_setaffinity(0, sizeof(set), &set), "client CPU affinity");
    }
    port = atoi(argv[1]); clients = atoi(argv[2]); requests = atoi(argv[3]); items = atoi(argv[4]); mode = atoi(argv[5]);
    check(port > 0 && port < 65536 && clients >= 1 && clients <= CLIENTS && requests >= 1000 && requests <= 1000000 && items >= 1 && items <= 32 && mode >= 0 && mode <= 2, "argument bounds");
    size_t count = (size_t)clients * requests;
    samples = calloc(count, sizeof(*samples)); check(samples != NULL, "sample allocation");
    check(!pthread_barrier_init(&barrier, NULL, clients + 1), "barrier");
    pthread_t threads[CLIENTS];
    for (int i = 0; i < clients; i++) check(!pthread_create(&threads[i], NULL, worker, (void *)(intptr_t)i), "thread creation");
    uint64_t begin = now();
    pthread_barrier_wait(&barrier);
    begin = now();
    for (int i = 0; i < clients; i++) check(!pthread_join(threads[i], NULL), "thread join");
    double elapsed = (now() - begin) / 1e9;
    struct rusage usage; check(!getrusage(RUSAGE_SELF, &usage), "rusage");
    qsort(samples, count, sizeof(*samples), compare);
    printf("{\"clients\":%d,\"requests\":%zu,\"items_per_request\":%d,\"mode\":%d,\"seconds\":%.6f,\"requests_per_second\":%.1f,\"p50_us\":%.3f,\"p95_us\":%.3f,\"p99_us\":%.3f,\"max_us\":%.3f,\"client_cpu_seconds\":%.6f}\n",
        clients, count, items, mode, elapsed, count / elapsed, samples[count / 2] / 1e3, samples[count * 95 / 100] / 1e3, samples[count * 99 / 100] / 1e3, samples[count - 1] / 1e3,
        usage.ru_utime.tv_sec + usage.ru_utime.tv_usec / 1e6 + usage.ru_stime.tv_sec + usage.ru_stime.tv_usec / 1e6);
    check(!pthread_barrier_destroy(&barrier), "barrier destroy"); free(samples); return 0;
}
