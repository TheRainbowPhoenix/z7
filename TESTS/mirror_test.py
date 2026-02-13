# coding: utf-8
"""
Test interaction with plc_logic.py by writing to Inputs and reading Outputs.
plc_logic.py mirrors IB0 -> QB0.
"""
import socket
import struct
import time
import sys
import random

HOST = '127.0.0.1'
PORT = 10202

def send_recv(s, data, label=""):
    s.sendall(data)
    resp = s.recv(2048)
    # print(f"  {label}: sent {len(data)} bytes, recv {len(resp)} bytes")
    # print(f"    {resp.hex()}")
    return resp

def connect_plc():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2)
    try:
        s.connect((HOST, PORT))
    except ConnectionRefusedError:
        print(f"Error: Could not connect to {HOST}:{PORT}. Is z7 server running?")
        sys.exit(1)

    # COTP Connect Request
    # CR, Len=17, Dst=0, Src=0, Class=0
    cotp_cr = b"\x03\x00\x00\x16\x11\xe0\x00\x00\x00\x3a\x00\xc1\x02\x06\x00\xc2\x02\x06\x00\xc0\x01\x0a"
    send_recv(s, cotp_cr, "COTP Connect")

    # S7 Setup Communication (Negotiate PDU length)
    # ROSCTR=1 (Job), Func=0xF0
    # PDU length = 480 (0x01E0)
    setup_comm = b"\x03\x00\x00\x19\x02\xf0\x80\x32\x01\x00\x00\x00\x00\x00\x08\x00\x00\xf0\x00\x00\x01\x00\x01\x01\xe0"
    send_recv(s, setup_comm, "Setup Comm")
    
    return s

def build_write_byte(area, db, offset, value):
    """
    Build S7 Write Var request (Function 0x05).
    Writes 1 byte `value` to `area`, `db`, `offset`.
    """
    # 1. Header (ROSCTR=1 Job)
    # 2. Parameter (Func=0x05 Write Var, Count=1)
    # 3. Item (Var Spec)
    # 4. Data (Value)

    # Item: 12 bytes
    # [0] 0x12 (Var Spec)
    # [1] 0x0A (Length 10)
    # [2] 0x10 (Syntax ID S7ANY)
    # [3] 0x02 (Transport Size: BYTE)
    # [4-5] Length (1)
    # [6-7] DB Number
    # [8] Area
    # [9-11] Address (Byte*8 + Bit)
    
    address_bits = offset * 8
    item = struct.pack('>BBBBHHB', 0x12, 0x0A, 0x10, 0x02, 1, db, area) + struct.pack('>I', address_bits)[1:]
    
    # Data: 4 bytes + payload
    # [0] 0xFF (Return Code - Reserved/OK)
    # [1] 0x04 (Transport Size: BYTE/WORD/DWORD)
    # [2-3] Length (in bits = 8)
    # [4] Value
    data_header = struct.pack('>BBH', 0xFF, 0x04, 8)
    data_payload = bytes([value])
    
    param = struct.pack('>BB', 0x05, 1) + item
    data = data_header + data_payload
    
    # S7 Header
    # ROSCTR=1, ParamLen, DataLen
    s7_len = 10 + len(param) + len(data)
    s7_header = struct.pack('>BBHHHHH', 0x32, 0x01, 0x0000, 0x0010, len(param), len(data), 0x0000) # Error reserved? No, Job has no error field, it's 10 bytes. The struct above is 12 bytes?
    # Job Header is 10 bytes:
    # [0] 0x32
    # [1] ROSCTR (1)
    # [2-3] Redundancy ID
    # [4-5] Protocol Data Unit Ref
    # [6-7] Param Len
    # [8-9] Data Len
    s7_header = struct.pack('>BBHHHH', 0x32, 0x01, 0x0000, 0x0010, len(param), len(data))

    # TPKT + COTP
    # COTP DT = 0xF0, Flag=0x80 (Last unit)
    cotp = b'\x02\xf0\x80'
    total_len = 4 + len(cotp) + len(s7_header) + len(param) + len(data)
    tpkt = struct.pack('>BBH', 3, 0, total_len)
    
    return tpkt + cotp + s7_header + param + data

