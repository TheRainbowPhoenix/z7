import pygame
import time
import abc
from typing import List, Any, Dict, Optional

# ==========================================
# Siemens S7 STL & Ladder Visual Engine
# ==========================================

class PLCRegisters:
    def __init__(self):
        self.rlo: bool = False
        self.stack: List[bool] = []

    def push(self): self.stack.append(self.rlo)
    def pop(self) -> bool: return self.stack.pop() if self.stack else False

class STLEmulator:
    """Siemens STL Interpreter with Power-Flow tracking for UI."""
    def __init__(self, cpu: 'CPU'):
        self.cpu = cpu
        self.first_check = True
        self._ops = {
            'A': self._a, 'AN': self._an, 'O': self._o, 'ON': self._on,
            '(': self._push, ')': self._pop_and, '=': self._assign
        }

    def _a(self, tag):
        val = self.cpu.read_io(tag)
        if self.first_check: self.cpu.regs.rlo = val
        else: self.cpu.regs.rlo &= val
        self.first_check = False

    def _an(self, tag):
        val = not self.cpu.read_io(tag)
        if self.first_check: self.cpu.regs.rlo = val
        else: self.cpu.regs.rlo &= val
        self.first_check = False

    def _o(self, tag):
        val = self.cpu.read_io(tag)
        self.cpu.regs.rlo |= val
        self.first_check = False

    def _on(self, tag):
        val = not self.cpu.read_io(tag)
        self.cpu.regs.rlo |= val
        self.first_check = False

    def _push(self):
        self.cpu.regs.push()
        self.first_check = True

    def _pop_and(self):
        prev = self.cpu.regs.pop()
        self.cpu.regs.rlo &= prev
        self.first_check = False

    def _assign(self, tag):
        self.cpu.write_io(tag, self.cpu.regs.rlo)
        self.first_check = True

class CPU:
    def __init__(self, program):
        self.program = program
        self.regs = PLCRegisters()
        self.emu = STLEmulator(self)
        self.io_memory = {"START": False, "STOP": False, "ESTOP": False, "RUN": False, "MOTOR": False}
        # Keep track of RLO per instruction for UI highlighting
        self.instr_states = [False] * len(program)

    def read_io(self, name): return self.io_memory.get(name, False)
    def write_io(self, name, val): self.io_memory[name] = val

    def cycle(self):
        self.emu.first_check = True
        for i, instr in enumerate(self.program):
            op = instr[0]
            if op in self.emu._ops:
                self.emu._ops[op](*instr[1:])
            # Store the RLO state after this instruction for visualization
            self.instr_states[i] = self.regs.rlo

# ==========================================
# Decompiler for Console Output
# ==========================================

class ConsoleLadderDecompiler:
    """Simplified decompiler to show the ladder structure in the console."""
    @staticmethod
    def print_rebuilt_ladder(program):
        print("\n--- REBUILT LADDER (DECOMPILE/RECOMPILE TEST) ---")
        rung = "--"
        for instr in program:
            op = instr[0]
            if op == 'A': rung += f"-[{instr[1]}]--"
            elif op == 'AN': rung += f"-[/{instr[1]}]--"
            elif op == 'O': rung += f" (OR {instr[1]}) "
            elif op == '=': 
                rung += f"({instr[1]})--|"
                print(rung)
                rung = "--"
            elif op == '(': rung += "+-["
            elif op == ')': rung += "]-+--"
        print("--------------------------------------------------\n")

# ==========================================
# UI & Ladder Graphics Renderer
# ==========================================

