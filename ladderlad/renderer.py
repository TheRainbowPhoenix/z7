from typing import List, Any, Optional, Dict
import abc

class SchematicRenderer(abc.ABC):
    @abc.abstractmethod
    def render(self, instructions: List[List[Any]], trace: Optional[Dict[int, bool]] = None) -> Any:
        pass

class Canvas:
    def __init__(self):
        self.row = 0
        self.col = 0
        self.lines = [""]
        self.colors = [[]]

    def left(self):
        if self.col <= 0: raise ValueError("Canvas error")
        self.col -= 1

    def right(self):
        self.col += 1
        if self.col == len(self.lines[0]): self._extend_lines()

    def up(self):
        if self.row <= 0: raise ValueError("Canvas error")
        self.row -= 1

    def down(self):
        self.row += 1
        if self.row == len(self.lines): self._add_line()

    def _add_line(self):
        width = len(self.lines[0]) if self.lines else 1
        self.lines.append(" " * width)
        self.colors.append([None] * width)

    def _extend_lines(self):
        for i in range(len(self.lines)):
            self.lines[i] += " "
            self.colors[i].append(None)

    def draw(self, text: str, color: Optional[str] = None):
        while len(self.lines[self.row]) < self.col + len(text):
            self._extend_lines()
        line_chars = list(self.lines[self.row])
        line_colors = self.colors[self.row]
        for i, char in enumerate(text):
            line_chars[self.col + i] = char
            line_colors[self.col + i] = color
        self.lines[self.row] = "".join(line_chars)
        self.col += len(text) - 1

    def get_marker(self):
        return [self.row, self.col]

    def set_marker(self, marker):
        self.row, self.col = marker

    def draw_fill(self, char: str, color: Optional[str] = None):
        length = len(self.lines[self.row]) - self.col
        if length > 0:
            line_chars = list(self.lines[self.row])
            line_colors = self.colors[self.row]
            for i in range(length):
                line_chars[self.col + i] = char
                line_colors[self.col + i] = color
            self.lines[self.row] = "".join(line_chars)
            self.col = len(self.lines[self.row]) - 1

    def bottom(self):
        self.row = len(self.lines) - 1

    def end(self):
        self.col = len(self.lines[self.row]) - 1

    def replace_up(self, marker, replacements: dict, color: Optional[str] = None):
        while self.row > marker[0]:
            start = self.get_marker()
            current_char = self.lines[self.row][self.col]
            if current_char in replacements:
                line_chars = list(self.lines[self.row])
                line_colors = self.colors[self.row]
                line_chars[self.col] = replacements[current_char]
                line_colors[self.col] = color
                self.lines[self.row] = "".join(line_chars)
            self.set_marker(start)
            self.up()

    def crlf(self):
        self.col = 0
        self.down()

    def clear(self):
        self.row = 0
        self.col = 0
        self.lines = [""]
        self.colors = [[None]]

    def get_lines_colored(self):
        if not self.lines: return []
        result = []
        indices = [len(self.lines)-1] + list(range(len(self.lines)-1))
        for idx in indices:
            result.append((self.lines[idx], self.colors[idx]))
        return result

class TreeVisitor:
    def __init__(self, parent, trace):
        self.parent = parent
        self.stack = []
        self.trace = trace

    def process(self, instructions):
        for i, instr in enumerate(instructions):
            state = self.trace.get(i, False) if self.trace else False
            op = instr[0]
            if op == "not":
                if self.stack:
                    item = self.stack.pop()
                    self.stack.append(["not", item, state])
            elif op == "or":
                if len(self.stack) >= 2:
                    a = self.stack.pop()
                    b = self.stack.pop()
                    self.stack.append(["or", b, a, state])
            elif op == "and":
                if len(self.stack) >= 2:
                    a = self.stack.pop()
                    b = self.stack.pop()
                    self.stack.append(["and", b, a, state])
            elif op == "in":
                self.stack.append(["in", instr[1], state])
            elif op == "out":
                val = self.stack.pop() if self.stack else None
                self.parent.visit(["out", instr[1], val, state])

