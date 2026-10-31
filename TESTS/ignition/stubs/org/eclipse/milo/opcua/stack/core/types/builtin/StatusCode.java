package org.eclipse.milo.opcua.stack.core.types.builtin;
public final class StatusCode {
    public static final StatusCode GOOD = new StatusCode(0);
    public static final StatusCode BAD = new StatusCode(0x80000000L);
    private final long value;
    public StatusCode(long value) { this.value = value; }
    public long getValue() { return value; }
    public boolean isGood() { return (value & 0x80000000L) == 0; }
}
