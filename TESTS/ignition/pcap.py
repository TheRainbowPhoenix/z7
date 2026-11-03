"""Wrap recorded application frames in synthetic TCP headers for Wireshark inspection."""
import socket
import struct


def checksum(data):
    if len(data) % 2:
        data += b"\0"
    total = sum(struct.unpack(f"!{len(data) // 2}H", data))
    while total >> 16:
        total = (total & 65535) + (total >> 16)
    return (~total) & 65535


def write_pcap(path, frames):
    """Payloads are actual sent/received TPKTs; TCP/IP headers are reconstructed."""
    with path.open("wb") as output:
        output.write(struct.pack("<IHHIIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1))
        client_port = 45000
        sequences = {"TX": 1, "RX": 1}
        address = socket.inet_aton("127.0.0.1")
        for index, frame in enumerate(frames):
            payload = bytes.fromhex(frame["hex"])
            direction = frame["direction"]
            if direction not in sequences or not 7 <= len(payload) <= 16384:
                raise ValueError("invalid recorded frame")
            if direction == "TX" and payload[5] == 0xE0:
                client_port += 1
                sequences = {"TX": 1, "RX": 1}
            other = "RX" if direction == "TX" else "TX"
            ports = (client_port, 102) if direction == "TX" else (102, client_port)
            tcp = struct.pack("!HHIIBBHHH", *ports, sequences[direction], sequences[other],
                              0x50, 0x18, 65535, 0, 0)
            sequences[direction] += len(payload)
            pseudo = address + address + struct.pack("!BBH", 0, 6, len(tcp) + len(payload))
            tcp = tcp[:16] + struct.pack("!H", checksum(pseudo + tcp + payload)) + tcp[18:]
            ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 40 + len(payload), index,
                             0, 64, 6, 0, address, address)
            ip = ip[:10] + struct.pack("!H", checksum(ip)) + ip[12:]
            packet = b"\0" * 12 + b"\x08\x00" + ip + tcp + payload
            output.write(struct.pack("<IIII", 1700000000, index * 1000, len(packet), len(packet)))
            output.write(packet)