class TextRenderer(SchematicRenderer):
    def __init__(self):
        self.canvas = Canvas()
        self.GREEN = "\033[92m"
        self.RED = "\033[91m"
        self.RESET = "\033[0m"

    def visit(self, node):
        op = node[0]
        state = node[-1] if isinstance(node[-1], bool) else False
        color = self.GREEN if state else self.RED

        if op == "or": self.or_op(node[1], node[2], color)
        elif op == "and": self.and_op(node[1], node[2], color)
        elif op == "in": self.in_op(node[1], color)
        elif op == "out": self.out_op(node[1], node[2], color)
        elif op == "not":
            inner = node[1]
            if inner[0] == "in":
                self.in_op(inner[1], color, negated=True)
            else:
                self.visit(inner)

    def or_recursive(self, a, b, parent_color):
        state_a = a[-1] if isinstance(a[-1], bool) else False
        state_b = b[-1] if isinstance(b[-1], bool) else False
        color_a = self.GREEN if state_a else self.RED

        if a[0] == "or":
            self.or_recursive(a[1], a[2], color_a)
        else:
            top_left = self.canvas.get_marker()
            self.canvas.draw("+", parent_color)
            self.canvas.right()
            self.visit(a)
            self.canvas.set_marker(top_left)

        self.canvas.down()
        self.canvas.draw("| ", parent_color)
        self.canvas.left()
        self.canvas.down()

        bottom_left = self.canvas.get_marker()
        self.canvas.draw("+", parent_color)
        self.canvas.right()
        self.visit(b)
        self.canvas.draw_fill("-", parent_color)
        self.canvas.set_marker(bottom_left)

    def or_op(self, a, b, color):
        self.canvas.draw("--", color)
        self.canvas.right()
        top_left = self.canvas.get_marker()
        self.or_recursive(a, b, color)
        self.canvas.end()
        self.canvas.replace_up(top_left, {" ": "| ", "-": "+ "}, color)
        self.canvas.draw("+--", color)
        self.canvas.right()

    def and_op(self, a, b, color):
        self.visit(a)
        self.visit(b)

    def in_op(self, name, color, negated=False):
        # Match ladder_logic.py spacing
        sym = f"--[/{name}]--" if negated else f"--[{name}]--"
        self.canvas.draw(sym, color)
        self.canvas.right()

    def out_op(self, name, value, color):
        marker = self.canvas.get_marker()
        self.canvas.draw_fill("-", color)
        self.canvas.set_marker(marker)
        if value:
            self.visit(value)

        state_val = value[-1] if value and isinstance(value[-1], bool) else False
        coil_color = self.GREEN if state_val else self.RED

        self.canvas.draw(f"--({name})--", coil_color)
        self.canvas.bottom()
        self.canvas.down()
        self.canvas.crlf()

    def render(self, instructions: List[List[Any]], trace: Optional[Dict[int, bool]] = None) -> str:
        self.canvas.clear()
        tree_visitor = TreeVisitor(self, trace)
        tree_visitor.process(instructions)
        lines_colored = self.canvas.get_lines_colored()
        output = []
        output.append("||")
        for text, colors in lines_colored:
            line_str = "||"
            for char, col_code in zip(text, colors):
                if col_code and trace:
                    line_str += f"{col_code}{char}{self.RESET}"
                else:
                    line_str += char
            line_str += "||"
            output.append(line_str)
        output.append("||")
        return "\n".join(output)

    def render_il(self, instructions: List[List[Any]], trace: Optional[Dict[int, bool]] = None) -> str:
        # Render instruction list (Assembly like)
        lines = []
        for i, instr in enumerate(instructions):
            state = trace.get(i, False) if trace else False
            color = self.GREEN if state else self.RED
            op = instr[0].upper()
            args = " ".join(str(a) for a in instr[1:])

            line_str = f"{i:03d}: {op:<4} {args}"
            if trace:
                line_str = f"{color}{line_str}{self.RESET}"
            lines.append(line_str)
        return "\n".join(lines)
