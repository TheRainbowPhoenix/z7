"""A host-owned dummy compiler behind zOMSp. No PLC code is executed.

Run with --help. The remote client uploads a bounded expression as a WString;
the activation validator compiles the private snapshot. After commit the host
publishes its result into a read-only mapped UDInt. Replace compile_source with
an actual compiler adapter; keep validation free of external side effects.
"""
import argparse
import ast
import ctypes as C
import io
from pathlib import Path
import sys
import tempfile
from activation import Handler, REJECT
from mapped import Store


def compile_source(source):
    if len(source.encode('utf-8')) > 900:
        raise ValueError('source too large')
    tree = ast.parse(source, mode='eval')
    if sum(1 for _ in ast.walk(tree)) > 32:
        raise ValueError('expression too complex')
    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) is int:
            result = node.value
        elif isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Mult)):
            left, right = visit(node.left), visit(node.right)
            result = left + right if isinstance(node.op, ast.Add) else left * right
        else:
            raise ValueError('only unsigned constants, addition and multiplication are allowed')
        if not 0 <= result <= 0xffffffff:
            raise ValueError('UDInt overflow')
        return result
    return visit(tree.body)


def check(library, reference, credentials, python_path):
    sys.path.insert(0, str(Path(python_path).resolve()))
    from s7commplus.omsp.session import Session
    from s7commplus.core.pvalue import PValue, ValueWString, ValueUDInt, ValueVariantSparseArray
    def encoded(value):
        raw = io.BytesIO(); value.serialize(raw); return raw.getvalue()
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder)
        store = Store(library, path/'application.shm')
        compiled = {}
        try:
            store.object(201, 0, 213)
            store.object(1000, 201, 9001)
            assert store.set(1000, 42, encoded(ValueWString('1'))) == 0
            assert store.set(1000, 43, encoded(ValueUDInt(1)), writable=False) == 0
            lib = store.lib
            lib.zomsp_transactions.argtypes = [C.c_void_p, C.c_uint8]
            lib.zomsp_activation.argtypes = [C.c_void_p, Handler, C.c_void_p]
            lib.zomsp_activation.restype = C.c_int32
            @Handler
            def validate(user, info, directives, length, image, size):
                try:
                    if size != lib.zomsp_size() or C.string_at(image, 8) != b'zOMSp001':
                        return REJECT
                    snapshot = path/'candidate.shm'
                    snapshot.write_bytes(C.string_at(image, size))
                    candidate = Store(library, snapshot, create=False)
                    try: raw = candidate.get(1000, 42)
                    finally: candidate.close()
                    source = PValue.deserialize(io.BytesIO(raw))
                    if not isinstance(source, ValueWString): return REJECT
                    compiled[raw] = compile_source(source.value)
                    return 0
                except Exception:
                    return REJECT
            assert lib.zomsp_transactions(store.handle, 1) == 0
            assert lib.zomsp_activation(store.handle, validate, None) == 0
            certs = Path(credentials)
            port = store.start(certs/'server-cert.pem', certs/'server-key.pem', reference)
            with Session('127.0.0.1', port, certs/'server-cert.pem') as client:
                client.start_transaction(ValueVariantSparseArray({1: ValueUDInt(0)}))
                client.write(1000, 42, ValueWString('6 * 7 + 1'))
                assert store.get(1000, 42) == encoded(ValueWString('1'))
                client.end_sequence()
                committed = store.get(1000, 42)
                assert compiled[committed] == 43
                # This is a host runtime action after publication, not part of validation.
                assert store.set(1000, 43, encoded(ValueUDInt(compiled[committed])), writable=False) == 0
                assert client.read(43, 1000).value == 43
                client.start_transaction(ValueVariantSparseArray({1: ValueUDInt(0)}))
                client.write(1000, 42, ValueWString('4294967295 * 2'))
                try:
                    client.end_sequence()
                except Exception:
                    pass
                else:
                    raise AssertionError('invalid upload accepted')
                assert store.get(1000, 42) == committed
                assert client.read(43, 1000).value == 43
            print('Dummy compiler: TLS upload -> private compile -> commit -> host result; rejected overflow preserves live program: passed')
        finally:
            store.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('library'); parser.add_argument('--reference', required=True)
    parser.add_argument('--credentials', required=True); parser.add_argument('--python-path', required=True)
    args = parser.parse_args(); check(args.library, args.reference, args.credentials, args.python_path)
