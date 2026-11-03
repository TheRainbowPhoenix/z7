# Counter PLC demo

From the z7 repository, with zOMSp built and the native probe/test credentials
prepared by `TESTS/omsp/native/run.py`:

Windows (Windows Python, Windows `zomsp.dll` server, Windows `zOMSp.exe` client):

```powershell
python TESTS/omsp/vplc_demo.py --native-wsl podman-machine-default
```

Linux:

```sh
python3 TESTS/omsp/vplc_demo.py
```

Use `--help` to override the shared library, TLS library, credentials, native
probe or Python package paths. The Python package defaults to `../tia-tools/sps7`.
Native SDK preparation uses Linux Zig and the pinned native library as in the
native CI runner. The Windows test uses that Linux SDK under the selected WSL
distro; a stdio relay connects its loopback socket to the Windows server without
opening an external listener. This does not test a Windows Siemens SDK build.

Every run creates three separate temporary mapped PLCs. Each starts with source
`STOP` and a read-only UDInt counter at RID 1000/AID 43. Source is an uploadable
WString at RID 1000/AID 42. The three clients independently upload:

```
COUNTER register=43 step=1 period_ms=20
```

The Python host validates this tiny language from the transaction's private
image. It only starts execution after the image is committed. The host adds the
specified step to the register periodically, wrapping at UInt32. Python, the
zOMSp executable and the native SDK each read five samples over OMSp, and must
observe a strictly increasing sequence. Samples are printed as JSON; `--output`
writes the successful report. Runtime errors or a failed client fail the run.

This is a protocol/frontend integration demo: the language is deliberately
restricted to register 43, step 1..1000 and period 20..1000 ms. It executes no
Python source. Replace the compiler and runtime functions to integrate a real
compiler. Timer scheduling is best effort, not a PLC real-time guarantee.

`ZOMSP_PROGRAM` selects WString source upload in the zOMSp executable activation
probe. `OMSP_PROGRAM` does the same for the native probe. Both clients also read
and assert register progression themselves; the Python driver does not substitute
its own reads for those tests. Existing activation tests retain the UDInt probe
when these variables are absent.

Source remains bounded to 900 UTF-8 bytes by these probes and 1024 encoded bytes
per mapped value. This counter probe remains small; use `large_program.py` for file-backed large
program transfers, including its exact 8 MiB sine LUT example.

The CI matrix runs `program.py` through `tls.py` on Windows, Linux x64 and Linux
ARM64. This stdlib-only variant uses the platform's zOMSp executable and shared
library, validates the bounded counter instruction, then executes it in a Python
host. It needs neither tia-tools nor the native SDK. Five reads made by the
zOMSp executable must increase after upload and commit.


## Large sine-LUT demo

`python TESTS/omsp/large_program.py` uses the platform zOMSp executable/server and
a stdlib Python compiler/runtime to upload and execute an 8 MiB program. Add
`--clients zomsp,python,native` for all three clients; on Windows also select
`--native-wsl podman-machine-default`. The Windows zOMSp client and server remain
Windows binaries. Source SHA-256, committed file SHA-256, and five sine values
are checked. `--output report.json` records sizes, elapsed times and results.
The 8 MiB zOMSp-only test runs in the existing cross-platform CI TLS step.
