"""A cooperating shared-file lock for integration fixtures on Linux and Windows."""
import ctypes
import os


class FileLock:
    def __init__(self, path):
        self.file = open(path, "r+b", buffering=0)
        if os.name == "nt":
            import msvcrt

            class Overlapped(ctypes.Structure):
                _fields_ = [("internal", ctypes.c_size_t), ("internal_high", ctypes.c_size_t),
                            ("offset", ctypes.c_uint32), ("offset_high", ctypes.c_uint32),
                            ("event", ctypes.c_void_p)]

            self.overlapped = Overlapped()
            self.handle = msvcrt.get_osfhandle(self.file.fileno())
            self.kernel = ctypes.WinDLL("kernel32", use_last_error=True)
            self.kernel.LockFileEx.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32,
                                               ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p]
            self.kernel.UnlockFileEx.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32,
                                                 ctypes.c_uint32, ctypes.c_void_p]

    def acquire(self):
        if os.name == "nt":
            if not self.kernel.LockFileEx(self.handle, 2, 0, 1, 0, ctypes.byref(self.overlapped)):
                raise ctypes.WinError(ctypes.get_last_error())
        else:
            import fcntl
            fcntl.flock(self.file, fcntl.LOCK_EX)

    def release(self):
        if os.name == "nt":
            if not self.kernel.UnlockFileEx(self.handle, 0, 1, 0, ctypes.byref(self.overlapped)):
                raise ctypes.WinError(ctypes.get_last_error())
        else:
            import fcntl
            fcntl.flock(self.file, fcntl.LOCK_UN)

    def close(self):
        self.file.close()
