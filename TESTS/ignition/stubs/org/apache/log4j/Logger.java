package org.apache.log4j;
public final class Logger {
    public static Logger getLogger(Class<?> type) { return new Logger(); }
    public void debug(Object message) {}
    public void debug(Object message, Throwable error) {}
    public void warn(Object message) { System.err.println(message); }
    public void error(Object message) { System.err.println(message); }
    public void error(Object message, Throwable error) { System.err.println(message); error.printStackTrace(); }
    public boolean isTraceEnabled() { return false; }
    public void trace(Object message) {}
}
