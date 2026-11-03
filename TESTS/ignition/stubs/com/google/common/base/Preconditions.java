package com.google.common.base;
public final class Preconditions {
    private Preconditions() {}
    public static <T> T checkNotNull(T value) { return java.util.Objects.requireNonNull(value); }
}
