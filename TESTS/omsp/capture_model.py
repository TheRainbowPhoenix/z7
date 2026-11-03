"""Extract bounded, provenance-preserving virtual-device snapshots from decrypted captures.
Capture Python is parsed with ast.literal_eval, never executed. No reply-byte replay.
"""
import argparse
import ast
import collections
import ctypes as C
import json
from pathlib import Path
import struct
import zipfile
from mapped import Store


class Reader:
    def __init__(self,data,lib):self.data,self.pos,self.lib=data,0,lib
    def take(self,count):
        if count<0 or count>len(self.data)-self.pos:raise ValueError('truncated')
        value=self.data[self.pos:self.pos+count];self.pos+=count;return value
    def byte(self):return self.take(1)[0]
    def u32(self):return int.from_bytes(self.take(4),'big')
    def vlq(self):
        value=0
        for index in range(9):
            byte=self.byte()
            if index==8:return (value<<8)|byte
            value=(value<<7)|(byte&127)
            if byte<128:return value
        raise ValueError('VLQ overflow')
    def value(self):
        raw=self.data[self.pos:]
        if not 2<=len(raw)<=65535:raise ValueError('invalid value length')
        buf=C.create_string_buffer(raw)
        length=self.lib.zomsp_value_size(buf,len(raw))
        if length<2:raise ValueError('unsupported value')
        return self.take(length)


def packets(path):
    with zipfile.ZipFile(path) as archive:
        total=0
        for info in sorted(archive.infolist(),key=lambda item:item.filename):
            if not info.filename.endswith('.py'):continue
            total+=info.file_size
            if info.file_size>32*1024*1024 or total>256*1024*1024:raise ValueError('capture archive exceeds limits')
            tree=ast.parse(archive.read(info).decode('utf-8-sig'))
            for node in tree.body:
                if not isinstance(node,ast.Assign) or len(node.targets)!=1 or not isinstance(node.targets[0],ast.Name):continue
                label=node.targets[0].id
                if not label.startswith(('peer0_','peer1_')):continue
                try:value=ast.literal_eval(node.value)
                except (ValueError,TypeError):continue
                if isinstance(value,bytes) and len(value)>=14 and value[0]==0x72:
                    length=int.from_bytes(value[2:4],'big')+4
                    if 14<=length<=min(len(value),65535) and value[1] in (1,2) and (value[4]==0x33 or (value[5:7]==b'\0\0' and value[9:11]==b'\0\0')):yield f'{Path(path).name}:{info.filename}:{label}',value[:length]


