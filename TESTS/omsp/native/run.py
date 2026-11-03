"""Run the pinned Linux x64 native reference against both zOMSp endpoint roles."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import struct

HERE = Path(__file__).resolve().parent
SHA256 = 'e967cc414222a5ff9b869a072094cf769e46b6ca95963ec3ff733ca509155445'


def prepare_reference(source, target):
    data = bytearray(source.read_bytes())
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise RuntimeError('native reference checksum mismatch')
    if data[:6] != b'\x7fELF\x02\x01' or struct.unpack_from('<H', data, 18)[0] != 62:
        raise RuntimeError('expected little-endian x86-64 ELF reference')
    offset = struct.unpack_from('<Q', data, 32)[0]
    entry_size, count = struct.unpack_from('<HH', data, 54)
    if entry_size < 56 or offset > len(data) or count > (len(data) - offset) // entry_size:
        raise RuntimeError('invalid ELF program-header table')
    stacks = 0
    for index in range(count):
        entry = offset + index * entry_size
        kind, flags = struct.unpack_from('<II', data, entry)
        if kind == 0x6474e551:  # PT_GNU_STACK
            struct.pack_into('<I', data, entry + 4, flags & ~1)
            stacks += 1
    if stacks != 1:
        raise RuntimeError('expected exactly one GNU stack header')
    target.write_bytes(data)
    return target


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', required=True)
    parser.add_argument('--cc', required=True, help='Zig compiler executable')
    parser.add_argument('--credentials', type=Path, help='Existing disposable PEM/DER test credentials')
    args = parser.parse_args()
    binary = str(Path(args.binary).resolve(strict=True))
    cc = str(Path(args.cc).resolve(strict=True))
    work = HERE / 'omsp_capture_analysis'
    library = prepare_reference(HERE / 'libwrapper_native.so', work / 'libwrapper_native-nx.so')
    for source, output, flags in (
        ('native_probe.c', 'native_probe', []),
        ('native_socket_trace.c', 'native_socket_trace.so', ['-shared', '-fPIC']),
    ):
        subprocess.run([cc, 'cc', '-O2', *flags, str(work / source), '-o',
                        str(work / output), '-ldl', '-pthread'], check=True)
    credentials = work / 'native_test_credentials'
    credentials.mkdir(exist_ok=True)
    cert = credentials / 'server-cert.pem'
    if args.credentials:
        for name in ('server-cert.pem', 'server-key.pem', 'server-cert.der'):
            shutil.copy2(args.credentials / name, credentials / name)
    else:
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                        '-keyout', str(credentials / 'server-key.pem'), '-out', str(cert),
                        '-days', '2', '-subj', '/CN=127.0.0.1', '-addext',
                        'subjectAltName=IP:127.0.0.1'], check=True)
        subprocess.run(['openssl', 'x509', '-in', str(cert), '-outform', 'DER',
                        '-out', str(credentials / 'server-cert.der')], check=True)
    env = dict(os.environ, ZOMSP_BINARY=binary,
               OMSP_INTEROP_MODES='native_both,zomsp_client_native,native_client_zomsp',
               OMSP_INVOKE='1', OMSP_ENDPOINT_SWEEP='1')
    for name in ('OMSP_VIA_PROXY', 'OMSP_EXTENDED', 'OMSP_APP_RID', 'OMSP_SUBSCRIPTIONS'):
        env.pop(name, None)
    result = subprocess.call([sys.executable, str(work / 'run_python_interop.py'),
                              str(library)], cwd=HERE, env=env)
    if result:
        return result
    shared = Path(binary).parent.parent / 'lib' / 'libzomsp.so'
    for test in ('invoke.py', 'authentication.py', 'modern.py', 'activation.py'):
        command = [sys.executable, str(HERE.parent / test), str(shared),
                   '--native', str(work / 'native_probe'), '--reference', str(library),
                   '--credentials', str(credentials)]
        if test in ('modern.py', 'activation.py'):
            command += ['--binary', binary]
        result = subprocess.call(command, cwd=HERE.parents[2])
        if result:
            return result
    return subprocess.call([sys.executable, str(HERE.parent / 'large_program.py'),
        '--library', str(shared), '--binary', binary, '--reference', str(library),
        '--native-reference', str(library), '--native', str(work / 'native_probe'),
        '--credentials', str(credentials), '--clients', 'native'], cwd=HERE.parents[2])


if __name__ == '__main__':
    raise SystemExit(main())
