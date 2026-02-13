import ctypes
import os
import time
import threading

class Context(ctypes.Structure):
    pass

class Z7Client:
    def __init__(self, dll_path, port=10202, storage_path=None):
        if not os.path.exists(dll_path):
            raise FileNotFoundError(f"DLL not found at {dll_path}")
            
        self.lib = ctypes.CDLL(dll_path)
        
        # void z7_set_log_callback(void (*cb)(uint8_t, const char*, size_t));
        self.LOG_CALLBACK_TYPE = ctypes.CFUNCTYPE(None, ctypes.c_uint8, ctypes.c_char_p, ctypes.c_size_t)
        self.lib.z7_set_log_callback.argtypes = [self.LOG_CALLBACK_TYPE]
        self.lib.z7_set_log_callback.restype = None
        
        # Context* z7_init(uint16_t port, const char* storage_path);
        self.lib.z7_init.argtypes = [ctypes.c_uint16, ctypes.c_char_p]
        self.lib.z7_init.restype = ctypes.POINTER(Context)
        
        # void z7_deinit(Context* ctx);
        self.lib.z7_deinit.argtypes = [ctypes.POINTER(Context)]
        self.lib.z7_deinit.restype = None
        
        # void z7_start(Context* ctx);
        self.lib.z7_start.argtypes = [ctypes.POINTER(Context)]
        self.lib.z7_start.restype = None

        # void z7_stop(Context* ctx);
        self.lib.z7_stop.argtypes = [ctypes.POINTER(Context)]
        self.lib.z7_stop.restype = None

        # int32_t z7_read(Context* ctx, uint8_t area, uint16_t db_num, uint32_t start, uint32_t len, uint8_t* out_buf);
        self.lib.z7_read.argtypes = [ctypes.POINTER(Context), ctypes.c_uint8, ctypes.c_uint16, ctypes.c_uint32, ctypes.c_uint32, ctypes.POINTER(ctypes.c_uint8)]
        self.lib.z7_read.restype = ctypes.c_int32

        # int32_t z7_write(Context* ctx, uint8_t area, uint16_t db_num, uint32_t start, uint32_t len, const uint8_t* in_buf);
        self.lib.z7_write.argtypes = [ctypes.POINTER(Context), ctypes.c_uint8, ctypes.c_uint16, ctypes.c_uint32, ctypes.c_uint32, ctypes.POINTER(ctypes.c_uint8)]
        self.lib.z7_write.restype = ctypes.c_int32
        
        # Keep a reference to the callback to prevent GC
        self.log_cb = self.LOG_CALLBACK_TYPE(self._log_handler)
        self.lib.z7_set_log_callback(self.log_cb)

        c_storage_path = storage_path.encode('utf-8') if storage_path else None
        self.ctx = self.lib.z7_init(port, c_storage_path)
        if not self.ctx:
            raise RuntimeError("Failed to initialize z7")

    def _log_handler(self, level, msg_ptr, msg_len):
        # Decode only up to msg_len
        msg = ctypes.string_at(msg_ptr, msg_len).decode('utf-8', errors='replace')
        print(f"{msg}", end='')

    def start(self):
        self.lib.z7_start(self.ctx)

    def stop(self):
        self.lib.z7_stop(self.ctx)

    def close(self):
        if self.ctx:
            self.lib.z7_deinit(self.ctx)
            self.ctx = None

    def read(self, area, db_num, start, length):
        buf = (ctypes.c_uint8 * length)()
        res = self.lib.z7_read(self.ctx, area, db_num, start, length, buf)
        if res != 0:
            raise RuntimeError("Read failed")
        return bytearray(buf)

    def write(self, area, db_num, start, data):
        length = len(data)
        c_data = (ctypes.c_uint8 * length)(*data)
        res = self.lib.z7_write(self.ctx, area, db_num, start, length, c_data)
        if res != 0:
            raise RuntimeError("Write failed")

if __name__ == "__main__":
    # Example usage:
    # 1. Be sure to build the DLL first: `zig build`
    # 2. Run this script from the project root: `python src/z7/client.py`
    
    dll_rel = "zig-out/bin/z7.dll"
    if os.name != 'nt':
        dll_rel = "zig-out/lib/libz7.so" # Adjust for linux if needed
        
    dll_path = os.path.abspath(dll_rel)
    
    print(f"Loading {dll_path}...")
    try:
        client = Z7Client(dll_path, port=10205) # Use different port to avoid conflict if z7.exe is running
        client.start()
        print("Server started on 10205 (background thread)")
        
        # DB1 (0x84), DB number 1, offset 0
        print("Writing 0xDEADBEEF to DB 1 offset 0...")
        client.write(0x84, 1, 0, b'\xDE\xAD\xBE\xEF')
        
        print("Reading back...")
        val = client.read(0x84, 1, 0, 4)
        print(f"Read: {val.hex().upper()}")
        
        assert val == b'\xDE\xAD\xBE\xEF'
        
        print("Sleeping 2 seconds to allow connections...")
        time.sleep(2)
        
        print("Stopping...")
        client.stop()
        client.close()
        print("Done.")
    except Exception as e:
        print(f"Error: {e}")
