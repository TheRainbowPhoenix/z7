package com.inductiveautomation.xopc.driver.api.items;
import org.eclipse.milo.opcua.stack.core.types.builtin.Variant;
import org.eclipse.milo.opcua.stack.core.types.builtin.StatusCode;
public interface WriteItem extends DriverItem {
    Variant getWriteValue();
    void setWriteStatus(StatusCode status);
}
