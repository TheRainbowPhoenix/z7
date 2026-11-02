"""Exercise the repository Python stack against the native reference in both roles."""
import json
import hashlib
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))

def python_client():
    from s7commplus.omsp.tia_client import TiaQueryClient
    port = int(os.environ.get('OMSP_CLIENT_PORT', '30202'))
    client = TiaQueryClient('127.0.0.1', port, timeout=3)
    result = {}
    try:
        result['transport'] = client.connect_transport()
        if result['transport']['ok']:
            result['create_object'] = client.create_object()
            result['session_setup'] = client.session_setup()
            if result['session_setup']['ok']:
                fixture = json.loads((HERE / 'native_login_fixture.json').read_text())
                pdu = bytearray.fromhex(fixture['peer0_4'])
                sequence = client.conn._get_next_sequence_number()
                pdu[11:13] = sequence.to_bytes(2, 'big')
                pdu[13:17] = client.session_id.to_bytes(4, 'big')
                pdu[18:22] = client.session_id.to_bytes(4, 'big')
                client.conn.send_raw(bytes(pdu))
                reply = client.conn.wait_for_pdu(3)
                result['native_login_query'] = {'request': pdu.hex(), 'reply': reply.hex() if reply else None}
                for name, hex_data in fixture.items():
                    original = bytes.fromhex(hex_data)
                    if original[4] != 0x31 or original[7:9] != b'\x05\x86': continue
                    pdu = bytearray(original)
                    pdu[11:13] = client.conn._get_next_sequence_number().to_bytes(2, 'big')
                    pdu[13:17] = client.session_id.to_bytes(4, 'big')
                    pdu[18:22] = client.session_id.to_bytes(4, 'big')
                    client.conn.send_raw(bytes(pdu))
                    reply = client.conn.wait_for_pdu(3)
                    result['native_read_query'] = {'request': pdu.hex(), 'reply': reply.hex() if reply else None}
    except Exception as error:
        result['error'] = repr(error)
    finally:
        client._close_connection()
    if result.get('session_setup', {}).get('ok'):
        from s7commplus.omsp.session import Session
        try:
            with Session('127.0.0.1', port, HERE / 'native_test_credentials/server-cert.pem') as session:
                ping = session.read(300).value
                before = session.read(299).value
                session.write_role(32)
                after = session.read(299).value
                result['roundtrip'] = {'ok': ping == session.client_rid and before == 2 and after == 32,
                                       'before': before, 'after': after, 'ping': ping == session.client_rid}
        except Exception as error:
            result['roundtrip'] = {'ok': False, 'error': repr(error)}
    print(json.dumps(result, indent=2))
    return 0 if result.get('session_setup', {}).get('ok') and result.get('roundtrip', {}).get('ok') else 1

def python_server():
    from s7commplus.omsp.dummy_plc import serve
    credentials = HERE / 'native_test_credentials'
    serve(('127.0.0.1', 30202), str(HERE / 'interop_captures'),
          certfile=str(credentials / 'server-cert.pem'), keyfile=str(credentials / 'server-key.pem'))
    print('server.ready', flush=True)
    time.sleep(20)

