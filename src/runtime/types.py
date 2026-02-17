class DotDict(dict):
    """
    A dictionary that allows dot notation access to its members.
    """
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            # mock = RecursiveMock()
            # self[name] = mock
            # return mock
            # Better: return RecursiveMock but don't set it?
            # Or set it to keep state?
            # State is important.
            mock = RecursiveMock()
            self[name] = mock
            return mock

    def __setattr__(self, name, value):
        self[name] = value

class RecursiveMock:
    """
    A mock object that returns itself for any attribute access or call.
    """
    def __getattr__(self, name):
        return self

    def __call__(self, *args, **kwargs):
        return self

    def __bool__(self):
        return False

    def __add__(self, other): return self
    def __sub__(self, other): return self
    def __mul__(self, other): return self
    def __truediv__(self, other): return self
    def __floordiv__(self, other): return self
    def __mod__(self, other): return self
    def __pow__(self, other): return self
    def __lshift__(self, other): return self
    def __rshift__(self, other): return self
    def __and__(self, other): return self
    def __xor__(self, other): return self
    def __or__(self, other): return self

    def __lt__(self, other): return False
    def __le__(self, other): False
    def __eq__(self, other): False
    def __ne__(self, other): True
    def __gt__(self, other): False
    def __ge__(self, other): False
    def __repr__(self): return "RecursiveMock()"

class BaseBlock:
    def __getattr__(self, name):
        # Allow access to undefined globals as Mocks
        # print(f"Warning: Accessing undefined variable '{name}' in {self.__class__.__name__}")
        mock = RecursiveMock()
        setattr(self, name, mock)
        return mock

# Basic Types
class Bool(int): pass
class Int(int): pass
class DInt(int): pass
class Real(float): pass
class LReal(float): pass
class String(str): pass
class Time(int): pass
