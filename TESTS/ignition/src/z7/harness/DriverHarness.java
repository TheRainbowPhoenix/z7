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
        short sequence = 1;
        final int pdu;

        Session(int port, int requestedPdu) throws Exception {
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
            System.out.println("WIRE\tTX\t" + hex(bytes));
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
            System.out.println("WIRE\tRX\t" + hex(packet));
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
            test("driver_small_pdu_reconnect", () ->
                session.roundTrip(new Item(address(S7DataType.BYTE, 30), 66), 66, "42"));
        }
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
