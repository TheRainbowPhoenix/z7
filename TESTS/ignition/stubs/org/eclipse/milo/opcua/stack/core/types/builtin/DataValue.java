package org.eclipse.milo.opcua.stack.core.types.builtin;
public final class DataValue {
    private final Variant value;
    private final StatusCode status;
    public DataValue(Variant value) { this.value = value; this.status = StatusCode.GOOD; }
    public DataValue(StatusCode status) { this.value = null; this.status = status; }
    public DataValue(long status) { this(new StatusCode(status)); }
    public Variant getValue() { return value; }
    public StatusCode getStatusCode() { return status; }
}
