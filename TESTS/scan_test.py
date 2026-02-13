# coding: utf-8
"""
S7 Scanner test - sends SZL reads using raw 12-byte S7 header (extended format).
This exercises the server's ability to handle non-standard header sizes.
"""
import socket
import struct

HOST = '127.0.0.1'
PORT = 10202

def build_szl_read_request(szl_id, index=0x0000):
    # Param: 00 01 12 04 11 44 01 00 (8 bytes)
    params = b'\x00\x01\x12\x04\x11\x44\x01\x00'
    
    # Data: FF 09 00 04 <SZL_ID> <Index>
    data = b'\xff\x09\x00\x04' + struct.pack('>HH', szl_id, index)
    
    # 12-byte S7 header (with extra 2-byte error/reserved field!)
    header = struct.pack('>BBHHHHH', 0x32, 0x07, 0x0000, 0x1234, len(params), len(data), 0x0000)
    
    return header + params + data

def main():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((HOST, PORT))
        
        # 1. COTP Connect
        print("Sending COTP Connect...")
        s.sendall(b"\x03\x00\x00\x16\x11\xe0\x00\x00\x00\x3a\x00\xc1\x02\x06\x00\xc2\x02\x06\x00\xc0\x01\x0a")
        resp = s.recv(1024)
        print(f"  COTP Confirm: {resp.hex()}")
        
        # 2. Setup (Negotiate)
        print("Sending Negotiate...")
        s.sendall(b"\x03\x00\x00\x19\x02\xf0\x80\x32\x01\x00\x00\x00\x00\x00\x08\x00\x00\xf0\x00\x00\x01\x00\x01\x01\xe0")
        resp = s.recv(1024)
        print(f"  Negotiate OK: {resp.hex()}")
        
        # 3. Read SZL 0x0011 (Module ID)
        print("\nSending Read SZL 0x0011 (Module ID)...")
        req = build_szl_read_request(0x0011)
        cotp = b'\x02\xf0\x80'
        tpkt = struct.pack('>BBH', 3, 0, 4 + len(cotp) + len(req))
        s.sendall(tpkt + cotp + req)
        
        resp = s.recv(2048)
        print(f"  Response len={len(resp)}")
        if len(resp) > 0:
            print(f"  Dump: {resp.hex()}")
            
        # 4. Read SZL 0x001C (Component ID)
        print("\nSending Read SZL 0x001C (Component ID)...")
        req = build_szl_read_request(0x001C)
        tpkt = struct.pack('>BBH', 3, 0, 4 + len(cotp) + len(req))
        s.sendall(tpkt + cotp + req)
        
        resp = s.recv(2048)
        print(f"  Response len={len(resp)}")
        if len(resp) > 0:
            # Parse to find system name
            # Skip TPKT(4) + COTP(3) + S7(10) + Params(12) + DataHdr(4) + SZL hdr(8) + Index(2) = 43
            if len(resp) > 45:
                name_bytes = resp[45:45+32]
                name = name_bytes.split(b'\x00')[0].decode('ascii', errors='replace')
                print(f"  System Name: {name}")
            
        # 5. Read SZL 0x0424 (CPU Status)
        print("\nSending Read SZL 0x0424 (CPU Status)...")
        req = build_szl_read_request(0x0424)
        tpkt = struct.pack('>BBH', 3, 0, 4 + len(cotp) + len(req))
        s.sendall(tpkt + cotp + req)
        
        resp = s.recv(2048)
        print(f"  Response len={len(resp)}")
        
        print("\nOK: All SZL reads completed successfully!")
        s.close()
    except Exception as e:
        print(f"FAIL: Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
