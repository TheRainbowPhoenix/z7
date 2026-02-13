const std = @import("std");
const builtin = @import("builtin");
const windows = if (builtin.os.tag == .windows) std.os.windows else struct {};
const posix = std.posix;
pub const Storage = struct {
    ptr: []align(std.heap.page_size_min) u8,
    // Keep file handle for locking
    handle: if (builtin.os.tag == .windows) windows.HANDLE else posix.fd_t,

    // Offsets
    pub const OFFSET_INPUTS: usize = 0;
    pub const OFFSET_OUTPUTS: usize = 65536;
    pub const OFFSET_MERKERS: usize = 131072;
    pub const OFFSET_TIMERS: usize = 196608;
    pub const OFFSET_COUNTERS: usize = 262144;
    pub const OFFSET_DB_START: usize = 327680;
    pub const DB_SIZE: usize = 65536;
    pub const MAX_DBS: usize = 128;
    // Total size fits in u32
    pub const TOTAL_SIZE: usize = OFFSET_DB_START + (MAX_DBS * DB_SIZE);

    extern "kernel32" fn CreateFileW(
        lpFileName: [*:0]const u16,
        dwDesiredAccess: windows.DWORD,
        dwShareMode: windows.DWORD,
        lpSecurityAttributes: ?*anyopaque,
        dwCreationDisposition: windows.DWORD,
        dwFlagsAndAttributes: windows.DWORD,
        hTemplateFile: ?windows.HANDLE,
    ) callconv(windows.WINAPI) windows.HANDLE;

    extern "kernel32" fn CreateFileMappingW(
        hFile: windows.HANDLE,
        lpFileMappingAttributes: ?*anyopaque,
        flProtect: windows.DWORD,
        dwMaximumSizeHigh: windows.DWORD,
        dwMaximumSizeLow: windows.DWORD,
        lpName: ?[*:0]const u16,
    ) callconv(windows.WINAPI) ?windows.HANDLE;

    extern "kernel32" fn MapViewOfFile(
        hFileMappingObject: windows.HANDLE,
        dwDesiredAccess: windows.DWORD,
        dwFileOffsetHigh: windows.DWORD,
        dwFileOffsetLow: windows.DWORD,
        dwNumberOfBytesToMap: usize,
    ) callconv(windows.WINAPI) ?*anyopaque;

    extern "kernel32" fn UnmapViewOfFile(lpBaseAddress: ?*anyopaque) callconv(windows.WINAPI) i32;
    extern "kernel32" fn CloseHandle(hObject: windows.HANDLE) callconv(windows.WINAPI) i32;

    extern "kernel32" fn LockFileEx(
        hFile: windows.HANDLE,
        dwFlags: windows.DWORD,
        dwReserved: windows.DWORD,
        nNumberOfBytesToLockLow: windows.DWORD,
        nNumberOfBytesToLockHigh: windows.DWORD,
        lpOverlapped: *windows.OVERLAPPED,
    ) callconv(windows.WINAPI) windows.BOOL;

    extern "kernel32" fn UnlockFileEx(
        hFile: windows.HANDLE,
        dwReserved: windows.DWORD,
        nNumberOfBytesToUnlockLow: windows.DWORD,
        nNumberOfBytesToUnlockHigh: windows.DWORD,
        lpOverlapped: *windows.OVERLAPPED,
    ) callconv(windows.WINAPI) windows.BOOL;

    // Windows Constants
    const FILE_MAP_ALL_ACCESS: windows.DWORD = 0xF001F;

    pub fn init(name: []const u8) !Storage {
        if (builtin.os.tag == .windows) {
            const name_w = try std.unicode.utf8ToUtf16LeAllocZ(std.heap.page_allocator, name);
            defer std.heap.page_allocator.free(name_w);

            const hFile = CreateFileW(
                // Use invalid handle value to create page-file backed shared memory (system memory),
                // OR use a file path to map a real file.
                // But the user code used "s7_plc_shm" as a filename in CreateFileW?
                // Wait, CreateFileW expects a path. If "s7_plc_shm" is passed, it creates a file in current dir.
                // The Python script: open("s7_plc_shm", "wb")
                name_w.ptr,
                windows.GENERIC_READ | windows.GENERIC_WRITE,
                windows.FILE_SHARE_READ | windows.FILE_SHARE_WRITE | windows.FILE_SHARE_DELETE,
                null,
                windows.OPEN_ALWAYS,
                windows.FILE_ATTRIBUTE_NORMAL,
                null,
            );

            if (hFile == windows.INVALID_HANDLE_VALUE) return error.OpenFileFailed;
            errdefer _ = CloseHandle(hFile);

            const hMap = CreateFileMappingW(hFile, null, windows.PAGE_READWRITE, 0, @as(u32, @intCast(TOTAL_SIZE)), null) orelse return error.CreateMappingFailed;

            // We can close the mapping handle after mapping view, but we might want to keep it if we were sharing strictly via handle.
            // But for named SHM, the name keeps it alive if we passed a name to CreateFileMapping.
            // Here we passed NULL name to CreateFileMapping?
            // Wait, the user passed `lpName` in his snippet.
            // I passed `null`.

            // Python `mmap` uses the file handle.
            // If I want other processes to see it via *file*, I don't need a named mapping, just the file.
            // If I want *named shared memory* backed by paging file, I use INVALID_HANDLE_VALUE and a name.
            // The user's Python script: "Use file-backed mmap... open(filename)... mmap(fileno)".
            // So it is FILE BACKED.

            defer _ = CloseHandle(hMap);

            const ptr = MapViewOfFile(
                hMap,
                FILE_MAP_ALL_ACCESS,
                0,
                0,
                TOTAL_SIZE,
            ) orelse return error.MapViewFailed;

            const slice: [*]align(std.heap.page_size_min) u8 = @ptrCast(@alignCast(ptr));
            return Storage{
                .ptr = slice[0..TOTAL_SIZE],
                .handle = hFile,
            };
        } else {
            // Linux implementation
            const fd = try posix.open(name, .{ .ACCMODE = .RDWR, .CREAT = true }, 0o666);
            errdefer posix.close(fd);

            // Ensure file is big enough
            const file = std.fs.File{ .handle = fd };
            try file.setEndPos(TOTAL_SIZE);

            const ptr = try posix.mmap(
                null,
                TOTAL_SIZE,
                posix.PROT.READ | posix.PROT.WRITE,
                .{ .TYPE = .SHARED },
                fd,
                0,
            );

            return Storage{
                .ptr = ptr,
                .handle = fd,
            };
        }
    }

    pub fn deinit(self: *Storage) void {
        if (builtin.os.tag == .windows) {
            _ = UnmapViewOfFile(self.ptr.ptr);
            _ = CloseHandle(self.handle);
        } else {
            posix.munmap(self.ptr);
            posix.close(self.handle);
        }
    }

    pub fn lock(self: *Storage) !void {
        if (builtin.os.tag == .windows) {
            var overlapped = std.mem.zeroes(windows.OVERLAPPED);
            const flags = 2; // LOCKFILE_EXCLUSIVE_LOCK
            if (LockFileEx(self.handle, flags, 0, @as(u32, @intCast(self.ptr.len)), 0, &overlapped) == 0) {
                return error.LockFailed;
            }
        } else {
            try posix.flock(self.handle, posix.LOCK.EX);
        }
    }

    pub fn unlock(self: *Storage) void {
        if (builtin.os.tag == .windows) {
            var overlapped = std.mem.zeroes(windows.OVERLAPPED);
            _ = UnlockFileEx(self.handle, 0, @as(u32, @intCast(self.ptr.len)), 0, &overlapped);
        } else {
            posix.flock(self.handle, posix.LOCK.UN) catch {};
        }
    }

    pub fn get_slice(self: *Storage, offset: usize, len: usize) ![]u8 {
        if (offset >= self.ptr.len) return self.ptr[0..0];
        const actual_len = @min(len, self.ptr.len - offset);
        return self.ptr[offset..][0..actual_len];
    }

    pub fn get_address(self: *Storage, area: u8, db_num: u16, start_byte: u32, len_bytes: u32) ![]u8 {
        var base: usize = 0;
        switch (area) {
            0x81 => base = OFFSET_INPUTS,
            0x82 => base = OFFSET_OUTPUTS,
            0x83 => base = OFFSET_MERKERS,
            0x84 => {
                if (db_num >= MAX_DBS) return error.OutOfBounds;
                base = OFFSET_DB_START + (@as(usize, db_num) * DB_SIZE);
            },
            0x1C => base = OFFSET_COUNTERS,
            0x1D => base = OFFSET_TIMERS,
            else => return error.InvalidArea,
        }
        return self.get_slice(base + start_byte, len_bytes);
    }
};