def extract(library,archives,placeholder=None):
    lib=C.CDLL(str(Path(library).resolve()))
    lib.zomsp_value_size.argtypes=[C.c_void_p,C.c_size_t];lib.zomsp_value_size.restype=C.c_ssize_t
    objects={};values={};links={};stats=collections.Counter();functions=collections.Counter();errors=collections.Counter()
    def remember(rid,aid,value,source):
        if not rid or 0x70000000<=rid<=0x7fffffff or not 0<aid<=0xffffffff:return
        values[rid,aid]={'rid':rid,'aid':aid,'value':value.hex(),'source':source}
    def object_tree(reader,parent,nodes,fields,relations,depth=0):
        if depth==8 or reader.byte()!=0xa1:raise ValueError('object depth/tag')
        rid,kind=reader.u32(),reader.vlq();reader.vlq();reader.vlq()
        nodes[rid]={'rid':rid,'parent':parent,'class':kind}
        for _ in range(128):
            tag=reader.byte()
            if tag==0xa2:return
            if tag==0xa1:
                reader.pos-=1;object_tree(reader,rid,nodes,fields,relations,depth+1)
            elif tag==0xa3:
                aid=reader.vlq();fields.append((rid,aid,reader.value()))
            elif tag==0xa4:
                aid=reader.vlq();relations.append((rid,aid,reader.u32()))
            else:raise ValueError('unsupported object metadata')
        raise ValueError('object field limit')
    for archive in archives:
        pending={}
        for source,data in packets(archive):
            function=int.from_bytes(data[7:9],'big');sequence=int.from_bytes(data[11:13],'big')
            if data[4]==0x33:stats['notifications_not_replayed']+=1;continue
            if data[4]==0x31:
                functions[hex(function)]+=1;pending[function,sequence]=data;continue
            request=pending.pop((function,sequence),None)
            if request is None or data[4]!=0x32:continue
            stats['matched_pairs']+=1
            if data[1]!=2 or request[1]!=2:stats['non_v2_pairs']+=1;continue
            response=Reader(data[14:],lib)
            try:
                status=response.vlq()
                if status:errors[hex(status)]+=1;continue
                req=Reader(request[18:],lib)
                if function==0x586:
                    target=req.u32()
                    if req.take(2)!=b'\x20\x04':raise ValueError('streamed address')
                    count=req.vlq();aid=req.vlq()
                    if count!=1:stats['nested_reads_not_flattened']+=1;continue
                    if response.byte()!=0:raise ValueError('streamed result flags')
                    remember(target,aid,response.value(),source)
                elif function==0x54c:
                    target=req.u32();count=req.vlq();req.vlq()
                    if not 0<count<=16:raise ValueError('address count')
                    addresses=[]
                    for _ in range(count):
                        rid=target;parts=1
                        if target==0:
                            if req.vlq()!=0:raise ValueError('symbol CRC')
                            rid=req.vlq();parts=req.vlq()
                        aid=req.vlq()
                        if not 1<=parts<=4:raise ValueError('address parts')
                        for _ in range(parts-1):req.vlq()
                        addresses.append((rid,aid,parts))
                    seen=set()
                    for _ in range(count+1):
                        index=response.vlq()
                        if index==0:break
                        if not 0<index<=count or index in seen:raise ValueError('result index')
                        seen.add(index);value=response.value();rid,aid,parts=addresses[index-1]
                        if parts==1:remember(rid,aid,value,source)
                        else:stats['nested_reads_not_flattened']+=1
                elif function==0x4bb:
                    parent=response.u32();response.vlq();target=req.u32();req.vlq();req.byte();req.byte();with_parent=req.byte();nodes={};fields=[];relations=[]
                    if with_parent:parent=0
                    while len(response.data)-response.pos>5 and response.data[response.pos]==0xa1:
                        object_tree(response,parent,nodes,fields,relations)
                    objects.update(nodes)
                    for rid,aid,value in fields:remember(rid,aid,value,source)
                    for rid,aid,target in relations:links.setdefault((rid,aid),set()).add(target)
                else:stats['other_pairs']+=1
            except (ValueError,OverflowError,IndexError):stats['unsupported_or_truncated_pairs']+=1
    candidates=len(values)
    for rid,_ in values:
        if rid not in objects and placeholder:
            objects[rid]={'rid':rid,'parent':0,'class':placeholder,'synthetic_class':True}
    selected={};remaining={rid:obj for rid,obj in objects.items() if rid and rid<0x70000000 and obj['class']}
    while remaining and len(selected)<128:
        progressed=False
        for rid,obj in list(remaining.items()):
            if obj['parent'] and obj['parent'] not in selected:continue
            selected[rid]=obj;del remaining[rid];progressed=True
            if len(selected)==128:break
        if not progressed:break
    entries=[]
    for item in values.values():
        if item['rid'] not in selected:stats['values_without_mapped_object']+=1;continue
        if len(bytes.fromhex(item['value']))>1024:stats['oversized_values']+=1;continue
        if len(entries)==512:stats['value_capacity_exceeded']+=1;continue
        entries.append(item)
    stats.update(candidate_values=candidates,mapped_objects=len(selected),mapped_values=len(entries),unmapped_objects=len(remaining))
    associations=[{'rid':rid,'aid':aid,'targets':sorted(targets)} for (rid,aid),targets in links.items() if rid in selected and len(targets)<=16 and all(x in selected for x in targets)]
    return {'format':1,'snapshot':'last successfully observed top-level values; not a cycle-consistent PLC image',
        'objects':list(selected.values()),'values':entries,'links':associations,'stats':dict(stats),'functions':dict(functions),'decoded_nonzero_status_words':dict(errors)}


def materialize(library,path,model):
    if Path(path).exists():raise ValueError('output mapping already exists')
    store=Store(library,path)
    try:
        for obj in model['objects']:store.object(obj['rid'],obj['parent'],obj['class'])
        for item in model['values']:
            result=store.set(item['rid'],item['aid'],bytes.fromhex(item['value']),writable=False)
            if result:raise ValueError(f'mapped value rejected: {result}')
        for item in model['links']:store.link(item['rid'],item['aid'],item['targets'])
    finally:store.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('library');parser.add_argument('archives',nargs='+');parser.add_argument('--output',type=Path,required=True);parser.add_argument('--mmap',type=Path);parser.add_argument('--placeholder-class',type=int)
    args=parser.parse_args();model=extract(args.library,args.archives,args.placeholder_class)
    args.output.write_text(json.dumps(model,indent=2))
    if args.mmap:materialize(args.library,args.mmap,model)
    print(json.dumps({'stats':model['stats'],'functions':model['functions'],'decoded_nonzero_status_words':model['decoded_nonzero_status_words']},indent=2))
