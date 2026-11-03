package com.inductiveautomation.xopc.driver.util;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import org.eclipse.milo.opcua.stack.core.BuiltinDataType;
import org.eclipse.milo.opcua.stack.core.types.builtin.DataValue;
import org.eclipse.milo.opcua.stack.core.types.builtin.Variant;
/** Generic platform value adapter only. S7 packet encoders/decoders stay in the vendor JAR. */
public final class UAByteUtilities {
    public static byte[] fromVariant(Variant variant, ByteOrder order) {
        Object value = variant.getValue();
        ByteBuffer buffer = ByteBuffer.allocate(8).order(order);
        if (value instanceof Short) buffer.putShort((Short) value);
        else if (value instanceof Integer) buffer.putInt((Integer) value);
        else if (value instanceof Float) buffer.putFloat((Float) value);
        else if (value instanceof Long) buffer.putLong((Long) value);
        else if (value instanceof Double) buffer.putDouble((Double) value);
        else throw new IllegalArgumentException("Unsupported platform value " + value);
        return java.util.Arrays.copyOf(buffer.array(), buffer.position());
    }
    public static DataValue getDataValue(byte[] bytes, int offset, ByteOrder order, BuiltinDataType type) {
        ByteBuffer buffer = ByteBuffer.wrap(bytes).order(order);
        buffer.position(offset);
        Object value;
        switch (type) {
            case Byte: value = buffer.get() & 255; break;
            case SByte: value = buffer.get(); break;
            case Int16: value = buffer.getShort(); break;
            case UInt16: value = buffer.getShort() & 65535; break;
            case Int32: value = buffer.getInt(); break;
            case UInt32: value = buffer.getInt() & 0xffffffffL; break;
            case Float: value = buffer.getFloat(); break;
            default: throw new IllegalArgumentException("Unsupported platform type " + type);
        }
        return new DataValue(new Variant(value));
    }
    public static DataValue getDataValueForBit(byte[] bytes, int offset, ByteOrder order, BuiltinDataType type, int bit) {
        if (bit < 0 || bit > 7) throw new IllegalArgumentException("Invalid bit");
        return new DataValue(new Variant((bytes[offset] & (1 << bit)) != 0));
    }
}
