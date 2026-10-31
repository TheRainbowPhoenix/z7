# Typed and symbolic reads

ReadVar supports classic S7ANY types BIT, BYTE, CHAR, WORD, INT, DWORD,
DINT, REAL, and STRING (`0x13`). STRING requests use count 1 and return the
two-byte `[maximum_length, current_length]` header plus `maximum_length`
bytes of storage, matching the inspected SPS7 path. The current length must
not exceed the maximum. The entire result must fit the area's 64 KiB boundary
and the response budget. Ordinary BYTE reads of string storage are unchanged.

CHAR uses transport 9 with a byte length. DINT retains transport 6 with a byte
length: the pinned Ignition 5.0.1 decoder fails on Siemens transport 5 with a
bit length. INT remains transport 5. Numeric payload bytes are not converted.

## Symbolic `0xb2` reads

The host explicitly maps RID/LID paths to existing storage. z7 does not infer
Siemens object identifiers or run a PLC symbol/type system. Each specification
is `[0x12, 2 + path_length, 0xb2, reserved, path...]`; the reserved byte is
ignored, as in the inspected reader. The path is an exact sequence of
big-endian 32-bit RID/LID words, 8 through 64 bytes. Different path lengths
and classic specifications may share one request.

Register mappings through the shared-library API, after init and before start,
or after stop has joined the server thread:

```c
int32_t z7_register_symbol(void *ctx, const uint8_t *path, size_t path_len,
    uint8_t area, uint16_t db, uint32_t bit_address,
    uint8_t element_type, uint16_t count);
```

For example, the bytes `8a 0e 00 01 12 34 00 01` can map to area `0x84`, DB 1,
bit address `160 * 8`, element type 7 (DINT), count 1. Reading that path returns
the same data as a classic read at DB1 byte 160. STRING and BIT targets use the
same bounded read planner as classic requests. The table copies the path;
the caller need not retain its buffer.

Return values: 0 success, -1 invalid path/target, -2 server thread active,
-3 table full. Registration replaces an existing exact path. Capacity is 128
mappings. Lookup uses a fixed hash table, with no read-time allocation or lock.
Unknown paths return item code `0x0a`; malformed paths return `0x05`.

The host must serialize configuration and lifecycle calls. Mappings survive
stop/start of one context, but must be registered again after context recreation.
Symbolic writes and automatic symbol discovery are not implemented.

The Ignition harness constructs the new request specifications using an adapter
and decodes successful responses using the unchanged vendor reader. This is not
evidence of native symbolic request generation by that driver.
