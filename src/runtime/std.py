from .types import Int, DInt, Real, LReal, String, Time

# Mock functions for standard SCL
def CONCAT_STRING(s1, s2):
    return String(str(s1) + str(s2))

def REAL_TO_DINT(r):
    try:
        return DInt(int(r))
    except:
        return DInt(0)

def INT_TO_REAL(i):
    return Real(float(i))

def ABS(v):
    return abs(v)

# Time functions
def TIME_TO_DINT(t):
    return DInt(int(t))

def DINT_TO_TIME(d):
    return Time(int(d))

# Usually in PLC code, casts are explicit or implicit.
# SCL: REAL_TO_DINT(r)

# Additional helpers
def NOT(v):
    return not v

def AND(*args):
    return all(args)

def OR(*args):
    return any(args)

def XOR(a, b):
    return bool(a) != bool(b)
