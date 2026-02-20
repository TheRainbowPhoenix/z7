
const SHM_FILE = "s7_plc_shm";
const S7_HOST = "127.0.0.1";
const S7_PORT = 1102;

// S7 Constants
const AREA_INPUTS = 0x81;
const AREA_OUTPUTS = 0x82;

class S7Client {
  conn: Deno.Conn | null = null;

  async connect() {
    try {
      this.conn = await Deno.connect({ hostname: S7_HOST, port: S7_PORT });

      // 1. CR
      const cr = new Uint8Array([
        0x03, 0x00, 0x00, 0x16,
        0x11, 0xE0, 0x00, 0x00, 0x00, 0x01, 0x00, 0xC1, 0x02, 0x01, 0x00, 0xC2, 0x02, 0x01, 0x00, 0xC0, 0x01, 0x09
      ]);
      await this.conn.write(cr);
      const buf = new Uint8Array(1024);
      await this.conn.read(buf);

      // 2. Setup Comm
      const setup = new Uint8Array([
        0x03, 0x00, 0x00, 0x19,
        0x02, 0xF0, 0x80,
        0x32, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00,
        0xF0, 0x00, 0x00, 0x01, 0x00, 0x01, 0x03, 0xC0 // PDU 960
      ]);
      await this.conn.write(setup);
      await this.conn.read(buf);
      console.log("S7 Connected");
    } catch (e) {
      console.error("S7 Connection Failed:", e);
    }
  }

  async writeBit(area: number, byteAddr: number, bitAddr: number, value: boolean) {
    if (!this.conn) return;

    const bitVal = value ? 1 : 0;
    const addr = (byteAddr << 3) | bitAddr;

    const pdu = new Uint8Array([
      // TPKT
      0x03, 0x00, 0x00, 0x26, // 38 bytes
      // COTP
      0x02, 0xF0, 0x80,
      // S7 Header
      0x32, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0E, 0x00, 0x05, // ParamLen 14, DataLen 5
      // Param (Write Var)
      0x05, 0x01, // Func, ItemCount
      // Item
      0x12, 0x0A, 0x10,
      0x01, // BIT
      0x00, 0x01, // Len 1
      0x00, 0x00, // DB 0
      area, // Area
      (addr >> 16) & 0xFF, (addr >> 8) & 0xFF, addr & 0xFF,
      // Data
      0x00, // Return Code (Reserved in Req)
      0x03, // BIT
      0x00, 0x01, // Len 1 bit
      bitVal // Value
    ]);

    await this.conn.write(pdu);
    const buf = new Uint8Array(1024);
    await this.conn.read(buf);
  }
}

const s7 = new S7Client();

async function handleHttp(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn);
  for await (const requestEvent of httpConn) {
    const url = new URL(requestEvent.request.url);

    if (url.pathname === "/api/events") {
      // SSE Stream
      const body = new ReadableStream({
        async start(controller) {
          try {
            const file = await Deno.open(SHM_FILE, { read: true });
            const buf = new Uint8Array(65536 * 5); // Enough for Inputs/Outputs

            while (true) {
              await file.seek(0, Deno.SeekMode.Start);
              await file.read(buf);

              // Inputs at 0, Outputs at 65536
              const i0 = buf[0];
              const q0 = buf[65536];

              const data = JSON.stringify({
                start: (i0 & 1) > 0,
                stop: (i0 & 2) > 0,
                motor: (q0 & 1) > 0
              });

              const msg = `data: ${data}\n\n`;
              controller.enqueue(new TextEncoder().encode(msg));

              await new Promise(r => setTimeout(r, 100)); // 10Hz update
            }
          } catch (e) {
            console.error("SSE Error:", e);
            controller.close();
          }
        },
        cancel() {
          // Cleanup
        }
      });

      requestEvent.respondWith(new Response(body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      }));
    }
    else if (url.pathname === "/api/control") {
      // Handle commands
      if (requestEvent.request.method === "POST") {
        const body = await requestEvent.request.json();
        if (body.cmd === "start") {
          // Toggle Start (I0.0) -> Press
          await s7.writeBit(AREA_INPUTS, 0, 0, true);
          setTimeout(() => s7.writeBit(AREA_INPUTS, 0, 0, false), 200); // Release after 200ms
        } else if (body.cmd === "stop") {
          // Toggle Stop (I0.1) -> Press (False)
          // Default is True (NC). Pressing means setting to False.
          await s7.writeBit(AREA_INPUTS, 0, 1, false);
          setTimeout(() => s7.writeBit(AREA_INPUTS, 0, 1, true), 200); // Release (back to True)
        }
        requestEvent.respondWith(new Response("OK"));
      }
    }
    else {
      // Serve index.html
      try {
        const html = await Deno.readTextFile("index.html");
        requestEvent.respondWith(new Response(html, { headers: { "Content-Type": "text/html" } }));
      } catch {
        requestEvent.respondWith(new Response("Not Found", { status: 404 }));
      }
    }
  }
}

async function main() {
  await s7.connect();
  const server = Deno.listen({ port: 8000 });
  console.log("Deno HTTP server listening on http://localhost:8000");

  for await (const conn of server) {
    handleHttp(conn);
  }
}

main();
