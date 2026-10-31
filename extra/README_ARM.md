# ARM builds and CI

CI builds these Raspberry Pi / Linux targets:

| Target | CPU / runtime | Coverage |
| --- | --- | --- |
| aarch64-linux-gnu | baseline ARM64, glibc | Debug and ReleaseSafe builds, native ARM64 tests |
| aarch64-linux-musl | baseline ARM64, musl | ReleaseSafe build |
| arm-linux-musleabihf | Cortex-A7, ARMv7 hard float, musl | ReleaseSafe cross-build only |

Use ARM64 artifacts on a 64-bit Raspberry Pi OS installation. The ARMv7 artifact
targets compatible 32-bit systems (Pi 2 and later); it does not target the original
ARMv6 Pi or Pi Zero. A musl shared library requires a matching musl host process;
use the GNU library with Raspberry Pi OS's glibc Python/application runtime.

The ARM64 jobs run on `ubuntu-24.04-arm`. The Ignition matrix executes native
parser, lifecycle, crash recovery, stream, deferred-write and alarm tests, plus
the Java suite and contention case. These run on an ARM64 Linux VM, not physical
Raspberry Pi hardware. Artifacts use the existing per-target download names.

The server requires Linux 5.5 or newer and access to io_uring. ARM CPU compatibility
alone does not establish compatibility with a device's kernel or sandbox policy.

## Android boundary

These are Linux artifacts, not Android/Bionic libraries or an APK. Stock Android
apps cannot use the existing io_uring backend: Google's Android seccomp policy
blocks io_uring, independently of the CPU target. Native Android app support needs
an allowed I/O backend plus Android/Bionic builds and on-device tests. This CI
change does not claim Android runtime support or weaken Android restrictions.

References:
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://security.googleblog.com/2023/06/learnings-from-kctf-vrps-42-linux.html
