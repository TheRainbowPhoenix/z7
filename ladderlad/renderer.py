from typing import List, Any, Optional
import abc

class SchematicRenderer(abc.ABC):
    @abc.abstractmethod
    def render(self, instructions: List[List[Any]]) -> Any:
        """Converts instructions back to a visual representation."""
        pass

class Canvas:
    def __init__(self):
        self.row = 0
        self.col = 0
        self.lines = [""]

    def left(self):
        if self.col <= 0:
            raise ValueError("Canvas boundary error: Left")
        self.col -= 1

    def right(self):
        self.col += 1
        if self.col == len(self.lines[0]):
            for i in range(len(self.lines)):
                self.lines[i] += self.lines[i][-1] if self.lines[i] else " "

    def up(self):
        if self.row <= 0:
            raise ValueError("Canvas boundary error: Up")
        self.row -= 1

    def down(self):
        self.row += 1
        if self.row == len(self.lines):
            self.lines.append(" " * (len(self.lines[0]) if self.lines[0] else 1))

    def draw(self, text: str):
        row_str = list(self.lines[self.row])
        while len(row_str) <= self.col:
            row_str.append(" ")

        row_str[self.col] = text[0]
        self.lines[self.row] = "".join(row_str)

        for char in text[1:]:
            self.right()
            row_str = list(self.lines[self.row])
            while len(row_str) <= self.col:
                row_str.append(" ")
            row_str[self.col] = char
            self.lines[self.row] = "".join(row_str)

    def get_marker(self):
        return [self.row, self.col]

    def set_marker(self, marker):
        self.row, self.col = marker

    def fill(self, char: str):
        length = len(self.lines[self.row]) - self.col
        text = char * length
        row_str = list(self.lines[self.row])
        row_str[self.col:] = list(text)
        self.lines[self.row] = "".join(row_str)
        self.col = len(self.lines[self.row]) - 1

    def bottom(self):
        self.row = len(self.lines) - 1

    def end(self):
        self.col = len(self.lines[self.row]) - 1

    def replace_up(self, marker, replacements: dict):
        while self.row > marker[0]:
            start = self.get_marker()
            current_char = self.lines[self.row][self.col]
            if current_char in replacements:
                self.draw(replacements[current_char])
            self.set_marker(start)
            self.up()

    def crlf(self):
        self.col = 0
        self.down()

    def clear(self):
        self.row = 0
        self.col = 0
        self.lines = [""]

    def get_lines(self):
        if not self.lines: return []
        return [self.lines[-1]] + self.lines[:-1]

class NotVisitor:
    def __init__(self, parent):
        self.parent = parent
        self.pending = None

    def visit(self, instruction):
        if instruction[0] == "not" and self.pending and self.pending[0] == "in":
            self.parent.visit(["in", "/" + self.pending[1]])
            self.pending = None
        elif instruction[0] == "out" and self.pending:
            if self.pending[0] == "not":
                self.parent.visit(["out", "/" + instruction[1]])
                self.pending = None
            else:
                self.parent.visit(self.pending)
                self.parent.visit(instruction)
                self.pending = None
        else:
            if self.pending:
                self.parent.visit(self.pending)
            self.pending = instruction

class TreeVisitor:
    def __init__(self, parent):
        self.parent = parent
        self.stack = []

    def visit(self, instruction):
        op = instruction[0]
        args = instruction[1:]
        if op == "not": self.not_op()
        elif op == "or": self.or_op()
        elif op == "and": self.and_op()
        elif op == "in": self.in_op(*args)
        elif op == "out": self.out_op(*args)

    def not_op(self):
        if self.stack:
            self.stack.append(["not", self.stack.pop()])

    def or_op(self):
        if len(self.stack) >= 2:
            a = self.stack.pop()
            b = self.stack.pop()
            self.stack.append(["or", b, a])

    def and_op(self):
        if len(self.stack) >= 2:
            a = self.stack.pop()
            b = self.stack.pop()
            self.stack.append(["and", b, a])

    def in_op(self, name):
        self.stack.append(["in", name])

    def out_op(self, name):
        val = self.stack.pop() if self.stack else None
        self.parent.visit(["out", name, val])

class TextRenderer(SchematicRenderer):
    def __init__(self):
        self.canvas = Canvas()

    def visit(self, instruction):
        op = instruction[0]
        args = instruction[1:]
        if op == "or": self.or_op(*args)
        elif op == "and": self.and_op(*args)
        elif op == "in": self.in_op(*args)
        elif op == "out": self.out_op(*args)

    def or_recursive(self, a, b):
        if a[0] == "or":
            self.or_recursive(a[1], a[2])
        else:
            top_left = self.canvas.get_marker()
            self.canvas.draw("+")
            self.canvas.right()
            self.visit(a)
            self.canvas.set_marker(top_left)

        self.canvas.down()
        self.canvas.draw("| ")
        self.canvas.left()
        self.canvas.down()

        bottom_left = self.canvas.get_marker()
        self.canvas.draw("+")
        self.canvas.right()
        self.visit(b)
        self.canvas.fill("-")
        self.canvas.set_marker(bottom_left)

    def or_op(self, a, b):
        self.canvas.draw("--")
        self.canvas.right()
        top_left = self.canvas.get_marker()
        self.or_recursive(a, b)
        self.canvas.end()
        self.canvas.replace_up(top_left, {" ": "| ", "-": "+ "})
        self.canvas.draw("+--")
        self.canvas.right()

    def and_op(self, a, b):
        self.visit(a)
        self.visit(b)

    def in_op(self, name):
        self.canvas.draw(f"--[{name}]--")
        self.canvas.right()

    def out_op(self, name, value):
        marker = self.canvas.get_marker()
        self.canvas.fill("-")
        self.canvas.set_marker(marker)
        if value:
            self.visit(value)
        self.canvas.draw(f"--({name})--")
        self.canvas.bottom()
        self.canvas.down()
        self.canvas.crlf()

    def render(self, instructions: List[List[Any]]) -> str:
        self.canvas.clear()
        tree_visitor = TreeVisitor(self)
        not_visitor = NotVisitor(tree_visitor)

        for instr in instructions:
            not_visitor.visit(instr)
        if not_visitor.pending:
            not_visitor.parent.visit(not_visitor.pending)

        lines = self.canvas.get_lines()
        return "||" + "||\n||".join(lines) + "||"
