from typing import List, Any, Optional
from .parser import TextParser, SchematicParser
from .renderer import TextRenderer, SchematicRenderer

class LadderEngine:
    def __init__(self, parser: Optional[SchematicParser] = None, renderer: Optional[SchematicRenderer] = None):
        self.parser = parser or TextParser()
        self.renderer = renderer or TextRenderer()

    def compile(self, schematic: str) -> List[List[Any]]:
        """Converts text schematic to a list of instructions."""
        return self.parser.parse(schematic)

    def decompile(self, instructions: List[List[Any]]) -> str:
        """Converts a list of instructions back to a text schematic."""
        return self.renderer.render(instructions)

    def process(self, source: Any) -> Any:
        instructions = self.compile(source)
        return self.decompile(instructions)
