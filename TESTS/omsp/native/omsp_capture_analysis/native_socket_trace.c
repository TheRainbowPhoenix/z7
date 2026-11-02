#define _GNU_SOURCE
#include <arpa/inet.h>
#include <dlfcn.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/uio.h>

static const struct sockaddr *test_address(const struct sockaddr *address, socklen_t length,
                                           struct sockaddr_in *mapped) {
    const char *text = getenv("OMSP_TEST_PORT");
    if (!text || !address || address->sa_family != AF_INET || length != sizeof(*mapped)) return address;
    const struct sockaddr_in *original = (const void *)address;
    if (ntohs(original->sin_port) != 102) return address;
    char *end;
    unsigned long port = strtoul(text, &end, 10);
    if (!*text || *end || port < 1024 || port > 65535) abort();
    memcpy(mapped, original, sizeof(*mapped));
    mapped->sin_port = htons((unsigned short)port);
    mapped->sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    return (const void *)mapped;
}

static void dump(const char *operation, int fd, const void *bytes, ssize_t count) {
    if (count <= 0) return;
    const unsigned char *data = bytes;
    fprintf(stderr, "socket.%s fd=%d bytes=%zd hex=", operation, fd, count);
    for (ssize_t i = 0; i < count && i < 48; ++i) fprintf(stderr, "%02x", data[i]);
    fputc('\n', stderr);
}

int bind(int fd, const struct sockaddr *address, socklen_t length) {
    int (*next)(int, const struct sockaddr *, socklen_t) = dlsym(RTLD_NEXT, "bind");
    int reuse = 1;
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
    struct sockaddr_in mapped;
    address = test_address(address, length, &mapped);
    int result = next(fd, address, length);
    int saved_errno = errno;
    fprintf(stderr, "socket.bind fd=%d result=%d errno=%d\n", fd, result, saved_errno);
    errno = saved_errno;
    return result;
}

ssize_t send(int fd, const void *bytes, size_t count, int flags) {
    ssize_t (*next)(int, const void *, size_t, int) = dlsym(RTLD_NEXT, "send");
    ssize_t result = next(fd, bytes, count, flags);
    int saved_errno = errno;
    dump("send", fd, bytes, result);
    errno = saved_errno;
    return result;
}

ssize_t recv(int fd, void *bytes, size_t count, int flags) {
    ssize_t (*next)(int, void *, size_t, int) = dlsym(RTLD_NEXT, "recv");
    ssize_t result = next(fd, bytes, count, flags);
    int saved_errno = errno;
    dump("recv", fd, bytes, result);
    errno = saved_errno;
    return result;
}

ssize_t readv(int fd, const struct iovec *vectors, int count) {
    ssize_t (*next)(int, const struct iovec *, int) = dlsym(RTLD_NEXT, "readv");
    ssize_t result = next(fd, vectors, count);
    int saved_errno = errno;
    if (count > 0 && result > 0) dump("readv", fd, vectors[0].iov_base,
        result < (ssize_t)vectors[0].iov_len ? result : (ssize_t)vectors[0].iov_len);
    errno = saved_errno;
    return result;
}

ssize_t writev(int fd, const struct iovec *vectors, int count) {
    ssize_t (*next)(int, const struct iovec *, int) = dlsym(RTLD_NEXT, "writev");
    ssize_t result = next(fd, vectors, count);
    int saved_errno = errno;
    if (count > 0 && result > 0) dump("writev", fd, vectors[0].iov_base,
        result < (ssize_t)vectors[0].iov_len ? result : (ssize_t)vectors[0].iov_len);
    errno = saved_errno;
    return result;
}

ssize_t sendmsg(int fd, const struct msghdr *message, int flags) {
    ssize_t (*next)(int, const struct msghdr *, int) = dlsym(RTLD_NEXT, "sendmsg");
    ssize_t result = next(fd, message, flags);
    int saved_errno = errno;
    if (message->msg_iovlen && result > 0) dump("sendmsg", fd, message->msg_iov[0].iov_base,
        result < (ssize_t)message->msg_iov[0].iov_len ? result : (ssize_t)message->msg_iov[0].iov_len);
    errno = saved_errno;
    return result;
}

ssize_t recvmsg(int fd, struct msghdr *message, int flags) {
    ssize_t (*next)(int, struct msghdr *, int) = dlsym(RTLD_NEXT, "recvmsg");
    ssize_t result = next(fd, message, flags);
    int saved_errno = errno;
    if (message->msg_iovlen && result > 0) dump("recvmsg", fd, message->msg_iov[0].iov_base,
        result < (ssize_t)message->msg_iov[0].iov_len ? result : (ssize_t)message->msg_iov[0].iov_len);
    errno = saved_errno;
    return result;
}

int connect(int fd, const struct sockaddr *address, socklen_t length) {
    int (*next)(int, const struct sockaddr *, socklen_t) = dlsym(RTLD_NEXT, "connect");
    struct sockaddr_in mapped;
    address = test_address(address, length, &mapped);
    if (address && address->sa_family == AF_INET && length >= sizeof(struct sockaddr_in)) {
        const struct sockaddr_in *ipv4 = (const void *)address;
        char text[INET_ADDRSTRLEN];
        fprintf(stderr, "socket.connect fd=%d address=%s:%u\n", fd,
                inet_ntop(AF_INET, &ipv4->sin_addr, text, sizeof(text)), ntohs(ipv4->sin_port));
    }
    int result = next(fd, address, length);
    int saved_errno = errno;
    fprintf(stderr, "socket.connect result=%d errno=%d\n", result, saved_errno);
    errno = saved_errno;
    return result;
}
