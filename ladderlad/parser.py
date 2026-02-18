from typing import List, Any, Optional
import abc

class SchematicParser(abc.ABC):
    @abc.abstractmethod
    def parse(self, source: Any) -> List[List[Any]]:
        """Returns a list of instructions from the source."""
        pass

class TextParser(SchematicParser):
    def parse(self, schematic: str) -> List[List[Any]]:
        self.instructions = []
        rungs = self._preprocess(schematic)
        for rung in rungs:
            self._scan(rung, 0, 0, 0)
        return self.instructions

    def _preprocess(self, schematic: str):
        rungs, rung = [], []
        lines = schematic.strip().split("\n")
        for line in lines:
            line = line.strip()
            if line.startswith("||") and line.endswith("||"):
                content = line[2:-2]
                if content.startswith("-"):
                    if rung: rungs.append(rung)
                    rung = [content]
                else:
                    rung.append(content)
        if rung: rungs.append(rung)
        return rungs

    def _scan(self, rung, row, col, count):
        if row >= len(rung): return # Safety check
        line = rung[row]
        while col < len(line) and line[col] == "-":
            col += 1

        if col == len(line): return

        char = line[col]
        if char == "[":
            self._scan_in(rung, row, col + 1, count)
        elif char == "(":
            self._scan_out(rung, row, col + 1, count)
        elif char == "{":
            self._scan_system(rung, row, col + 1, count)
        elif char == "+":
            self._scan_or(rung, row, col, count)
        elif char == " ":
            pass
        else:
            # End of line or unrecognized
            pass

    def _scan_in(self, rung, row, col, count):
        is_not = rung[row][col] == "/"
        start = col + 1 if is_not else col
        end = rung[row].find("]", start)
        name = rung[row][start:end]
        self.instructions.append(["in", name])
        if is_not: self.instructions.append(["not"])
        self._scan_and(rung, row, end + 1, count + 1)

    def _scan_out(self, rung, row, col, count):
        is_not = rung[row][col] == "/"
        start = col + 1 if is_not else col
        end = rung[row].find(")", start)
        name = rung[row][start:end]
        if is_not: self.instructions.append(["not"])
        self.instructions.append(["out", name])
        self._scan(rung, row, end + 1, count)

    def _scan_system(self, rung, row, col, count):
        end = rung[row].find("}", col)
        name = rung[row][col:end]
        self.instructions.append(name.split(" "))
        self._scan_and(rung, row, end + 1, count + 1)

    def _scan_or(self, rung, row, col, count):
        end = rung[row].find("+", col + 1)
        self._scan_or_block(rung, row, col, end, 0)
        self._scan_and(rung, row, end + 1, count + 1)

    def _scan_or_block(self, rung, row, col, end, count):
        if row >= len(rung): return

        if rung[row][col] == "+":
            line = rung[row][col+1:end]
            sub_instr = []
            temp_instr = self.instructions
            self.instructions = sub_instr
            self._scan([line], 0, 0, 0)
            self.instructions = temp_instr
            self.instructions.extend(sub_instr)
            if count > 0: self.instructions.append(["or"])
            self._scan_or_block(rung, row + 1, col, end, count + 1)
        elif rung[row][col] == "|":
            self._scan_or_block(rung, row + 1, col, end, count)

    def _scan_and(self, rung, row, col, count):
        if count > 1: self.instructions.append(["and"])
        self._scan(rung, row, col, count)
