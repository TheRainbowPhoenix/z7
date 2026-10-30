package org.eclipse.milo.opcua.stack.core.types.builtin;
public final class Variant {
    private final Object value;
    public Variant(Object value) { this.value = value; }
    public Object getValue() { return value; }
}
