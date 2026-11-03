"""Certificate-verified TLS/COTP integration using only Python's standard library."""
import json
import os
from pathlib import Path
import shutil
import socket
import ssl
import struct
import subprocess
import sys
import tempfile
import time
from mapped import Store
from wire import frame, QUALIFIER


def check(library, runtime):
    runtime = Path(runtime).resolve()
    manifest = json.loads((runtime / 'openssl-manifest.json').read_text())
    tls_library = runtime / next(item['name'] for item in manifest['libraries'] if item['name'].startswith('libssl'))
    openssl = shutil.which('openssl')
    if not openssl and os.name == 'nt':
        root = Path(shutil.which('git')).resolve().parent.parent
        openssl = str(root / 'mingw64/bin/openssl.exe')
    supplied_cert, supplied_key = os.environ.get('ZOMSP_TEST_CERT'), os.environ.get('ZOMSP_TEST_KEY')
    if bool(supplied_cert) != bool(supplied_key):
        raise RuntimeError('supply both ZOMSP_TEST_CERT and ZOMSP_TEST_KEY')
    if not openssl and not supplied_cert:
        raise RuntimeError('openssl executable required to generate the temporary test certificate')
    fixture = json.loads(Path(__file__).with_name('native_requests.json').read_text())['requests']
    with tempfile.TemporaryDirectory() as folder:
        folder = Path(folder)
        cert, key = folder / 'cert.pem', folder / 'key.pem'
        if supplied_cert:
            shutil.copyfile(supplied_cert, cert)
            shutil.copyfile(supplied_key, key)
        else:
            subprocess.run([openssl, 'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
                '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1',
                '-keyout', str(key), '-out', str(cert)], check=True, capture_output=True)
        store = Store(library, folder / 'objects.shm')
        try:
            store.object(201, 0, 213)
            store.object(1000, 201, 255)
            assert store.set(1000, 42, b'\0\x04\x7b') == 0
            port = store.start(cert, key, tls_library)
            with socket.create_connection(('127.0.0.1', port), timeout=3) as sock:
                sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

                def exact(size):
                    output = bytearray()
                    while len(output) < size:
                        chunk = sock.recv(size - len(output))
                        if not chunk:
                            raise EOFError('peer closed')
                        output.extend(chunk)
                    return bytes(output)

                def cotp(data):
                    sock.sendall(b'\x03\0' + struct.pack('>H', len(data) + 7) + b'\x02\xf0\x80' + data)

                def receive():
                    header = exact(4)
                    size = int.from_bytes(header[2:4], 'big')
                    assert header[:2] == b'\x03\0' and 7 <= size <= 65535
                    return exact(size - 4)

                sock.sendall(bytes.fromhex('030000231ee00000000100c1020600c20f53494d415449432d524f4f542d4553c0010a'))
                assert receive()[1] == 0xd0
                cotp(bytes.fromhex('7201001231000005b300000001000000003000000000'))
                assert receive()[10:12] == b'\x05\xb3'
                incoming, outgoing = ssl.MemoryBIO(), ssl.MemoryBIO()
                context = ssl.create_default_context(cafile=str(cert))
                tls = context.wrap_bio(incoming, outgoing, server_hostname='127.0.0.1')

                def flush():
                    while outgoing.pending:
                        cotp(outgoing.read(16384))

                while True:
                    try:
                        tls.do_handshake()
                        flush()
                        break
                    except ssl.SSLWantReadError:
                        flush()
                        packet = receive()
                        assert packet[:3] == b'\x02\xf0\x80'
                        incoming.write(packet[3:])

                plaintext = bytearray()
                def exchange(request):
                    assert tls.write(request) == len(request)
                    flush()
                    while True:
                        if len(plaintext) >= 4:
                            size = 4 + int.from_bytes(plaintext[2:4], 'big')
                            if len(plaintext) >= size:
                                reply = bytes(plaintext[:size])
                                del plaintext[:size]
                                if size == 4:
                                    continue
                                assert reply[4] == 0x32 and reply[7:9] == request[7:9]
                                return reply[14:]
                        try:
                            chunk = tls.read(65535 - len(plaintext))
                            if not chunk:
                                raise EOFError('TLS peer closed')
                            plaintext.extend(chunk)
                        except ssl.SSLWantReadError:
                            packet = receive()
                            assert packet[:3] == b'\x02\xf0\x80'
                            incoming.write(packet[3:])
                            flush()
                exchange(bytes.fromhex(fixture['peer0_2']))
                exchange(bytes.fromhex(fixture['peer0_3']).replace(bytes.fromhex('7000103d'), bytes.fromhex('70001001')))
                read = frame(0x586, 1000, b'\x20\x04\x01\x2a' + QUALIFIER + b'\0\x01\x01' + b'\0' * 4)
                assert exchange(read) == bytes.fromhex('000000047b0500000000')
                write = frame(0x4f2, 1000, b'\x01\x2a\0\x04\x09' + QUALIFIER + b'\0\x04' + b'\0' * 4)
                assert exchange(write) == bytes.fromhex('000800000000')
                assert store.get(1000, 42) == b'\0\x04\x09'
            store.lib.zomsp_stop(store.handle)
            port = store.start(cert, key, tls_library)
            with socket.create_connection(('127.0.0.1', port), timeout=1) as partial:
                partial.sendall(b'\x03\0')
                time.sleep(0.02)
                started = time.monotonic()
                store.lib.zomsp_stop(store.handle)
                assert time.monotonic() - started < 1
        finally:
            store.close()
        from modern import check as check_credentials
        credentials = folder / 'credentials'
        credentials.mkdir()
        shutil.copyfile(cert, credentials / 'server-cert.pem')
        shutil.copyfile(key, credentials / 'server-key.pem')
        executable = runtime / ('zOMSp.exe' if os.name == 'nt' else 'zOMSp')
        check_credentials(library, tls_library, credentials, binary=executable)
        from activation import check as check_activation
        check_activation(library, reference=tls_library, credentials=credentials, binary=executable)
        from program import check as check_program
        check_program(library, tls_library, credentials, executable)
        from types import SimpleNamespace
        from large_program import check as check_large_program
        check_large_program(SimpleNamespace(library=library, reference=tls_library,
            credentials=credentials, binary=executable, clients='zomsp'))
        from sdk import check as check_sdk
        check_sdk(library, tls_library, credentials)
        if os.environ.get('ZOMSP_TEST_DENO') == '1':
            from deno_ffi import check as check_deno
            check_deno(library, tls_library, credentials)
    print('OMSp bundled TLS: verified handshake, native login, mapped read/write and cancelled partial handshake passed')


if __name__ == '__main__':
    check(*sys.argv[1:])
