package com.inductiveautomation.xopc.driver.util;
import java.nio.ByteOrder;
public final class ByteUtilities {
    public static ByteUtilities get(ByteOrder order) { return new ByteUtilities(); }
    public byte getByte(byte[] bytes, int offset) { return bytes[offset]; }
    public static String toString(byte[] bytes) {
        StringBuilder text = new StringBuilder();
        for (byte value : bytes) text.append(String.format("%02x", value & 255));
        return text.toString();
    }
}
