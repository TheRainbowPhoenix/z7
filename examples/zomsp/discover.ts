// C FFI performs V2 discovery and decodes objects; TypeScript parses no OMSp bytes.
const [library, tls, certificate, port = "1102"] = Deno.args;
if (!certificate) throw new Error("Usage: discover.ts LIBRARY TLS_LIBRARY CERTIFICATE [PORT]");
const ffi = Deno.dlopen(library, {
  zomsp_client_open: { parameters: ["buffer", "u16", "buffer", "buffer"], result: "pointer", nonblocking: true },
  zomsp_client_close: { parameters: ["pointer"], result: "void" },
  zomsp_client_explore: { parameters: ["pointer", "u32", "pointer", "buffer", "usize", "buffer"], result: "isize", nonblocking: true },
  zomsp_client_get_link: { parameters: ["pointer", "u32", "u32", "buffer", "usize"], result: "isize", nonblocking: true },
  zomsp_objects_visit: { parameters: ["buffer", "usize", "pointer", "pointer"], result: "i32" },
} as const);
const text = (value: string) => new TextEncoder().encode(value + "\0");
const client = await ffi.symbols.zomsp_client_open(text("127.0.0.1"), Number(port), text(certificate), text(tls));
if (!client) throw new Error("TLS/session login failed");
const objects: { rid: number; classId: number; flags: number; composition: number }[] = [];
const visitor = new Deno.UnsafeCallback({ parameters: ["pointer", "pointer"], result: "void" }, (_user, pointer) => {
  if (!pointer) return;
  const record = new Deno.UnsafePointerView(pointer);
  if (record.getUint32(0) === 1) objects.push({ rid: record.getUint32(4), classId: record.getUint32(8), flags: record.getUint32(12), composition: record.getUint32(16) });
});
try {
  const bytes = new Uint8Array(65535);
  const parent = new Uint32Array(1);
  const length = await ffi.symbols.zomsp_client_explore(client, 201, null, bytes, BigInt(bytes.length), parent);
  if (length < 0n || ffi.symbols.zomsp_objects_visit(bytes, BigInt(length), visitor.pointer, null) < 0) throw new Error("Explore failed");
  if (objects.length < 2) throw new Error("Expected root and application objects");
  const links = new Uint32Array(16);
  const count = await ffi.symbols.zomsp_client_get_link(client, 201, 2699, links, 16n);
  if (count !== 1n || !objects.some((item) => item.rid === links[0])) throw new Error("GetLink did not resolve to an explored object");
  console.log(JSON.stringify({ objects, links: [...links.subarray(0, Number(count))] }, null, 2));
} finally {
  visitor.close();
  ffi.symbols.zomsp_client_close(client);
  ffi.close();
}
