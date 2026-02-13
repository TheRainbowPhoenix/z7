#!/usr/bin/env python3
import hashlib
import os
import platform
import shutil
import sys
import urllib.request
import zipfile

# Configuration
ZIG_MIRROR = "https://pkg.machengine.org/zig".strip()  # Trim accidental spaces
ZIG_RELEASE = "0.14.1"
ZIG_CHECKSUMS = {
    f"{ZIG_MIRROR}/{ZIG_RELEASE}/zig-aarch64-windows-{ZIG_RELEASE}.zip": 
        "b5aac0ccc40dd91e8311b1f257717d8e3903b5fefb8f659de6d65a840ad1d0e7",
    f"{ZIG_MIRROR}/{ZIG_RELEASE}/zig-x86_64-windows-{ZIG_RELEASE}.zip": 
        "554f5378228923ffd558eac35e21af020c73789d87afeabf4bfd16f2e6feed2c",
}

# Detect architecture
arch = platform.machine().lower()
if arch in ("arm64", "aarch64"):
    ZIG_ARCH = "aarch64"
elif arch in ("amd64", "x86_64"):
    ZIG_ARCH = "x86_64"
else:
    print(f"Unsupported architecture: {arch}", file=sys.stderr)
    sys.exit(1)

# Build URL and paths
ZIG_URL = f"{ZIG_MIRROR}/{ZIG_RELEASE}/zig-{ZIG_ARCH}-windows-{ZIG_RELEASE}.zip"
ZIG_ARCHIVE = os.path.basename(ZIG_URL)
ZIG_DIRECTORY = ZIG_ARCHIVE.replace(".zip", "")
ZIG_CHECKSUM_EXPECTED = ZIG_CHECKSUMS.get(ZIG_URL)

if not ZIG_CHECKSUM_EXPECTED:
    print(f"No checksum found for URL: {ZIG_URL}", file=sys.stderr)
    sys.exit(1)

# Download
print(f"Downloading Zig {ZIG_RELEASE} for Windows...")
try:
    urllib.request.urlretrieve(ZIG_URL, ZIG_ARCHIVE)
except Exception as e:
    print(f"Download failed: {e}", file=sys.stderr)
    sys.exit(1)

# Verify checksum
print("Verifying checksum...")
sha256 = hashlib.sha256()
with open(ZIG_ARCHIVE, "rb") as f:
    for chunk in iter(lambda: f.read(4096), b""):
        sha256.update(chunk)
ZIG_CHECKSUM_ACTUAL = sha256.hexdigest()

if ZIG_CHECKSUM_ACTUAL.lower() != ZIG_CHECKSUM_EXPECTED.lower():
    print(f"Checksum mismatch!", file=sys.stderr)
    print(f"  Expected: {ZIG_CHECKSUM_EXPECTED}", file=sys.stderr)
    print(f"  Actual:   {ZIG_CHECKSUM_ACTUAL}", file=sys.stderr)
    os.remove(ZIG_ARCHIVE)
    sys.exit(1)

# Extract
print(f"Extracting {ZIG_ARCHIVE}...")
try:
    with zipfile.ZipFile(ZIG_ARCHIVE, "r") as zip_ref:
        zip_ref.extractall(".")
finally:
    os.remove(ZIG_ARCHIVE)

# Install files into ./zig directory
print("Installing files...")
zig_dest = "zig"
os.makedirs(zig_dest, exist_ok=True)

for item in ["LICENSE", "README.md", "doc", "lib", "zig.exe"]:
    src = os.path.join(ZIG_DIRECTORY, item)
    dst = os.path.join(zig_dest, item)
    
    if not os.path.exists(src):
        print(f"Warning: {src} not found in archive", file=sys.stderr)
        continue
    
    if os.path.isdir(src):
        if os.path.exists(dst):
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    else:
        if os.path.exists(dst):
            os.remove(dst)
        shutil.copy2(src, dst)

# Cleanup extracted directory
try:
    shutil.rmtree(ZIG_DIRECTORY)
except Exception as e:
    print(f"Warning: Could not remove {ZIG_DIRECTORY}: {e}", file=sys.stderr)

# Final message
ZIG_BIN = os.path.join(os.getcwd(), "zig", "zig.exe")
print(f"Download completed successfully!")
print(f"Zig installed at: {ZIG_BIN}")
print("Add this directory to your PATH to use 'zig' globally.")