def run_pair(mode, library):
    native = [str(HERE / 'native_probe'), library]
    env = dict(os.environ, LD_PRELOAD=str(HERE / 'native_socket_trace.so'), OMSP_TEST_PORT='30202')
    zomsp = os.environ.get('ZOMSP_BINARY')
    credentials = HERE / 'native_test_credentials'
    cert = str(credentials / 'server-cert.pem')
    key = str(credentials / 'server-key.pem')
    client_kind, server_kind = {
        'python_client': ('python', 'native'), 'python_server': ('native', 'python'),
        'zomsp_client_native': ('zomsp', 'native'), 'native_client_zomsp': ('native', 'zomsp'),
        'python_client_zomsp': ('python', 'zomsp'), 'zomsp_client_python': ('zomsp', 'python'),
        'zomsp_both': ('zomsp', 'zomsp'),
    }[mode]
    if server_kind == 'native': server_args = native + ['--server']
    elif server_kind == 'python': server_args = [sys.executable, __file__, '--python-server']
    else: server_args = [zomsp, '--server', '30202', cert, key, library]
    server = subprocess.Popen(server_args, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    lines = []
    ready = threading.Event()
    def collect():
        for line in server.stdout:
            lines.append(line.rstrip())
            if line.strip() == 'server.ready' or 'zOMSp server listening' in line: ready.set()
    reader = threading.Thread(target=collect, daemon=True)
    reader.start()
    result = {'mode': mode}
    proxy = None
    proxy_log = []
    try:
        if not ready.wait(8): raise RuntimeError('server did not initialize')
        time.sleep(0.3)
        client_env = dict(env)
        port = '30202'
        if os.environ.get('OMSP_VIA_PROXY'):
            port = '30203'
            proxy = subprocess.Popen([zomsp, port, '127.0.0.1', '30202'], env=env,
                                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            proxy_ready = threading.Event()
            def proxy_collect():
                for line in proxy.stdout:
                    proxy_log.append(line.rstrip())
                    if 'zOMSp listening' in line: proxy_ready.set()
            threading.Thread(target=proxy_collect, daemon=True).start()
            if not proxy_ready.wait(4): raise RuntimeError('proxy did not initialize')
            result['via_proxy'] = True
        client_env.update(OMSP_TEST_PORT=port, OMSP_CLIENT_PORT=port)
        if client_kind == 'python': args = [sys.executable, __file__, '--python-client']
        elif client_kind == 'native': args = native + ['::127.0.0.1:SIMATIC-ROOT-ES:6.0']
        else: args = [zomsp, '--client', '127.0.0.1', port, cert, library]
        client = subprocess.run(args, env=client_env, capture_output=True, text=True, timeout=12)
        result.update(client_exit=client.returncode, client_output=client.stdout, client_stderr=client.stderr)
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        result['error'] = str(error)
    finally:
        if proxy is not None:
            proxy.terminate()
            try: proxy.wait(timeout=3)
            except subprocess.TimeoutExpired: proxy.kill(); proxy.wait()
            result['proxy_output'] = proxy_log
        server.terminate()
        try: server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server.kill(); server.wait()
        reader.join(2)
    result['server_output'] = lines
    result['passed'] = result.get('client_exit') == 0
    if result['passed'] and client_kind == 'python':
        try: result['passed'] = json.loads(result['client_output'])['roundtrip']['ok'] is True
        except (ValueError, KeyError): result['passed'] = False
    elif result['passed'] and client_kind == 'zomsp':
        result['passed'] = 'roundtrip=ok role=2->32' in result.get('client_stderr', '')
    elif result['passed']:
        result['passed'] = 'session.readback.role=32' in result.get('client_output', '')
    return result

if __name__ == '__main__':
    if sys.argv[1:] == ['--python-client']: sys.exit(python_client())
    if sys.argv[1:] == ['--python-server']: python_server(); sys.exit(0)
    if len(sys.argv) != 2: sys.exit('usage: run_python_interop.py LIBRARY')
    if hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest() != 'cd1320970e26efd0696b9cc21d1ba15310476da790879bc97a4dad6c9c56cf5f':
        sys.exit('unsupported native reference build')
    modes = ['python_client', 'python_server']
    if os.environ.get('ZOMSP_BINARY'):
        modes += ['zomsp_client_native', 'native_client_zomsp', 'python_client_zomsp',
                  'zomsp_client_python', 'zomsp_both']
    if os.environ.get('OMSP_INTEROP_MODES'):
        modes = os.environ['OMSP_INTEROP_MODES'].split(',')
    results = [run_pair(mode, sys.argv[1]) for mode in modes]
    name = 'python_interop_proxy.json' if os.environ.get('OMSP_VIA_PROXY') else 'python_interop_latest.json'
    (HERE / name).write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))
    sys.exit(0 if all(result['passed'] for result in results) else 1)
