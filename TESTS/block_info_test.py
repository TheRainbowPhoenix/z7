# coding: utf-8
"""
Test Read Block Info (Userdata) against the z7 server.
"""
import socket
import struct

HOST = '127.0.0.1'
PORT = 10202

def send_recv(s, data, label=""):
    s.sendall(data)
    resp = s.recv(2048)
    print(f"  {label}: sent {len(data)} bytes, recv {len(resp)} bytes")
    print(f"    {resp.hex()}")
    return resp

def build_block_info_req(block_type=0x41, block_num=1):
    """
    Build a Userdata Block Info request.
    Function Group 0x3, Sub-function 0x1 (Read Block Info)
    """
    # Userdata Params (8 bytes for request)
    # [Head(3)] [Len(1)] [Method(1)] [Tg(1)] [Sub(1)] [Seq(1)]
    # Tg for block info request = 0x43 (type 4, group 3)
    params = bytes([0x00, 0x01, 0x12, 0x04, 0x11, 0x43, 0x01, 0x00])

    # Data Header (4 bytes)
    # [ReturnCode(1)] [TransportSize(1)] [DataPayloadLen(2)]
    # Payload for Block Info Request is usually 8 or 13 bytes.
    # pystep7 sends: [0x30] [BlockType] [NumberASCII(5)] [0x41]?
    # Let's match pystep7's 13 byte style if possible, or just the basics.
    # Payload: [Prefix(1)] [Type(1)] [NumberASCII(5)] + padding?
    # Actually pystep7: request[30] = type, request[31..35] = num.
    # In Client.py, const.S7_BLOCK_INFO is used.
    
    num_str = f"{block_num:05d}".encode('ascii')
    # pystep7's S7_BLOCK_INFO is 37 bytes total.
    # TPKT(4)+COTP(3)+S7(10)+Params(12... wait, request params are 8)
    # 4+3+10+8 = 25 bytes headers. 37 - 25 = 12 bytes data?
    data_payload = bytes([0x30, block_type]) + num_str + b'A' # 1+1+5+1 = 8 bytes?
    
    # Let's just use a dummy payload that the server can parse.
    # Our server expects payload[6..11] to be the number.
    # So the payload must be at least 11 bytes.
    # [DataHdr(4)] [0x30] [Type] [NumberASCII(5)] = 4+1+1+5 = 11.
    
    # We build the S7 part:
    data_hdr = struct.pack('>BBH', 0xFF, 0x09, len(data_payload))
    data = data_hdr + data_payload
    
    s7 = struct.pack('>BBHHHH', 0x32, 0x07, 0x0000, 0x0005, len(params), len(data))
    
    cotp = b'\x02\xf0\x80'
    full_payload = cotp + s7 + params + data
    tpkt = struct.pack('>BBH', 3, 0, 4 + len(full_payload))
    return tpkt + full_payload

def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    try:
        s.connect((HOST, PORT))
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    # COTP Connect
    send_recv(s, b"\x03\x00\x00\x16\x11\xe0\x00\x00\x00\x3a\x00\xc1\x02\x06\x00\xc2\x02\x06\x00\xc0\x01\x0a", "COTP Connect")

    # Negotiate
    send_recv(s, b"\x03\x00\x00\x19\x02\xf0\x80\x32\x01\x00\x00\x00\x00\x00\x08\x00\x00\xf0\x00\x00\x01\x00\x01\x01\xe0", "Negotiate")

    # Block Info request
    print("\n--- Block Info Request (DB 1) ---")
    req = build_block_info_req(block_type=0x41, block_num=1)
    resp = send_recv(s, req, "Block Info")
    
    if len(resp) >= 42 + 61:
        print("  Response length OK")
        # According to pystep7, block info record starts at offset 42 (if header is standard)
        # TPKT(4) + COTP(3) + S7(10) + Params(12) + DataHdr(4) = 33
        # PLUS the "Middle sub-header" (9 bytes) we added in server: 33 + 9 = 42.
        # So yes, 42 is the start of the 61-byte record.
        record = resp[42:42+61]
        
        # Unpack some fields to verify:
        # flags(1s) lang(B) type(B) num(H) ...
        flags, lang, btype, num = struct.unpack('>sBBH', record[0:5])
        print(f"    Record: flags={flags.hex()}, lang=0x{lang:02x}, type=0x{btype:02x}, num={num}")
        assert num == 1, f"Expected block 1, got {num}"
        
        # Check version (offset 57 in record)
        version = record[57]
        print(f"    Version byte: 0x{version:02x} (expect 0x11 for '1.1')")
        
        print("    PASS!")
    else:
        print(f"  Response too short: {len(resp)} bytes (expect at least 103)")

    s.close()

if __name__ == '__main__':
    main()
