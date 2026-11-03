package com.inductiveautomation.ignition.common.util;
public final class SoftReferenceBag<T> {
    private final java.util.ArrayDeque<T> values = new java.util.ArrayDeque<>();
    public T take() { return values.pollFirst(); }
    public void put(T value) { if (values.size() < 64) values.addFirst(value); }
}
