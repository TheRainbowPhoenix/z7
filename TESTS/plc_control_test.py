# coding: utf-8
"""
Test PLC Stop / Start commands against the z7 server.
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

def build_plc_stop():
    """Build a PLC Stop request (function 0x29)."""
    # S7 header (10 bytes, ROSCTR=1 Job)
    # Param: just the function byte 0x29
    params = bytes([0x29])
    s7 = struct.pack('>BBHHHHH', 0x32, 0x01, 0x0000, 0x0001, len(params), 0, 0x0000)
    # Wait, Job uses 10-byte header (no error field)
    s7 = struct.pack('>BBHHHH', 0x32, 0x01, 0x0000, 0x0001, len(params), 0)
    cotp = b'\x02\xf0\x80'
    payload = cotp + s7 + params
    tpkt = struct.pack('>BBH', 3, 0, 4 + len(payload))
    return tpkt + payload

def build_plc_start():
    """Build a PLC Control (start) request (function 0x28)."""
    # Minimal: function byte 0x28 + some params
    # Real clients send more (command string etc.) but server just ACKs it
    params = bytes([0x28, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0xFD, 0x00, 0x00, 0x09, 0x50, 0x5F, 0x50, 0x52,
                    0x4F, 0x47, 0x52, 0x41, 0x4D])  # P_PROGRAM
    s7 = struct.pack('>BBHHHH', 0x32, 0x01, 0x0000, 0x0002, len(params), 0)
    cotp = b'\x02\xf0\x80'
    payload = cotp + s7 + params
    tpkt = struct.pack('>BBH', 3, 0, 4 + len(payload))
    return tpkt + payload

def build_unknown_func():
    """Build a request with unknown function 0xFF."""
    params = bytes([0xFF])
    s7 = struct.pack('>BBHHHH', 0x32, 0x01, 0x0000, 0x0003, len(params), 0)
    cotp = b'\x02\xf0\x80'
    payload = cotp + s7 + params
    tpkt = struct.pack('>BBH', 3, 0, 4 + len(payload))
    return tpkt + payload

def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect((HOST, PORT))

    # COTP Connect
    send_recv(s, b"\x03\x00\x00\x16\x11\xe0\x00\x00\x00\x3a\x00\xc1\x02\x06\x00\xc2\x02\x06\x00\xc0\x01\x0a", "COTP Connect")

    # Negotiate
    send_recv(s, b"\x03\x00\x00\x19\x02\xf0\x80\x32\x01\x00\x00\x00\x00\x00\x08\x00\x00\xf0\x00\x00\x01\x00\x01\x01\xe0", "Negotiate")

    # PLC Stop
    print("\n--- PLC Stop ---")
    resp = send_recv(s, build_plc_stop(), "PLC Stop")
    # Check ROSCTR=3 (Ack_Data) and function=0x29
    if len(resp) >= 20:
        rosctr = resp[8]  # TPKT(4) + COTP(3) + proto_id(1) = offset 8
        func = resp[19]   # TPKT(4) + COTP(3) + S7Header(12) = offset 19
        err_hi = resp[17]
        err_lo = resp[18]
        print(f"    ROSCTR={rosctr} (expect 3), func=0x{func:02x} (expect 0x29), error=0x{err_hi:02x}{err_lo:02x}")
        assert rosctr == 3, f"Expected ROSCTR=3, got {rosctr}"
        assert func == 0x29, f"Expected func=0x29, got 0x{func:02x}"
        assert err_hi == 0 and err_lo == 0, "Expected no error"
        print("    PASS!")

    # PLC Start (Control)
    print("\n--- PLC Start ---")
    resp = send_recv(s, build_plc_start(), "PLC Start")
    if len(resp) >= 20:
        rosctr = resp[8]
        func = resp[19]
        err_hi = resp[17]
        err_lo = resp[18]
        print(f"    ROSCTR={rosctr} (expect 3), func=0x{func:02x} (expect 0x28), error=0x{err_hi:02x}{err_lo:02x}")
        assert rosctr == 3
        assert func == 0x28
        assert err_hi == 0 and err_lo == 0
        print("    PASS!")

    # Unknown function (should get error 0x8104)
    print("\n--- Unknown Function 0xFF ---")
    resp = send_recv(s, build_unknown_func(), "Unknown")
    if len(resp) >= 20:
        rosctr = resp[8]
        func = resp[19]
        err_code = struct.unpack('>H', resp[17:19])[0]
        print(f"    ROSCTR={rosctr} (expect 3), func=0x{func:02x} (expect 0xFF), error=0x{err_code:04x} (expect 0x8104)")
        assert rosctr == 3
        assert func == 0xFF
        assert err_code == 0x8104, f"Expected error 0x8104, got 0x{err_code:04x}"
        print("    PASS!")

    print("\nAll PLC control tests passed!")
    s.close()

if __name__ == '__main__':
    main()
