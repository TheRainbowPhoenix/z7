import socket
import struct
import time
import sys
import os

# Add repo root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))
from ladderlad.shm_interface import SHMInterface

PORT = 1102

# S7 Constants
TPKT_HEADER_LEN = 4
COTP_HEADER_LEN = 3 # Min
S7_HEADER_LEN = 10 # Header without params/data

# COTP PDU Types
COTP_CR = 0xE0 # Connection Request
COTP_CC = 0xD0 # Connection Confirm
COTP_DT = 0xF0 # Data

# S7 ROSCTR
ROSCTR_JOB = 0x01
ROSCTR_ACK_DATA = 0x03

# S7 Function
FUNC_READ_VAR = 0x04
FUNC_WRITE_VAR = 0x05
FUNC_SETUP_COMM = 0xF0

# Areas
AREA_INPUTS = 0x81
AREA_OUTPUTS = 0x82
AREA_MERKERS = 0x83
AREA_DB = 0x84

class MockS7Server:
    def __init__(self):
        self.shm = SHMInterface()
        if not self.shm.connect():
            print("Failed to init SHM")
            sys.exit(1)

        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(('0.0.0.0', PORT))
        self.sock.listen(1)
        print(f"Mock S7 Server listening on port {PORT}")

    def run(self):
        while True:
            conn, addr = self.sock.accept()
            print(f"Connection from {addr}")
            try:
                self.handle_connection(conn)
            except Exception as e:
                print(f"Connection Error: {e}")
            finally:
                conn.close()

    def handle_connection(self, conn):
        # 1. COTP Connection Request
        data = conn.recv(1024)
        if not data: return
        # Expect CR
        # Send CC
        # CC PDU: Len(1) + 0xD0 + DstRef(2) + SrcRef(2) + Class(1)
        # Minimal CC: 05 D0 00 01 00 01 00 (Example)
        # TPKT: 03 00 00 0B ...
        cc_pdu = bytes([
            0x03, 0x00, 0x00, 0x0B, # TPKT (11 bytes)
            0x06, 0xD0, 0x00, 0x01, 0x00, 0x01, 0x00 # COTP (Len 6, CC, Refs, Class 0)
        ])
        conn.send(cc_pdu)

        # 2. S7 PDU Negotiation (Setup Comm)
        data = conn.recv(1024)
        if not data: return
        # Expect PDU Negotiation
        # Send Ack
        # Just echo success with PDU size 480
        ack_pdu = bytes([
            0x03, 0x00, 0x00, 0x1B, # TPKT (27 bytes)
            0x02, 0xF0, 0x80,       # COTP (DT, EOT)
            0x32, 0x03, 0x00, 0x00, # S7 Header (Protocol, Ack_Data, Reserved)
            0x00, 0x00, 0x00, 0x08, # Ref (echo?), Param Len 8
            0x00, 0x00, 0x00, 0x00, # Data Len 0, Error 0
            0xF0, 0x00,             # Func Setup Comm
            0x00, 0x01,             # Max Amq Caller
            0x00, 0x01,             # Max Amq Callee
            0x01, 0xE0              # PDU Size 480
        ])
        conn.send(ack_pdu)

        # 3. Main Loop
        while True:
            data = conn.recv(4096)
            if not data: break

            # Parse TPKT
            if len(data) < 4: continue
            payload_len = struct.unpack(">H", data[2:4])[0]

            # Parse S7 Header
            # Offset 7 (TPKT 4 + COTP 3) assumed 3 byte COTP for DT
            # Check COTP length
            cotp_len = data[4]
            s7_offset = 4 + 1 + cotp_len

            rosctr = data[s7_offset + 1]
            param_len = struct.unpack(">H", data[s7_offset+6:s7_offset+8])[0]
            data_len = struct.unpack(">H", data[s7_offset+8:s7_offset+10])[0]

            func_code = data[s7_offset+10] # Param starts here if no errors?
            # Wait, S7 Header is 10 bytes usually:
            # Protocol(1), ROSCTR(1), Res(2), Ref(2), PLen(2), DLen(2)
            # Then Params start.
            # So s7_offset + 10 is start of Params.
            func_code = data[s7_offset+10] # Param[0]

            if func_code == FUNC_WRITE_VAR:
                # Handle Write
                item_count = data[s7_offset+11]
                # Items start at s7_offset + 12
                # Each item is 12 bytes
                # Data follows Params
                data_ptr = s7_offset + 10 + param_len
                item_ptr = s7_offset + 12

                results = []

                for i in range(item_count):
                    # Parse Item
                    # 12 0A 10 TransSize(1) Len(2) DB(2) Area(1) Addr(3)
                    # Offsets: 0,1,2, 3, 4-5, 6-7, 8, 9-11
                    area = data[item_ptr + 8]
                    db_num = struct.unpack(">H", data[item_ptr+6:item_ptr+8])[0]
                    addr_bytes = data[item_ptr+9:item_ptr+12]
                    raw_addr = struct.unpack(">I", b'\x00' + addr_bytes)[0]
                    bit_addr = raw_addr & 0x07
                    byte_addr = raw_addr >> 3

                    # Parse Data for this item
                    # ReturnCode(1) TransSize(1) Len(2) Data...
                    # But request data format in Write Var is:
                    # ReturnCode(1) TransSize(1) Len(2) Data...
                    # Wait, in Request, Data part has:
                    # Reserved(1) TransSize(1) Len(2) Data...

                    # Read from data_ptr
                    # Reserved = data[data_ptr]
                    ts = data[data_ptr+1]
                    length = struct.unpack(">H", data[data_ptr+2:data_ptr+4])[0]
                    # Length is in bits if BIT, else bits?
                    # Client.py: "corrected_data_item_length = data_item_length << 3" (bytes to bits)
                    # So Length is in bits.

                    byte_len = length >> 3
                    if ts == 0x03: # BIT
                        byte_len = 1 # 1 bit is 1 byte payload?
                        # Actually for BIT, length is number of bits.
                        # Payload is bytes.
                        byte_len = (length + 7) // 8

                    values = data[data_ptr+4 : data_ptr+4+byte_len]

                    # Execute Write
                    self.write_shm(area, db_num, byte_addr, bit_addr, values, ts, length)

                    results.append(0xFF) # Success

                    # Advance ptrs
                    item_ptr += 12
                    data_ptr += 4 + byte_len
                    # Padding for odd bytes?
                    if byte_len % 2 != 0:
                        data_ptr += 0 # S7 protocol alignment? Client.py doesn't seem to pad Write Data Payload in Request?
                        # Wait, Client.py write_area doesn't pad?
                        # "request += raw_bytes"
                        # But Response reading has padding: "if bool(data_item_length & 1): item_offset += 1"
                        # S7 usually pads data to word boundary?
                        # Let's assume no padding for now or check pystep7 carefully.
                        # "data_payload += ... + util.encode(...)"
                        # No padding logic visible in Write Request construction.
                        pass

                # Send Response
                # TPKT + COTP + S7 Header + Params + Data
                # Params: Func(1) + ItemCount(1)
                # Data: ReturnCode(1) * ItemCount

                resp_param_len = 2
                resp_data_len = item_count

                resp = bytearray()
                # TPKT (Len filled later)
                resp.extend([0x03, 0x00, 0x00, 0x00])
                # COTP
                resp.extend([0x02, 0xF0, 0x80])
                # S7 Header
                resp.extend([0x32, 0x03, 0x00, 0x00]) # Proto, Ack_Data, Res
                resp.extend([0x00, 0x00]) # Ref (Copy from req?)
                # Wait, Ref is at s7_offset + 4
                req_ref = data[s7_offset+4:s7_offset+6]
                resp[11:13] = req_ref

                resp.extend(struct.pack(">H", resp_param_len))
                resp.extend(struct.pack(">H", resp_data_len))
                resp.extend([0x00, 0x00]) # Error

                # Params
                resp.extend([FUNC_WRITE_VAR, item_count])

                # Data
                for r in results:
                    resp.append(r)

                # Fix TPKT Len
                struct.pack_into(">H", resp, 2, len(resp))

                conn.send(resp)

            elif func_code == FUNC_READ_VAR:
                # Handle Read
                item_count = data[s7_offset+11]
                item_ptr = s7_offset + 12

                resp_data = bytearray()

                for i in range(item_count):
                    area = data[item_ptr + 8]
                    db_num = struct.unpack(">H", data[item_ptr+6:item_ptr+8])[0]
                    addr_bytes = data[item_ptr+9:item_ptr+12]
                    raw_addr = struct.unpack(">I", b'\x00' + addr_bytes)[0]
                    bit_addr = raw_addr & 0x07
                    byte_addr = raw_addr >> 3

                    length = struct.unpack(">H", data[item_ptr+4:item_ptr+6])[0] # Item Len (bytes?)
                    # In Read Request, Item has Length in bytes (usually).
                    # Wait, Item struct: 10(S7ANY) TransSize(1) Len(2) ...
                    # If TransSize is BYTE, Len is bytes. If BIT, Len is bits.
                    ts = data[item_ptr+3]

                    val_bytes, bit_len = self.read_shm(area, db_num, byte_addr, bit_addr, ts, length)

                    # Data Item Response: ReturnCode(1) TransSize(1) Len(2) Data...
                    resp_data.append(0xFF) # Success

                    resp_ts = 0x04 # WORD/BYTE usually?
                    if ts == 0x01: resp_ts = 0x03 # BIT
                    elif ts == 0x02: resp_ts = 0x04 # BYTE
                    else: resp_ts = 0x04

                    resp_data.append(resp_ts)

                    # Length in bits
                    struct.pack_into(">H", resp_data, len(resp_data), bit_len) # Wait, append?
                    resp_data.extend(struct.pack(">H", bit_len))

                    resp_data.extend(val_bytes)

                    # Padding
                    if len(val_bytes) % 2 != 0:
                        resp_data.append(0x00)

                    item_ptr += 12

                # Send Response
                resp_param_len = 2
                resp_data_len = len(resp_data)

                resp = bytearray()
                resp.extend([0x03, 0x00, 0x00, 0x00]) # TPKT
                resp.extend([0x02, 0xF0, 0x80]) # COTP
                resp.extend([0x32, 0x03, 0x00, 0x00]) # Header
                # Ref
                req_ref = data[s7_offset+4:s7_offset+6]
                resp.extend(req_ref)

                resp.extend(struct.pack(">H", resp_param_len))
                resp.extend(struct.pack(">H", resp_data_len))
                resp.extend([0x00, 0x00])

                # Params
                resp.extend([FUNC_READ_VAR, item_count])

                # Data
                resp.extend(resp_data)

                struct.pack_into(">H", resp, 2, len(resp))
                conn.send(resp)

    def write_shm(self, area, db_num, byte_addr, bit_addr, values, ts, length):
        # Implement SHM writing logic
        # AREA_INPUTS = 0x81 (I), AREA_OUTPUTS = 0x82 (Q), AREA_MERKERS = 0x83 (M)
        # AREA_DB = 0x84

        # Determine base offset
        offset = 0
        if area == AREA_INPUTS:
            offset = 0 # OFFSET_INPUTS
        elif area == AREA_OUTPUTS:
            offset = 65536 # OFFSET_OUTPUTS
        elif area == AREA_MERKERS:
            offset = 131072
        elif area == AREA_DB:
            offset = 327680 + (db_num * 65536)

        # Write bytes
        # If BIT write?
        if ts == 0x03 or length == 1: # BIT
            # Read byte, modify bit, write back
            curr = self.shm.mm[offset + byte_addr]
            bit_val = values[0] & 0x01 # Only 1 bit from payload?
            # Write Var payload for BIT usually sends a byte where bit 0 is value? Or bit_addr?
            # Actually, S7 Write BIT sends a byte. The value is at bit position?
            # Or value is 0/1.
            # Client.py writes raw bytes.
            # If I write I0.0, I send 1 bit?
            # "data_type == const.DataType.BIT ... address = offset" (byte offset?)
            # "request[22] = data_type"
            # It seems it sends 1 byte payload for 1 bit.
            # And usually the value is in the LSB or MSB?
            # Let's assume LSB of the payload byte determines the bit value.
            # And we write it to `bit_addr` of `byte_addr`.
            val = (values[0] > 0)
            if val:
                curr |= (1 << bit_addr)
            else:
                curr &= ~(1 << bit_addr)
            self.shm.mm[offset + byte_addr] = curr
        else:
            # Byte/Word write
            for i, b in enumerate(values):
                self.shm.mm[offset + byte_addr + i] = b

    def read_shm(self, area, db_num, byte_addr, bit_addr, ts, length):
        # Determine base offset
        offset = 0
        if area == AREA_INPUTS:
            offset = 0
        elif area == AREA_OUTPUTS:
            offset = 65536
        elif area == AREA_MERKERS:
            offset = 131072
        elif area == AREA_DB:
            offset = 327680 + (db_num * 65536)

        if ts == 0x01: # BIT
            # Read 1 bit
            val = self.shm.mm[offset + byte_addr]
            bit_val = (val >> bit_addr) & 0x01
            return bytes([bit_val]), 1
        else:
            # Read bytes
            # length is byte length from Request (if ts=02)
            data = self.shm.mm[offset + byte_addr : offset + byte_addr + length]
            return data, length * 8

if __name__ == "__main__":
    server = MockS7Server()
    server.run()