class Visualizer:
    def __init__(self, cpu):
        pygame.init()
        self.cpu = cpu
        self.screen = pygame.display.set_mode((900, 500))
        pygame.display.set_caption("Siemens S7 Ladder Logic Simulator")
        self.font = pygame.font.SysFont("Arial", 14)
        self.header_font = pygame.font.SysFont("Arial", 18, bold=True)
        self.clock = pygame.time.Clock()
        
        # Test decompile/recompile on init
        ConsoleLadderDecompiler.print_rebuilt_ladder(self.cpu.program)

    def draw_contact(self, x, y, label, is_closed, has_power_in):
        contact_active = has_power_in and is_closed
        color = (0, 255, 0) if contact_active else (180, 180, 180)
        # Vertical bars of contact
        pygame.draw.line(self.screen, color, (x + 10, y - 15), (x + 10, y + 15), 3)
        pygame.draw.line(self.screen, color, (x + 25, y - 15), (x + 25, y + 15), 3)
        # Label
        txt = self.font.render(label, True, (255, 255, 255))
        self.screen.blit(txt, (x + 5, y - 35))
        return contact_active

    def draw_coil(self, x, y, label, energized, has_power_in):
        color = (0, 255, 0) if (has_power_in and energized) else (180, 180, 180)
        pygame.draw.arc(self.screen, color, (x, y - 15, 20, 30), 1.5, 4.7, 3)
        pygame.draw.arc(self.screen, color, (x - 5, y - 15, 20, 30), 4.7, 1.5, 3)
        txt = self.font.render(label, True, (255, 255, 255))
        self.screen.blit(txt, (x, y - 35))

    def run(self):
        running = True
        while running:
            for e in pygame.event.get():
                if e.type == pygame.QUIT: running = False
                if e.type == pygame.KEYDOWN:
                    if e.key == pygame.K_1: self.cpu.io_memory["START"] = not self.cpu.io_memory["START"]
                    if e.key == pygame.K_2: self.cpu.io_memory["STOP"] = not self.cpu.io_memory["STOP"]
                    if e.key == pygame.K_3: self.cpu.io_memory["ESTOP"] = not self.cpu.io_memory["ESTOP"]

            self.cpu.cycle()
            self.screen.fill((25, 25, 30))

            # --- Sidebar Info (STL Code with logic highlighting) ---
            self.screen.blit(self.header_font.render("STL Code", True, (200, 200, 200)), (20, 20))
            for i, instr in enumerate(self.cpu.program):
                txt = " ".join(instr)
                # If RLO is True for this instruction, color it green
                text_color = (0, 255, 0) if self.cpu.instr_states[i] else (150, 150, 150)
                self.screen.blit(self.font.render(txt, True, text_color), (20, 50 + i * 20))

            # --- Ladder Area ---
            # Rail
            pygame.draw.line(self.screen, (100, 100, 100), (180, 40), (180, 460), 4)
            
            # Rung 1: Safety and Latch
            pwr = True
            y_rung1 = 150
            
            # Safety Section
            pygame.draw.line(self.screen, (0, 255, 0) if pwr else (100, 100, 100), (180, y_rung1), (220, y_rung1), 2)
            pwr = self.draw_contact(220, y_rung1, "ESTOP [NC]", not self.cpu.read_io("ESTOP"), pwr)
            
            pygame.draw.line(self.screen, (0, 255, 0) if pwr else (100, 100, 100), (255, y_rung1), (300, y_rung1), 2)
            pwr = self.draw_contact(300, y_rung1, "STOP [NC]", not self.cpu.read_io("STOP"), pwr)
            
            # Start / Latch Branch
            branch_pwr_in = pwr
            pygame.draw.line(self.screen, (0, 255, 0) if branch_pwr_in else (100, 100, 100), (335, y_rung1), (380, y_rung1), 2)
            pygame.draw.line(self.screen, (0, 255, 0) if branch_pwr_in else (100, 100, 100), (380, y_rung1 - 40), (380, y_rung1 + 40), 2)
            
            pwr_start = self.draw_contact(420, y_rung1 - 40, "START", self.cpu.read_io("START"), branch_pwr_in)
            pwr_run_latch = self.draw_contact(420, y_rung1 + 40, "RUN [LATCH]", self.cpu.read_io("RUN"), branch_pwr_in)
            
            pwr = pwr_start or pwr_run_latch
            
            # Rejoin and Output
            pygame.draw.line(self.screen, (0, 255, 0) if pwr else (100, 100, 100), (455, y_rung1 - 40), (500, y_rung1 - 40), 2)
            pygame.draw.line(self.screen, (0, 255, 0) if pwr else (100, 100, 100), (455, y_rung1 + 40), (500, y_rung1 + 40), 2)
            pygame.draw.line(self.screen, (0, 255, 0) if pwr else (100, 100, 100), (500, y_rung1 - 40), (500, y_rung1 + 40), 2)
            pygame.draw.line(self.screen, (0, 255, 0) if pwr else (100, 100, 100), (500, y_rung1), (700, y_rung1), 2)
            self.draw_coil(700, y_rung1, "RUN", self.cpu.read_io("RUN"), pwr)

            # Rung 2: Motor Output
            y_rung2 = 350
            pwr2 = True
            pygame.draw.line(self.screen, (0, 255, 0) if pwr2 else (100, 100, 100), (180, y_rung2), (350, y_rung2), 2)
            pwr2 = self.draw_contact(350, y_rung2, "RUN", self.cpu.read_io("RUN"), pwr2)
            pygame.draw.line(self.screen, (0, 255, 0) if pwr2 else (100, 100, 100), (385, y_rung2), (700, y_rung2), 2)
            self.draw_coil(700, y_rung2, "MOTOR", self.cpu.read_io("MOTOR"), pwr2)

            # Instructions
            self.screen.blit(self.font.render("Controls: [1] START  [2] STOP  [3] ESTOP (Toggles)", True, (200, 200, 200)), (400, 20))

            pygame.display.flip()
            self.clock.tick(30)
        pygame.quit()

if __name__ == "__main__":
    # Siemens STL Program
    stl_program = [
        ['AN', 'ESTOP'], # Safety chain
        ['AN', 'STOP'],  # Safety chain
        ['(', ],         # Start nesting for the parallel branch
        ['O', 'START'],  # Start push button
        ['O', 'RUN'],    # Latch
        [')', ],         # End nesting
        ['=', 'RUN'],    # Output to Run bit
        ['A', 'RUN'],    # If Run is high...
        ['=', 'MOTOR']   # ...then turn on Motor
    ]
    
    cpu = CPU(stl_program)
    Visualizer(cpu).run()