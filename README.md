# z7 - ZalW S7 PLC Server


```
# Build for Linux
zig build -Dtarget=x86_64-linux-musl

zig build run -- --port 10202

# Run on a non-privileged port
./z7 --port 10202
```
