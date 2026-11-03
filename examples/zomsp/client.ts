// Run against server.py. Calls the zOMSp client library, not a TS OMSp implementation.
const [library, tlsLibrary, certificate, portText = "1102"] = Deno.args;
if (!library || !tlsLibrary || !certificate) {
  throw new Error("Usage: client.ts LIBRARY TLS_LIBRARY CERTIFICATE [PORT]");
}
const ffi = Deno.dlopen(library, {
  zomsp_client_open: { parameters: ["buffer", "u16", "buffer", "buffer"], result: "pointer", nonblocking: true },
  zomsp_client_close: { parameters: ["pointer"], result: "void" },
  zomsp_client_find: { parameters: ["pointer", "u32", "buffer", "usize", "buffer"], result: "i32", nonblocking: true },
  zomsp_client_read: { parameters: ["pointer", "u32", "u32", "buffer", "usize"], result: "isize", nonblocking: true },
} as const);
const encoder = new TextEncoder();
const cstring = (value: string) => encoder.encode(value + "\0");
const client = await ffi.symbols.zomsp_client_open(cstring("127.0.0.1"), Number(portText), cstring(certificate), cstring(tlsLibrary));
if (!client) throw new Error("TLS/session login failed");
try {
  const name = encoder.encode("Counter");
  const rid = new Uint32Array(1);
  if (await ffi.symbols.zomsp_client_find(client, 201, name, BigInt(name.length), rid) < 0) throw new Error("Name lookup failed");
  const samples: number[] = [];
  for (let index = 0; index < 5; index++) {
    const raw = new Uint8Array(1024);
    const length = Number(await ffi.symbols.zomsp_client_read(client, rid[0], 42, raw, BigInt(raw.length)));
    if (length < 3 || raw[0] !== 0 || raw[1] !== 4) throw new Error("Expected UDInt");
    let value = 0;
    for (const byte of raw.subarray(2, length)) value = value * 128 + (byte & 127);
    samples.push(value);
    console.log("Counter =", value);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!samples.slice(1).every((value, index) => value > samples[index])) throw new Error("Counter is not advancing");
} finally {
  ffi.symbols.zomsp_client_close(client);
  ffi.close();
}
