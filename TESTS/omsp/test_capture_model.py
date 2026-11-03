"""Capture extraction: safe literal parsing, exact values, links and explicit gaps."""
import ctypes as C
from contextlib import closing
import struct
import sys
import tempfile
from pathlib import Path
import zipfile
from capture_model import extract,materialize
from mapped import Store
from wire import frame,vlq


def response(function,sequence,payload):
    body=b'\x32\0\0'+struct.pack('>H',function)+b'\0\0'+struct.pack('>H',sequence)+b'\x34'+payload
    return b'\x72\x02'+struct.pack('>H',len(body))+body


def check(library):
    with tempfile.TemporaryDirectory() as directory:
        folder=Path(directory);archive=folder/'capture.zip';mapping=folder/'model.shm'
        sentinel=folder/'keep';sentinel.write_text('retained')
        root=b'\xa1'+struct.pack('>I',1000)+vlq(213)+b'\0\0\xa3'+vlq(233)+b'\0\x15\x08Captured'
        root+=b'\xa3\x2a\0\x04\x7b\xa4'+vlq(2699)+struct.pack('>I',1001)
        root+=b'\xa1'+struct.pack('>I',1001)+vlq(213)+b'\0\0\xa3'+vlq(233)+b'\0\x15\x05Child\xa2\xa2'
        rows=[('peer0_1',frame(0x4bb,1000,b'\0\x01\x01\0\0\0\x01\0'+b'\0'*4,seq=1)),
            ('peer1_1',response(0x4bb,1,b'\0'+b'\0'*4+b'\x05'+root+b'\0'*4)),
            ('peer0_2',frame(0x586,1000,b'\x20\x04\x01\x2a',seq=2)),
            ('peer1_2',response(0x586,2,b'\0\0\0\x04\x7c\x09'+b'\0'*4)),
            ('peer0_3',frame(0x586,1000,b'\x20\x04\x02\x2b\x01',seq=3)),
            ('peer1_3',response(0x586,3,b'\0\0\0\x04\x01\x0d'+b'\0'*4)),
            ('peer0_4',frame(0x586,1000,b'\x20\x04\x01\x2c',seq=4)),
            ('peer1_4',response(0x586,4,b'\0\0\0\x14\0'+vlq(1024)+b'x'*1024+b'\x11'+b'\0'*4)),
            ('peer0_5',frame(0x586,1000,b'\x20\x04\x01\x2d',seq=5)),
            ('peer1_5',response(0x586,5,b'\0\0\0\x1f'+b'\0'*4))]
        text='\n'.join(name+' = '+repr(raw) for name,raw in rows)
        text+='\npeer0_bad = __import__("pathlib").Path('+repr(str(sentinel))+').unlink()\n'
        with zipfile.ZipFile(archive,'w') as output:output.writestr('capture.py',text)
        model=extract(library,[archive])
        assert sentinel.read_text()=='retained'
        assert model['stats']['mapped_objects']==2 and model['stats']['mapped_values']==3,model['stats']
        assert model['stats']['nested_reads_not_flattened']==1
        assert model['stats']['oversized_values']==1
        assert model['stats']['unsupported_or_truncated_pairs']==1
        assert model['links']==[{'rid':1000,'aid':2699,'targets':[1001]}]
        materialize(library,mapping,model)
        with closing(Store(library,mapping,create=False)) as store:
            assert store.get(1000,42)==b'\0\x04\x7c'
            assert store.get(1000,2699)==b'\x10\x12\x01'+struct.pack('>I',1001)
        try:materialize(library,mapping,model)
        except ValueError:pass
        else:raise AssertionError('existing mapping overwritten')
    print('Capture model: literal safety, exact values, links, unsupported/nested values and size bounds passed')


if __name__=='__main__':check(sys.argv[1])
