package z7.harness;

import com.inductiveautomation.xopc.drivers.siemens.address.*;
import com.inductiveautomation.xopc.drivers.siemens.factories.*;
import com.inductiveautomation.xopc.drivers.siemens.protocols.*;
import com.inductiveautomation.xopc.drivers.siemens.requests.ReadResponseHandler;
import com.inductiveautomation.xopc.drivers.siemens.structs.*;
import com.inductiveautomation.xopc.drivers.siemens.structs.readers.*;
import com.inductiveautomation.xopc.drivers.siemens.structs.writers.*;
import com.inductiveautomation.xopc.driver.api.items.*;
import org.eclipse.milo.opcua.stack.core.types.builtin.*;
import java.io.*;
import java.net.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Consumer;
import java.util.concurrent.*;

/** Original vendor codecs run from the supplied JAR. Alarm support is a separate test adapter. */
public final class DriverHarness {
    private static final int MAX_FRAME = 16384;
    private static final BufferedReader CONTROL = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
    private static int failures;

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    private interface Test { void run() throws Exception; }
    private static void test(String name, Test action) {
        try {
            action.run();
            System.out.println("RESULT\t" + name + "\tPASS\t");
        } catch (Throwable error) {
            failures++;
            String detail = error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage());
            System.out.println("RESULT\t" + name + "\tFAIL\t" + detail.replace('\t', ' ').replace('\n', ' '));
            error.printStackTrace(System.err);
        }
    }
    private static void controlSet(int id, int signals) throws Exception {
        System.out.println("CONTROL SET " + id + " " + signals);
        System.out.flush();
        require("0".equals(CONTROL.readLine()), "fixture alarm injection failed");
    }
    private static String hex(byte[] bytes) {
        StringBuilder text = new StringBuilder();
        for (byte value : bytes) text.append(String.format("%02x", value & 255));
        return text.toString();
    }
    private static ApplicationData data(int length, Consumer<ByteBuffer> writer) {
        return new ApplicationData() {
            public int length() { return length; }
            public void write(ByteBuffer buffer) { writer.accept(buffer); }
        };
    }
    private static ProtocolStack stack(boolean cotp) {
        LinkedList<ProtocolLayer> layers = new LinkedList<>();
        if (cotp) layers.add(new COTPDataLayer());
        layers.add(new TPKTLayer());
        return new ProtocolStack(layers);
    }

    private static final class Item implements ReadItem, WriteItem {
        final S7Address address;
        final Variant writeValue;
        DataValue readValue;
        Item(S7Address address, Object value) { this.address = address; writeValue = new Variant(value); }
        public Object getAddressObject() { return address; }
        public Variant getWriteValue() { return writeValue; }
        public void setValue(DataValue value) { readValue = value; }
        public void setWriteStatus(StatusCode status) { require(status.isGood(), "bad write status"); }
    }
    private static ReadAddressBlock readBlock(Item item) {
        return new ReadAddressBlock(new ArrayList<>(Collections.singletonList(item)));
    }
    private static WriteAddressBlock writeBlock(Item item) {
        return new WriteAddressBlock(new ArrayList<>(Collections.singletonList(item)));
    }
    private static S7Address address(S7DataType type, int offset) {
        return new S7Address(S7Area.DATA_BLOCKS, 1, type, offset);
    }

    private static final class Session implements AutoCloseable {
        final Socket socket = new Socket();
        final ProtocolStack protocol = stack(true);
        final ArrayDeque<Alarm> notifications = new ArrayDeque<>();
        boolean trace = true;
        short sequence = 1;
        final int pdu;

        Session(int port, int requestedPdu) throws Exception { this(port, requestedPdu, true); }
        Session(int port, int requestedPdu, boolean trace) throws Exception {
            this.trace = trace;
            socket.connect(new InetSocketAddress("127.0.0.1", port), 2000);
            socket.setSoTimeout(2000);
            socket.setTcpNoDelay(true);
            COTPConnectRequest connect = new COTPConnectRequest((short) 1, (byte) 1);
            byte[] cr = transmit(stack(false), data(connect.length(), b -> new COTPConnectRequestWriter().write(connect, b)));
            send(cr);
            COTPConnectResponse cc = new COTPConnectResponseReader().read(stack(false).receive(receive()).dataBuffer());
            require(cc.getType() == (byte) 0xd0 && cc.getDestinationReference() == 1, "invalid COTP confirmation");
            S7NegotiatePDURequest request = S7NegotiatePDURequestFactory.buildRequest(next(), (short) requestedPdu);
            ByteBuffer reply = exchange(data(request.length(), b -> new S7NegotiatePDURequestWriter().write(request, b)),
                request.getHeader().getSequence(), 3);
            pdu = new S7NegotiatePDUResponseReader().read(reply).getParameters().getPduSize() & 65535;
            require(pdu == requestedPdu, "negotiated PDU differs from proposal: " + pdu);
        }
        short next() { sequence = (short) (sequence + 1); return sequence; }
        static byte[] transmit(ProtocolStack stack, ApplicationData application) {
            TxPacket packet = stack.transmit(application);
            ByteBuffer buffer = packet.getBuffer();
            byte[] bytes = new byte[packet.length()];
            buffer.get(bytes);
            return bytes;
        }
        void send(byte[] bytes) throws IOException {
            require(bytes.length >= 7 && bytes.length <= MAX_FRAME, "outgoing frame outside bound");
            if (trace) System.out.println("WIRE\tTX\t" + hex(bytes));
            socket.getOutputStream().write(bytes);
            socket.getOutputStream().flush();
        }
        byte[] exact(int length) throws IOException {
            require(length >= 0 && length <= MAX_FRAME, "incoming allocation outside bound");
            byte[] bytes = new byte[length];
            new DataInputStream(socket.getInputStream()).readFully(bytes);
            return bytes;
        }
        byte[] receive() throws IOException {
            byte[] header = exact(4);
            int length = ((header[2] & 255) << 8) | (header[3] & 255);
            require(header[0] == 3 && header[1] == 0 && length >= 7 && length <= MAX_FRAME, "invalid TPKT");
            byte[] packet = Arrays.copyOf(header, length);
            byte[] body = exact(length - 4);
            System.arraycopy(body, 0, packet, 4, body.length);
            if (trace) System.out.println("WIRE\tRX\t" + hex(packet));
            require(pdu == 0 || packet.length - 7 <= pdu, "response exceeds negotiated PDU");
            return packet;
        }
        ByteBuffer exchange(ApplicationData request, short reference, int rosctr) throws Exception {
            send(transmit(protocol, request));
            for (int count = 0; count < 128; count++) {
                byte[] bytes = receive();
                require(bytes.length >= 17, "short S7 response");
                if (bytes[8] == 7 && bytes.length >= 29 && bytes[22] == 4) {
                    require(notifications.size() < 128, "unsolicited queue full");
                    notifications.addLast(Alarm.decode(bytes));
                    continue;
                }
                require((bytes[8] & 255) == rosctr, "unexpected ROSCTR");
                require(ByteBuffer.wrap(bytes).getShort(11) == reference, "wrong PDU reference");
                return protocol.receive(bytes).dataBuffer();
            }
            throw new IOException("too many indications without a response");
        }
        List<ReadResult> read(List<ReadAddressBlock> blocks) throws Exception {
            S7ReadRequest request = S7ReadRequestFactory.buildRequest(next(), blocks);
            ByteBuffer response = exchange(data(request.length(), b -> new S7ReadRequestWriter().write(request, b)),
                request.getHeader().getSequence(), 3);
            List<ReadResult> results = new S7ReadResponseReader().read(response).getData().getReadResults();
            require(results.size() == blocks.size(), "read item count mismatch");
            for (ReadResult result : results) require(result.getErrorCode() == (byte) 0xff, "read item failed");
            new ReadResponseHandler(blocks).handleResults(results);
            return results;
        }
        void write(List<Item> items) throws Exception {
            List<WriteAddressBlock> blocks = new ArrayList<>();
            List<ValueBlock> values = new ArrayList<>();
            for (Item item : items) {
                blocks.add(writeBlock(item));
                values.add(ValueBlockFactory.get(item.getWriteValue(), item.address));
            }
            S7WriteRequest request = S7WriteRequestFactory.buildRequest(next(), blocks, values);
            ByteBuffer response = exchange(data(request.length(), b -> new S7WriteRequestWriter().write(request, b)),
                request.getHeader().getSequence(), 3);
            List<WriteResult> results = new S7WriteResponseReader().read(response).getData().getWriteResults();
            require(results.size() == blocks.size(), "write item count: expected " + blocks.size() + ", received " + results.size());
            for (WriteResult result : results) require(result.getErrorCode() == (byte) 0xff, "write item failed");
        }
        void roundTrip(Item item, Object expected, String expectedHex) throws Exception {
            write(Collections.singletonList(item));
            List<ReadResult> results = read(Collections.singletonList(readBlock(item)));
            require(hex(results.get(0).getData()).equals(expectedHex), "wire readback: " + hex(results.get(0).getData()));
            require(item.readValue != null && item.readValue.getStatusCode().isGood(), "bad item quality");
            Object actual = item.readValue.getValue().getValue();
            require(String.valueOf(actual).equals(String.valueOf(expected)), "expected " + expected + ", got " + actual);
        }

        // The vendor error reader consumes three bytes for a four-byte error item.
        // This bounded adapter inspects those responses without changing vendor code.
        List<WireResult> inspect(List<ReadAddressBlock> blocks, int type, int count, int bitAddress) throws Exception {
            S7ReadRequest request = S7ReadRequestFactory.buildRequest(next(), blocks);
            ByteBuffer body = ByteBuffer.allocate(request.length());
            new S7ReadRequestWriter().write(request, body);
            if (type >= 0) {
                body.put(15, (byte)type).putShort(16, (short)count);
                body.put(21, (byte)(bitAddress >>> 16)).put(22, (byte)(bitAddress >>> 8)).put(23, (byte)bitAddress);
            }
            ByteBuffer response = exchange(data(body.capacity(), b -> b.put(body.array())), request.getHeader().getSequence(), 3).slice().order(ByteOrder.BIG_ENDIAN);
            require(response.remaining() >= 14 && response.getShort(10) == 0, "read job failed");
            int parameters = response.getShort(6) & 65535;
            int dataLength = response.getShort(8) & 65535;
            require(parameters == 2 && response.get(12) == 4 && (response.get(13) & 255) == blocks.size(), "read response parameters");
            require(response.limit() == 12 + parameters + dataLength, "read response length");
            response.position(14);
            List<WireResult> results = new ArrayList<>();
            for (int i = 0; i < blocks.size(); i++) {
                require(response.remaining() >= 4, "short item");
                int code = response.get() & 255, transport = response.get() & 255, length = response.getShort() & 65535;
                int bytes = (transport == 3 || transport == 4 || transport == 5) ? (length + 7) / 8 : length;
                require(bytes <= response.remaining(), "item beyond response");
                byte[] value = new byte[bytes]; response.get(value);
                if (code != 255) require(transport == 0 && length == 0, "error item contains data");
                results.add(new WireResult(code, transport, length, value));
                if (bytes % 2 == 1 && i + 1 < blocks.size()) require(response.get() == 0, "nonzero padding");
            }
            require(!response.hasRemaining(), "trailing response bytes");
            return results;
        }

        // Separate classic alarm adapter: the supplied Ignition JAR has no corresponding service.
        Alarm userdata(int subfunction, byte[] payload) throws Exception {
            short reference = next();
            ByteBuffer body = ByteBuffer.allocate(22 + payload.length).order(ByteOrder.BIG_ENDIAN);
            S7Header header = new S7Header((byte) 7, reference, (short) 8, (short) (4 + payload.length));
            new S7HeaderWriter().write(header, body);
            body.put(new byte[]{0,1,0x12,4,0x11,0x44,(byte)subfunction,7});
            body.put((byte)0xff).put((byte)9).putShort((short)payload.length).put(payload);
            ByteBuffer reply = exchange(data(body.position(), b -> b.put(body.array())), reference, 7);
            byte[] s7 = new byte[reply.remaining()];
            reply.get(s7);
            Alarm result = Alarm.decodeS7(s7);
            require(result.group == 0x84 && result.subfunction == subfunction && result.error == 0, "alarm service error " + result.error);
            return result;
        }
        void subscribe(boolean enabled) throws Exception {
            ByteBuffer payload = ByteBuffer.allocate(12);
            payload.put((byte)0x80).put((byte)0).put("IGNTEST ".getBytes(StandardCharsets.US_ASCII));
            payload.put((byte)(enabled ? 5 : 4)).put((byte)0);
            Alarm result = userdata(2, payload.array());
            require(Arrays.equals(result.payload, new byte[]{0,0,(byte)(enabled ? 5 : 4),0,0}), "subscription response");
        }
        Alarm notification(int subfunction, int id, int signals) throws Exception {
            Alarm alarm = notifications.pollFirst();
            if (alarm == null) alarm = Alarm.decode(receive());
            require(alarm.group == 4 && alarm.subfunction == subfunction, "unexpected indication kind");
            require(alarm.payload.length == (subfunction == 5 ? 22 : 20), "indication size");
            require(ByteBuffer.wrap(alarm.payload).getInt(14) == id, "wrong alarm ID");
            if (subfunction == 5) require((alarm.payload[18] & 255) == signals, "wrong alarm state");
            return alarm;
        }
        void acknowledge(int id, int going, int coming) throws Exception {
            ByteBuffer payload = ByteBuffer.allocate(12);
            payload.put(new byte[]{0,1,0x12,8,0x19,0}).putInt(id).put((byte)going).put((byte)coming);
            require(Arrays.equals(userdata(0x0b, payload.array()).payload, new byte[]{0,1,(byte)0xff}), "alarm acknowledgement rejected");
        }
        byte[] query(int id) throws Exception {
            ByteBuffer payload = ByteBuffer.allocate(12);
            payload.put(new byte[]{0,1,0x12,8,0x1a,0,3,0}).putInt(id);
            return userdata(0x13, payload.array()).payload;
        }
        public void close() throws IOException { socket.close(); }
    }

    private static final class WireResult {
        final int code, transport, length;
        final byte[] data;
        WireResult(int code, int transport, int length, byte[] data) {
            this.code = code; this.transport = transport; this.length = length; this.data = data;
        }
    }
    private static void load(int port) throws Exception {
        final int clients = 16, iterations = 10000;
        ExecutorService pool = Executors.newFixedThreadPool(clients);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> tasks = new ArrayList<>();
        long began = System.nanoTime();
        try {
            for (int index = 0; index < clients; index++) {
                final int owner = index;
                tasks.add(pool.submit(() -> {
                    try {
                        start.await();
                        for (int batch = 0; batch < 10; batch++) {
                            try (Session session = new Session(port, owner % 2 == 0 ? 240 : 480, false)) {
                                for (int cycle = 0; cycle < iterations / 10; cycle++) {
                                    int value = owner * 100000 + batch * 100 + cycle;
                                    Item db = new Item(new S7Address(S7Area.DATA_BLOCKS, 100 + owner, S7DataType.DINT, 0), value);
                                    Item area = new Item(new S7Address(S7Area.FLAGS, 0, S7DataType.DINT, 1024 + owner * 4), ~value);
                                    boolean bitValue = (cycle & 1) != 0;
                                    Item bit = new Item(new S7Address(S7Area.FLAGS, 0, S7DataType.BIT, 2048 + owner / 8, owner % 8), bitValue);
                                    session.write(Arrays.asList(db, area, bit));
                                    session.read(Arrays.asList(readBlock(db), readBlock(area), readBlock(bit)));
                                    require(Boolean.valueOf(bitValue).equals(bit.readValue.getValue().getValue()), "shared-byte bit update lost");
                                    require(((Number)db.readValue.getValue().getValue()).intValue() == value, "load DB corruption");
                                    require(((Number)area.readValue.getValue().getValue()).intValue() == ~value, "load area corruption");
                                }
                            }
                        }
                    } catch (Exception error) { throw new RuntimeException(error); }
                }));
            }
            start.countDown();
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(90);
            for (Future<?> task : tasks) task.get(Math.max(1, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
            try (Session observer = new Session(port, 240, false)) {
                for (int offset = 2048; offset < 2050; offset++) {
                    Item bits = new Item(new S7Address(S7Area.FLAGS, 0, S7DataType.BYTE, offset), null);
                    require(hex(observer.read(Collections.singletonList(readBlock(bits))).get(0).getData()).equals("ff"), "shared byte lost neighboring bits");
                }
            }
            long milliseconds = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - began);
            System.out.println("LOAD clients=" + clients + " transactions=" + (clients * iterations * 2) +
                " items=" + (clients * iterations * 6) + " sessions=" + (clients * 10 + 1) + " reconnects=" + (clients * 9) + " elapsed_ms=" + milliseconds);
        } finally {
            start.countDown();
            pool.shutdownNow();
            require(pool.awaitTermination(5, TimeUnit.SECONDS), "load workers did not terminate");
        }
    }

    private static final class Alarm {
        int group, subfunction, error;
        byte[] payload;
        static Alarm decode(byte[] packet) {
            require(packet.length >= 33, "short alarm frame");
            require(packet[4] == 2 && packet[5] == (byte)0xf0 && packet[6] == (byte)0x80, "invalid COTP DT");
            return decodeS7(Arrays.copyOfRange(packet, 7, packet.length));
        }
        static Alarm decodeS7(byte[] bytes) {
            require(bytes.length >= 26 && bytes[0] == 0x32 && bytes[1] == 7, "invalid alarm S7 header");
            ByteBuffer buffer = ByteBuffer.wrap(bytes);
            int parameterLength = buffer.getShort(6) & 65535;
            int dataLength = buffer.getShort(8) & 65535;
            require(parameterLength == 12 && dataLength >= 4 && 10 + parameterLength + dataLength == bytes.length, "invalid alarm lengths");
            require(bytes[10] == 0 && bytes[11] == 1 && bytes[12] == 0x12 && bytes[13] == 8, "invalid alarm parameters");
            require(bytes[18] == 0 && bytes[19] == 0, "unexpected alarm continuation");
            Alarm result = new Alarm();
            result.group = bytes[15] & 255;
            result.subfunction = bytes[16] & 255;
            result.error = buffer.getShort(20) & 65535;
            require((buffer.getShort(24) & 65535) == dataLength - 4, "invalid alarm payload length");
            result.payload = Arrays.copyOfRange(bytes, 26, bytes.length);
            return result;
        }
    }

    public static void main(String[] args) throws Exception {
        require(args.length == 1, "Usage: DriverHarness port");
        int port = Integer.parseInt(args[0]);
        require(port > 0 && port <= 65535, "invalid port");
        Class<?>[] originals = { ProtocolStack.class, S7ReadRequestFactory.class, S7WriteRequestWriter.class,
            S7ReadResponseReader.class, ReadResponseHandler.class, S7Address.class };
        for (Class<?> original : originals) {
            String location = original.getProtectionDomain().getCodeSource().getLocation().toString();
            require(location.endsWith("driver-siemens-5.0.1.jar"), "codec was not loaded from supplied JAR: " + original);
            System.out.println("SOURCE\t" + original.getName() + "\t" + location);
        }
        System.out.println("CAPABILITY\tnative_ignition_alarm_service\tUNSUPPORTED\tNo alarm classes/services in driver-siemens-5.0.1.jar");
        try (Session session = new Session(port, 480)) {
            System.out.println("RESULT\tdriver_connect_and_pdu\tPASS\tPDU=" + session.pdu);
            test("driver_byte", () -> session.roundTrip(new Item(address(S7DataType.BYTE, 0), 127), 127, "7f"));
            test("driver_int16", () -> session.roundTrip(new Item(address(S7DataType.INT, 2), (short)-1234), -1234, "fb2e"));
            test("driver_dint32", () -> session.roundTrip(new Item(address(S7DataType.DINT, 4), -12345678), -12345678, "ff439eb2"));
            test("driver_real", () -> session.roundTrip(new Item(address(S7DataType.REAL, 8), 12.5f), 12.5f, "41480000"));
            test("driver_word", () -> session.roundTrip(new Item(address(S7DataType.WORD, 12), (short)0xbeef), 48879, "beef"));
            test("driver_dword_unsigned", () -> session.roundTrip(new Item(address(S7DataType.DWORD, 32), -1), 4294967295L, "ffffffff"));
            test("driver_string", () -> session.roundTrip(
                new Item(new S7Address(S7Area.DATA_BLOCKS, 1, S7DataType.STRING, 40, 8), "HELLO"),
                "HELLO", "080548454c4c4f000000"));
            test("driver_bit_write", () -> session.roundTrip(
                new Item(new S7Address(S7Area.DATA_BLOCKS, 1, S7DataType.BIT, 16, 7), true), true, "80"));
            test("driver_bit_preserves_neighbors", () -> {
                session.write(Collections.singletonList(new Item(address(S7DataType.BYTE, 17), 0x55)));
                S7Address bit = new S7Address(S7Area.DATA_BLOCKS, 1, S7DataType.BIT, 17, 7);
                session.roundTrip(new Item(bit, true), true, "d5");
                session.roundTrip(new Item(bit, false), false, "55");
            });
            test("driver_multi_write", () -> {
                Item first = new Item(address(S7DataType.BYTE, 20), 17);
                Item second = new Item(address(S7DataType.BYTE, 22), 34);
                session.write(Arrays.asList(first, second));
                List<ReadResult> results = session.read(Arrays.asList(readBlock(first), readBlock(second)));
                require(hex(results.get(0).getData()).equals("11") && hex(results.get(1).getData()).equals("22"), "multi-item readback");
            });
            test("driver_mixed_bit_byte_write", () -> {
                Item bit = new Item(new S7Address(S7Area.DATA_BLOCKS, 1, S7DataType.BIT, 18, 7), true);
                Item value = new Item(address(S7DataType.BYTE, 19), 0xab);
                session.write(Arrays.asList(bit, value));
                List<ReadResult> results = session.read(Arrays.asList(readBlock(bit), readBlock(value)));
                require(hex(results.get(0).getData()).equals("80") && hex(results.get(1).getData()).equals("ab"), "mixed bit/byte readback");
            });
            test("driver_cross_db_write_rejected", () -> {
                try {
                    session.write(Collections.singletonList(new Item(address(S7DataType.INT, 65535), (short)0x1234)));
                    throw new IllegalStateException("cross-DB write was accepted");
                } catch (AssertionError expected) {
                    require(expected.getMessage().equals("write item failed"), "unexpected write failure");
                }
                Item nextDb = new Item(new S7Address(S7Area.DATA_BLOCKS, 2, S7DataType.BYTE, 0), null);
                require(hex(session.read(Collections.singletonList(readBlock(nextDb))).get(0).getData()).equals("00"), "next DB was changed");
            });
            test("driver_odd_multi_read", () -> {
                Item first = new Item(address(S7DataType.BYTE, 0), null);
                Item second = new Item(address(S7DataType.INT, 2), null);
                List<ReadResult> results = session.read(Arrays.asList(readBlock(first), readBlock(second)));
                require(hex(results.get(0).getData()).equals("7f") && hex(results.get(1).getData()).equals("fb2e"), "odd padding");
            });
            test("driver_memory_areas", () -> {
                for (S7Area area : new S7Area[]{S7Area.INPUTS, S7Area.OUTPUTS, S7Area.FLAGS}) {
                    session.roundTrip(new Item(new S7Address(area, 0, S7DataType.DINT, 64), 0x12345678), 0x12345678, "12345678");
                    session.roundTrip(new Item(new S7Address(area, 0, S7DataType.BIT, 70, 3), true), true, "08");
                }
            });
            test("driver_cross_client_exchange", () -> {
                try (Session peer = new Session(port, 240)) {
                    for (S7Area area : new S7Area[]{S7Area.INPUTS, S7Area.OUTPUTS, S7Area.FLAGS, S7Area.DATA_BLOCKS}) {
                        Item value = new Item(new S7Address(area, area == S7Area.DATA_BLOCKS ? 5 : 0, S7DataType.DINT, 512), 0x12345678);
                        session.write(Collections.singletonList(value));
                        peer.read(Collections.singletonList(readBlock(value)));
                        require(((Number)value.readValue.getValue().getValue()).intValue() == 0x12345678, "peer missed producer update");
                        Item reply = new Item(value.address, -42);
                        peer.write(Collections.singletonList(reply));
                        session.read(Collections.singletonList(readBlock(reply)));
                        require(((Number)reply.readValue.getValue().getValue()).intValue() == -42, "producer missed peer update");
                    }
                }
            });
            test("driver_read_isolation_and_errors", () -> {
                ReadAddressBlock crossing = readBlock(new Item(address(S7DataType.INT, 65535), null));
                ReadAddressBlock missing = readBlock(new Item(new S7Address(S7Area.DATA_BLOCKS, 65000, S7DataType.BYTE, 0), null));
                ReadAddressBlock valid = readBlock(new Item(address(S7DataType.BYTE, 0), null));
                List<WireResult> results = session.inspect(Arrays.asList(crossing, missing, valid), -1, 0, 0);
                require(results.get(0).code == 5 && results.get(1).code == 10 && results.get(2).code == 255, "per-item errors");
                require(hex(results.get(2).data).equals("7f"), "healthy peer item lost");
                for (S7Area area : new S7Area[]{S7Area.INPUTS, S7Area.OUTPUTS, S7Area.FLAGS}) {
                    WireResult result = session.inspect(Collections.singletonList(readBlock(new Item(new S7Address(area, 0, S7DataType.INT, 65535), null))), -1, 0, 0).get(0);
                    require(result.code == 5, "cross-area read accepted");
                }
                session.roundTrip(new Item(address(S7DataType.BYTE, 65535), 90), 90, "5a");
            });
            test("driver_word_element_count", () -> {
                Item item = new Item(address(S7DataType.DINT, 96), 0x11223344);
                session.write(Collections.singletonList(item));
                ReadAddressBlock words = new ReadAddressBlock(new ArrayList<>(Collections.singletonList(item))) {
                    public AddressBlock.LengthUnit getLengthUnit() { return AddressBlock.LengthUnit.WORD; }
                    public int getLength() { return 2; }
                };
                require(hex(session.read(Collections.singletonList(words)).get(0).getData()).equals("11223344"), "WORD count not scaled");
            });
            test("typed_read_wire_adapter", () -> {
                session.write(Collections.singletonList(new Item(address(S7DataType.DINT, 100), 0x11223344)));
                List<ReadAddressBlock> block = Collections.singletonList(readBlock(new Item(address(S7DataType.BYTE, 100), null)));
                for (int type : new int[]{4,5,6,7,8}) {
                    WireResult result = session.inspect(block, type, type <= 5 ? 2 : 1, 800).get(0);
                    int transport = type == 5 ? 5 : type == 7 ? 6 : type == 8 ? 7 : 4;
                    require(result.code == 255 && result.transport == transport && result.length == (transport <= 5 ? 32 : 4), "typed result metadata");
                    require(hex(result.data).equals("11223344"), "typed result data");
                }
                session.write(Arrays.asList(new Item(address(S7DataType.BYTE, 110), 0x80), new Item(address(S7DataType.BYTE, 111), 0x55)));
                WireResult bits = session.inspect(block, 1, 9, 110 * 8 + 7).get(0);
                require(bits.code == 255 && bits.transport == 3 && bits.length == 9 && hex(bits.data).equals("ab00"), "packed BIT result");
                require(session.inspect(block, 2, 1, 801).get(0).code == 5, "unaligned byte accepted");
                require(session.inspect(block, 255, 1, 800).get(0).code == 6, "unknown type accepted");
            });
            test("alarm_adapter_subscribe_raise_ack_clear_query", () -> {
                session.subscribe(true);
                controlSet(2001, 1);
                session.read(Collections.singletonList(readBlock(new Item(address(S7DataType.BYTE, 0), null))));
                session.notification(5, 2001, 1);
                session.acknowledge(2001, 0, 1);
                session.notification(0x0c, 2001, 0);
                controlSet(2001, 0);
                session.notification(5, 2001, 0);
                session.acknowledge(2001, 1, 0);
                session.notification(0x0c, 2001, 0);
                require(hex(session.query(2001)).equals("00010a000000"), "cleared alarm remains outstanding");
                session.subscribe(false);
                controlSet(2001, 1);
                socketQuiet(session.socket);
            });
        }
        try (Session session = new Session(port, 240)) {
            test("driver_pdu_boundaries", () -> {
                List<ReadAddressBlock> maximum = new ArrayList<>();
                for (int i = 0; i < 19; i++) maximum.add(readBlock(new Item(address(S7DataType.BYTE, 0), null)));
                require(session.read(maximum).size() == 19, "maximum request batch failed");
                maximum.add(readBlock(new Item(address(S7DataType.BYTE, 0), null)));
                S7ReadRequest oversized = S7ReadRequestFactory.buildRequest(session.next(), maximum);
                ByteBuffer rejected = session.exchange(data(oversized.length(), b -> new S7ReadRequestWriter().write(oversized, b)),
                    oversized.getHeader().getSequence(), 3).slice();
                require((rejected.getShort(10) & 65535) == 0x8104, "oversized request was not rejected");
                List<ReadAddressBlock> block = Collections.singletonList(readBlock(new Item(address(S7DataType.BYTE, 0), null)));
                WireResult exact = session.inspect(block, 2, 222, 0).get(0);
                require(exact.code == 255 && exact.data.length == 222, "exact PDU capacity");
                require(session.inspect(block, 2, 223, 0).get(0).code == 7, "oversize read accepted");
                List<ReadAddressBlock> mixed = Arrays.asList(block.get(0), block.get(0));
                List<WireResult> results = session.inspect(mixed, 2, 223, 0);
                require(results.get(0).code == 7 && results.get(1).code == 255, "oversize item lost valid result");
            });
            test("driver_small_pdu_reconnect", () ->
                session.roundTrip(new Item(address(S7DataType.BYTE, 30), 66), 66, "42"));
        }
        test("driver_concurrent_load", () -> load(port));
        System.out.println("SUMMARY\t" + failures);
        if (failures != 0) System.exit(1);
    }
    private static void socketQuiet(Socket socket) throws IOException {
        socket.setSoTimeout(150);
        try { require(socket.getInputStream().read() < 0, "notification after unsubscribe"); }
        catch (SocketTimeoutException expected) { return; }
        finally { socket.setSoTimeout(2000); }
        throw new IOException("connection closed after unsubscribe");
    }
}