def build_read_byte(area, db, offset):
    """
    Build S7 Read Var request (Function 0x04).
    Reads 1 byte from `area`, `db`, `offset`.
    """
    # Item
    address_bits = offset * 8
    item = struct.pack('>BBBBHHB', 0x12, 0x0A, 0x10, 0x02, 1, db, area) + struct.pack('>I', address_bits)[1:]
    
    # Param
    param = struct.pack('>BB', 0x04, 1) + item
    
    # S7 Header (Job)
    s7_header = struct.pack('>BBHHHH', 0x32, 0x01, 0x0000, 0x0011, len(param), 0)
    
    cotp = b'\x02\xf0\x80'
    total_len = 4 + len(cotp) + len(s7_header) + len(param)
    tpkt = struct.pack('>BBH', 3, 0, total_len)
    
    return tpkt + cotp + s7_header + param

def parse_read_response(resp):
    """
    Parse Write Var Response.
    Returns the byte value.
    """
    # Skip TPKT(4) + COTP(3) + S7Header(12, Ack_Data) + Param(2)
    # S7 Header Ack_Data is 12 bytes (includes Error Code)
    # Param for Read Var is Function(1) + ItemCount(1) = 2 bytes.
    # Data is Item Data Header + Payload.
    
    # Only simple parsing here
    if len(resp) < 25:
        return None
        
    # Check Result Code in Data
    # Data starts after params. 
    # Offset 19 is Param start?
    # TPKT(4) + COTP(3) = 7. S7 start at 7.
    # S7 Header len 12. Param start at 19. Param len 2. Data start at 21.
    
    # Data Item:
    # [0] Return Code (0xFF = Success)
    # [1] Transport Size (0x04 = BYTE/WORD - 4 if success?) -> Size is 4=BIT, 3=BIT, 9=OCTET??
    # [2-3] Length (in bits)
    # [4..] Data
    
    # But let's look at offset 21.
    return_code = resp[21]
    if return_code != 0xFF:
        print(f"Read error: 0x{return_code:02X}")
        return None
        
    return resp[25] # Data byte

def main():
    print("--- Mirror Logic Test ---")
    s = connect_plc()
    print("Connected.")
    
    # 1. Write 0x42 to IB0 (Area 0x81)
    req = build_write_byte(0x81, 0, 0, 0x42)
    resp = send_recv(s, req, "Write IB0=0x42")
    # Verify write response (0xFF at data offset)
    # Ack_Data Header(12) + Param(1) = 13 bytes S7 header + 7 bytes wrapper = 20 bytes offset?
    # Data starts at 21? Resp is:
    # 0xff 09 ...
    # Simple check: length check needed?
    # print(f"Write Resp: {resp.hex()}")
    
    # 2. Wait for logic
    time.sleep(0.5)
    
    # 3. Read QB0 (Area 0x82)
    req = build_read_byte(0x82, 0, 0)
    resp = send_recv(s, req, "Read QB0")
    val = parse_read_response(resp)
    
    print(f"Read QB0: 0x{val:02X}")
    if val != 0x42:
        print("FAIL: Expected 0x42")
        sys.exit(1)
        
    # 4. Write 0x99 to IB0
    base_val = random.randint(0, 255)
    req = build_write_byte(0x81, 0, 0, base_val)
    send_recv(s, req, "Write IB0=0x99")
    
    time.sleep(0.2)
    
    # 5. Read QB0
    req = build_read_byte(0x82, 0, 0)
    resp = send_recv(s, req, "Read QB0")
    val = parse_read_response(resp)
    
    print(f"Read QB0: 0x{val:02X}")
    if val != base_val:
        print("FAIL: Expected 0x99")
        sys.exit(1)
        
    print("PASS: Mirror Register Logic Verified!")
    s.close()

if __name__ == "__main__":
    main()
