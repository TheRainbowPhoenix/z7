import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";
import { Backend, ProgramIR } from "./ir.ts";

export async function emitProgram(program: ProgramIR, outDir: string, backends: Backend[]): Promise<void> {
  await ensureDir(outDir);
  for (const backend of backends) {
    await backend.emit({ program, outDir });
  }
}
