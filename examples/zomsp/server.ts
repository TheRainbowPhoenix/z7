// Deno owns the application; Zig owns OMSp, TLS, sockets and upload assembly.
// server.ts LIBRARY TLS_LIBRARY CERTIFICATE KEY [PORT] [DURATION_MS]
const [library, tls, certificate, key, port = "1102", duration = "0"] = Deno.args;
if (!key) throw new Error("Usage: server.ts LIBRARY TLS_LIBRARY CERTIFICATE KEY [PORT] [DURATION_MS]");
const ffi = Deno.dlopen(library, {
  zomsp_open: { parameters: ["buffer", "u8"], result: "pointer" },
  zomsp_close: { parameters: ["pointer"], result: "void", nonblocking: true },
  zomsp_object: { parameters: ["pointer", "u32", "u32", "u32"], result: "i32" },
  zomsp_set: { parameters: ["pointer", "u32", "u32", "buffer", "usize", "u8"], result: "i32" },
  zomsp_transactions: { parameters: ["pointer", "u8"], result: "i32" },
  zomsp_stream: { parameters: ["pointer", "u32", "u32", "u32", "pointer", "pointer", "pointer"], result: "i32" },
  zomsp_start: { parameters: ["pointer", "u16", "buffer", "buffer", "buffer"], result: "i32" },
  zomsp_port: { parameters: ["pointer"], result: "u16" },
  zomsp_buffer_retain: { parameters: ["pointer"], result: "void" },
  zomsp_buffer_release: { parameters: ["pointer"], result: "void" },
  zomsp_buffer_size: { parameters: ["pointer"], result: "usize" },
  zomsp_buffer_read: { parameters: ["pointer", "usize", "buffer", "usize"], result: "isize" },
} as const);
const api = ffi.symbols;
const encoder = new TextEncoder();
const text = (value: string) => encoder.encode(value + "\0");
const check = (result: number) => { if (result < 0) throw new Error(`zOMSp error ${result}`); };
const integer = (value: number) => {
  const bytes = [value & 127];
  while ((value = Math.floor(value / 128)) > 0) bytes.unshift(128 | (value & 127));
  return new Uint8Array([0, 4, ...bytes]);
};
const directory = await Deno.makeTempDir({ prefix: "zomsp-deno-" });
const context = api.zomsp_open(text(`${directory}/values.shm`), 1);
if (!context) throw new Error("Cannot create backend");
let failure: unknown;
let running = false;
let counter = 0;
let uploads = 0;
const pending = new Set<Deno.PointerValue>();
function set(rid: number, aid: number, raw: Uint8Array, writable = false) {
  const result = api.zomsp_set(context, rid, aid, raw, BigInt(raw.length), Number(writable));
  // A network worker may briefly hold the mapping; the next timer retries.
  if (result !== -6) check(result);
}
function variable(rid: number, name: string, value: number, writable = false) {
  check(api.zomsp_object(context, rid, 201, 9001));
  const bytes = encoder.encode(name);
  if (bytes.length > 127) throw new Error("Demo name too long");
  set(rid, 233, new Uint8Array([0, 0x15, bytes.length, ...bytes]));
  set(rid, 42, integer(value), writable);
}
const program = encoder.encode("ADD Counter 1\n");
// Native completion runs on a network worker. Retain before returning, then
// compile on the event loop. No upload file or callback-owned pointer escapes.
const completion = Deno.UnsafeCallback.threadSafe({ parameters: ["pointer", "pointer", "pointer"], result: "void" }, (_user, _call, buffer) => {
  if (!buffer) return;
  api.zomsp_buffer_retain(buffer);
  pending.add(buffer);
  setTimeout(() => {
    try {
      const length = Number(api.zomsp_buffer_size(buffer));
      const bytes = new Uint8Array(length);
      const count = Number(api.zomsp_buffer_read(buffer, 0n, bytes, BigInt(length)));
      if (count !== program.length || !bytes.every((byte, index) => byte === program[index])) {
        throw new Error("Unexpected uploaded program contents");
      }
      running = true;
      uploads++;
      set(1002, 42, integer(uploads));
      console.log(JSON.stringify({ compiled: new TextDecoder().decode(bytes).trim(), bytes: count }));
    } catch (error) { failure = error; }
    finally { api.zomsp_buffer_release(buffer); pending.delete(buffer); }
  }, 0);
});
let timer: ReturnType<typeof setInterval> | undefined;
try {
  check(api.zomsp_object(context, 201, 0, 9000));
  variable(1000, "Counter", 0);
  variable(1001, "Setpoint", 10, true);
  variable(1002, "Uploads", 0);
  check(api.zomsp_object(context, 2000, 201, 9001));
  check(api.zomsp_transactions(context, 1));
  check(api.zomsp_stream(context, 2000, 42, program.length, null, completion.pointer, null));
  check(api.zomsp_start(context, Number(port), text(certificate), text(key), text(tls)));
  console.log(JSON.stringify({ ready: api.zomsp_port(context), variables: ["Counter", "Setpoint", "Uploads"] }));
  timer = setInterval(() => {
    try {
      set(1002, 42, integer(uploads));
      if (running) set(1000, 42, integer(++counter));
    } catch (error) { failure = error; }
  }, 50);
  await new Promise<void>((resolve) => {
    if (Number(duration) > 0) setTimeout(resolve, Number(duration));
    else Deno.addSignalListener("SIGINT", resolve);
  });
} finally {
  clearInterval(timer);
  // Keep the event loop available until all native callbacks have returned.
  await api.zomsp_close(context);
  while (pending.size) await new Promise((resolve) => setTimeout(resolve, 1));
  completion.close();
  ffi.close();
  await Deno.remove(directory, { recursive: true });
}
if (failure) throw failure;
console.log(JSON.stringify({ stopped: true, uploads, counter }));
