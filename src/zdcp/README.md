# zDCP (Windows)

`zig build zdcp -Doptimize=ReleaseSafe` produces `zig-out/bin/zDCP.exe`.
Copy that EXE to the VM. Install Npcap there and run an elevated terminal:

```powershell
.\zDCP.exe --list
.\zDCP.exe --interface 1 --ip 192.168.0.100 --name zomsp-plc
```

For TIA and the helper on the same PLCSIM virtual adapter, use a distinct
simulated identity and the priority-tagged replies used by `sim5_veth.py`:

```powershell
.\zDCP.exe --interface 1 --ip 192.168.10.100 --mac 02:c0:a8:00:64:01 --name plcxb1201.profinetxainterfacesim999 --description "CPU-1500 Simulation" --mask 255.0.0.0 --gateway 192.168.0.1 --vlan0 --verbose
```

Stop the Python responder first to avoid duplicate identities. `--mac` controls
the DCP identity only; it does not configure an adapter MAC or implement ARP.
`--vlan0` inserts VLAN ID 0 on otherwise untagged replies. Already tagged
requests retain their tag. `--verbose` logs received PROFINET frames even if
the responder rejects them. Requests sent by the local adapter are accepted;
response service types are ignored, preventing reply loops.

Choose the Ethernet adapter connected to TIA's network. The advertised IP must
already belong to that Windows adapter; the helper uses its real MAC so ARP and
TCP reach the same machine. Set `--mask` and `--gateway` to match the adapter.
The default identity matches the previous Python dummy PLC: Siemens vendor
0x002a, device 0x010e, S7-1500 description. `--description` changes the text.

Run zOMSp or z7 separately, listening on that IP (or 0.0.0.0), TCP port 102.
Allow inbound TCP/102 in Windows Firewall. In TIA, select the corresponding
Ethernet interface and scan Accessible devices. DCP is Ethernet layer 2:
the VM network must carry the scanner's multicast frames (bridged/external
switch, same VLAN); NAT alone will not carry discovery.

The helper answers Identify (including station-name/MAC filters), preserves a
single incoming VLAN tag and acknowledges Flash commands. It does not change
Windows IP/station settings or implement DCP Set-IP/Set-name, Get, LLDP, an IO
device stack or a PLC runtime. Discovery does not imply full TIA online support;
the selected TCP server supplies the actual S7/OMSp capabilities.

`zDCP.exe --self-test` checks packet construction, VLAN, Flash, truncated input
and malformed filters without opening an adapter. Ctrl+C stops the live helper.
Npcap is loaded from the Windows system directory; its DLLs are not bundled.
