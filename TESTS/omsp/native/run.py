"""Run the pinned Linux x64 native reference against both zOMSp endpoint roles."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
SHA256 = 'e967cc414222a5ff9b869a072094cf769e46b6ca95963ec3ff733ca509155445'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', required=True)
    parser.add_argument('--cc', required=True, help='Zig compiler executable')
    parser.add_argument('--credentials', type=Path, help='Existing disposable PEM/DER test credentials')
    args = parser.parse_args()
    binary = str(Path(args.binary).resolve(strict=True))
    cc = str(Path(args.cc).resolve(strict=True))
    library = HERE / 'libwrapper_native.so'
    if hashlib.sha256(library.read_bytes()).hexdigest() != SHA256:
        raise RuntimeError('native reference checksum mismatch')
    work = HERE / 'omsp_capture_analysis'
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
               OMSP_INTEROP_MODES='zomsp_client_native,native_client_zomsp')
    for name in ('OMSP_VIA_PROXY', 'OMSP_EXTENDED', 'OMSP_APP_RID', 'OMSP_SUBSCRIPTIONS'):
        env.pop(name, None)
    return subprocess.call([sys.executable, str(work / 'run_python_interop.py'),
                            str(library)], cwd=HERE, env=env)


if __name__ == '__main__':
    raise SystemExit(main())
