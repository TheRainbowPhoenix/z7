package com.inductiveautomation.ignition.common;
public final class TypeUtilities {
    private TypeUtilities() {}
    public static String toString(Object value) { return String.valueOf(value); }
    public static Boolean toBool(Object value) {
        if (value instanceof Boolean) return (Boolean) value;
        if (value instanceof Number) return ((Number) value).longValue() != 0;
        throw new IllegalArgumentException("Unsupported Boolean conversion");
    }
    public static Object coerce(Object value, Class<?> type) {
        if (type.isInstance(value)) return value;
        if (!(value instanceof Number)) throw new IllegalArgumentException("Unsupported conversion");
        Number number = (Number) value;
        if (type == Byte.class) return number.byteValue();
        if (type == Short.class) return number.shortValue();
        if (type == Integer.class) return number.intValue();
        if (type == Long.class) return number.longValue();
        throw new IllegalArgumentException("Unsupported conversion: " + type);
    }
}
