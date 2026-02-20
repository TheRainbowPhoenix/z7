import { getMembersForDataType, type AOIDefinition, type RoutineDefinition } from '@repo/plc-core';
import type { TagInfo, LadderDiagnostic, LadderError } from '@repo/ladder-editor';
import type { CompilationDiagnostic, LDCompilationDiagnostic } from '@repo/plc-compiler';
import type { SimulationRuntimeDiagnostic, SimulationState } from '@/lib/aoi-simulator';

type RuntimeState = Pick<SimulationState, 'parameters' | 'localTags'>;

export function resolveLadderTag(
  aoi: AOIDefinition | null | undefined,
  simulationState: RuntimeState | null | undefined,
  tagPath: string,
): TagInfo | null {
  if (!aoi?.tags) return null;

  const bracketMatch = tagPath.match(/^([a-zA-Z_]\w*)\[(\d+)\](\..*)?$/);

  let baseName: string;
  let arrayIndex: number | null = null;
  let memberChain: string[];

  if (bracketMatch) {
    baseName = bracketMatch[1];
    arrayIndex = parseInt(bracketMatch[2], 10);
    memberChain = bracketMatch[3] ? bracketMatch[3].slice(1).split('.') : [];
  } else {
    const parts = tagPath.split('.');
    baseName = parts[0];
    memberChain = parts.slice(1);
  }

  const tagDef = aoi.tags.find((tag) => tag.name === baseName);
  if (!tagDef) return null;

  let runtimeValue: unknown =
    tagDef.usage === 'local'
      ? simulationState?.localTags[baseName]
      : simulationState?.parameters[baseName];

  if (arrayIndex !== null) {
    if (!Array.isArray(runtimeValue) || arrayIndex < 0 || arrayIndex >= runtimeValue.length) {
      runtimeValue = undefined;
    } else {
      runtimeValue = runtimeValue[arrayIndex];
    }
  }

  if (memberChain.length === 0) {
    return {
      definition: {
        name: tagDef.name,
        dataType: tagDef.dataType,
        usage: tagDef.usage,
      },
      value: runtimeValue ?? 0,
    };
  }

  let currentType = tagDef.dataType;

  for (const memberName of memberChain) {
    if (currentType === 'DINT' && /^\d+$/.test(memberName)) {
      const bitIndex = Number(memberName);
      if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex > 31) return null;
      const dintValue = typeof runtimeValue === 'number' ? Math.trunc(runtimeValue) : 0;
      runtimeValue = (dintValue >>> bitIndex) & 1 ? 1 : 0;
      currentType = 'BOOL';
      continue;
    }

    const member = getMembersForDataType(currentType).find(
      (item) => item.key.toUpperCase() === memberName.toUpperCase(),
    );
    if (!member) return null;

    const structValue = runtimeValue as Record<string, unknown> | undefined;
    runtimeValue = structValue?.[member.key] ?? 0;
    currentType = member.type;
  }

  return {
    definition: {
      name: tagPath,
      dataType: currentType,
      usage: tagDef.usage,
    },
    value: runtimeValue ?? 0,
  };
}

export function mapLadderDiagnostics(
  compilationDiagnostics: CompilationDiagnostic[] | undefined,
  runtimeDiagnostics: SimulationRuntimeDiagnostic[] | undefined,
): LadderDiagnostic[] {
  const compileDiagnostics: LadderDiagnostic[] = (compilationDiagnostics ?? [])
    .filter((diagnostic): diagnostic is LDCompilationDiagnostic => diagnostic.type === 'ld')
    .map((diagnostic) => ({
      rung: diagnostic.rung,
      element: diagnostic.element,
      message: diagnostic.message,
      severity: diagnostic.severity,
      code: diagnostic.code,
    }));

  const mappedRuntimeDiagnostics: LadderDiagnostic[] = (runtimeDiagnostics ?? []).map(
    (diagnostic) => ({
      rung: diagnostic.rung ?? 0,
      element: diagnostic.element,
      message: diagnostic.message,
      severity: diagnostic.severity,
      code: diagnostic.code,
    }),
  );

  return [...compileDiagnostics, ...mappedRuntimeDiagnostics];
}

export function mapLadderParseErrors(
  parseErrors: LadderError[] | undefined,
  rungIds: string[] | undefined,
): LadderDiagnostic[] {
  const rungIndexById = new Map<string, number>();
  for (const [index, rungId] of (rungIds ?? []).entries()) {
    rungIndexById.set(rungId, index + 1);
  }

  return (parseErrors ?? []).map((error) => ({
    rung: error.rungId ? (rungIndexById.get(error.rungId) ?? 0) : 0,
    message: error.message,
    severity: error.severity ?? 'error',
    code: error.code,
  }));
}

export function applyDslToRoutine(routine: RoutineDefinition, dsl: string): RoutineDefinition {
  return {
    ...routine,
    content: dsl,
  };
}
