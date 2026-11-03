package com.inductiveautomation.xopc.driver.api.items;
import org.eclipse.milo.opcua.stack.core.types.builtin.DataValue;
public interface ReadItem extends DriverItem { void setValue(DataValue value); }
