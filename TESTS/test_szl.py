
import socket
import struct
import time
import argparse

def parse_args():
    parser = argparse.ArgumentParser(description='Test S7 SZL reading')
    parser.add_argument('--host', type=str, default='127.0.0.1')
    parser.add_argument('--port', type=int, default=1102)
    return parser.parse_args()

args = parse_args()
HOST = args.host
PORT = args.port

def hex_dump(data):
    return " ".join(f"{b:02X}" for b in data)

def connect():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((HOST, PORT))
    return s

def send_packet(s, data, verbose=True):
    if verbose:
        print(f"Sending: {hex_dump(data)}")
    s.send(data)
    resp = s.recv(4096)
    if verbose:
        print(f"Received: {hex_dump(resp)}")
    return resp

def build_cotp_cr():
    return bytes([
        0x03, 0x00, 0x00, 0x16, # TPKT
        0x11, 0xE0, 0x00, 0x00, 0x00, 0x01, 0x00, 0xC1, 0x02, 0x01, 0x00, 0xC2, 0x02, 0x01, 0x02, 0xC0, 0x01, 0x0A
    ])

def build_setup_comm():
    return bytes([
        0x03, 0x00, 0x00, 0x19, # TPKT
        0x02, 0xF0, 0x80, # COTP DT
        0x32, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x08, 0x00, 0x00, # S7 Header
        0xF0, 0x00, 0x00, 0x01, 0x00, 0x01, 0x03, 0xC0 # Params
    ])

def build_read_szl(szl_id, index):
    tpkt_len = 29
    packet = bytearray()
    packet.extend([0x03, 0x00, int(tpkt_len >> 8), int(tpkt_len & 0xFF)])
    packet.extend([0x02, 0xF0, 0x80])
    packet.extend([0x32, 0x07, 0x00, 0x00, 0x00, 0x03, 0x00, 0x08, 0x00, 0x04])
    packet.extend([0x00, 0x01, 0x12, 0x04, 0x11, 0x44, 0x01, 0x00])
    packet.extend([szl_id >> 8, szl_id & 0xFF, index >> 8, index & 0xFF])
    return bytes(packet)

def read_szl(s, szl_id, index, name="Unknown"):
    print(f"\n--- Reading SZL ID 0x{szl_id:04X} Index 0x{index:04X} ({name}) ---")
    resp = send_packet(s, build_read_szl(szl_id, index), verbose=True)
    
    if len(resp) <= 20:
        print("Response too short")
        return None

    param_len = (resp[13] << 8) | resp[14]
    data_len = (resp[15] << 8) | resp[16]
    
    if data_len < 4 or len(resp) < 17 + param_len + 4:
        print("Data too short")
        return None

    data_offset = 17 + param_len
    ret_code = resp[data_offset]
    
    if ret_code == 0xFF:
        print("Result: Success")
        payload = resp[data_offset+4:]
        
        # Parse SZL Header if exists (at least 8 bytes)
        if len(payload) >= 8:
             # L_ID(2) + INDX(2) + L_ENTR(2) + N_ENTR(2)
             l_id = (payload[0] << 8) | payload[1]
             indx = (payload[2] << 8) | payload[3]
             l_entr = (payload[4] << 8) | payload[5] # Length of one entry
             n_entr = (payload[6] << 8) | payload[7] # Number of entries
             print(f"Header: ID=0x{l_id:04X} Index=0x{indx:04X} Len={l_entr} Count={n_entr}")
             
             return {
                 'payload': payload,
                 'l_id': l_id,
                 'l_entr': l_entr,
                 'n_entr': n_entr,
                 'entries': payload[8:]
             }
    else:
        print(f"Result: Error 0x{ret_code:02X}")
    return None

def main():
    try:
        s = connect()
        print("Connected.")
        
        send_packet(s, build_cotp_cr(), verbose=False)
        send_packet(s, build_setup_comm(), verbose=False)
        
        # 1. Read SZL 0x0000 - Supported SZL IDs
        result = read_szl(s, 0x0000, 0x0000, "Supported SZLs")
        
        if result:
            ids = []
            count = result['n_entr']
            entry_len = result['l_entr'] # Should be 2 bytes (u16)
            entries = result['entries']
            
            print("\nSupported SZL IDs found:")
            for i in range(count):
                offset = i * entry_len
                if offset + 2 <= len(entries):
                    szl_id = (entries[offset] << 8) | entries[offset+1]
                    ids.append(szl_id)
                    print(f"  - 0x{szl_id:04X}")
            
            print("\nReading details for all found IDs...")
            for szl_id in ids:
                # Skip 0x0000 to avoid recursion loop (though it would just read same list)
                if szl_id == 0x0000:
                    continue
                    
                # Default index 0x0000 is usually fine for general info
                # Some like 0x0131 might need specific indices, but 0x0000 usually returns list or main record
                # Or we could try reading 0x0000 first to check headers.
                # Since we don't know correct indices, let's try 0x0000 and 0x0001
                read_szl(s, szl_id, 0x0000, "Auto-discovered")
                if szl_id == 0x0131: # Try common indices for CP
                     read_szl(s, szl_id, 0x0001, "CP Info")
                     
    except Exception as e:
        print(f"Error: {e}")
    finally:
        pass

if __name__ == "__main__":
    main()
