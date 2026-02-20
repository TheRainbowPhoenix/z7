import type { DataType } from '@repo/plc-core';
import type { InstructionData, RungData } from '@repo/ladder-editor';
import { ContextMenuItem, ContextMenuSeparator } from '@repo/ladder-editor';
import { useStore } from '@/store/store';
import { getTagBaseName, isNumericTagParameter } from '../tags/tag-parameter-utils';

type CreateTagMenuItemsProps = {
  instructionData: InstructionData;
  rungData: RungData;
  onCreateTag: (name: string, dataType: DataType | undefined) => void;
};

const BOOL_INSTRUCTIONS = new Set(['XIC', 'XIO', 'ONS', 'OTE', 'OTL', 'OTU']);
const TIMER_INSTRUCTIONS = new Set(['TON', 'TOF', 'RTO']);
const COUNTER_INSTRUCTIONS = new Set(['CTU', 'CTD']);
const DINT_INSTRUCTIONS = new Set([
  'MOVE', 'ADD', 'SUB', 'MUL', 'DIV',
  'EQ', 'NE', 'GT', 'GE', 'LT', 'LE',
]);

function inferDataType(instructionType: string): DataType | undefined {
  const upper = instructionType.toUpperCase();
  if (BOOL_INSTRUCTIONS.has(upper)) return 'BOOL';
  if (TIMER_INSTRUCTIONS.has(upper)) return 'TIMER';
  if (COUNTER_INSTRUCTIONS.has(upper)) return 'COUNTER';
  if (DINT_INSTRUCTIONS.has(upper)) return 'DINT';
  return undefined;
}

export function CreateTagMenuItems({
  instructionData,
  onCreateTag,
}: CreateTagMenuItemsProps) {
  const tags = useStore((state) => state.aoi?.tags ?? []);
  const tagNameSet = new Set(tags.map((t) => t.name.toLowerCase()));

  const unknownParams: { name: string; dataType: DataType | undefined }[] = [];
  const seenNames = new Set<string>();

  for (const param of instructionData.parameters) {
    if (param === '?' || param === '' || isNumericTagParameter(param)) continue;

    const baseName = getTagBaseName(param);
    if (!baseName) continue;

    const lowerBase = baseName.toLowerCase();
    if (tagNameSet.has(lowerBase) || seenNames.has(lowerBase)) continue;

    seenNames.add(lowerBase);
    unknownParams.push({
      name: baseName,
      dataType: inferDataType(instructionData.instructionType),
    });
  }

  if (unknownParams.length === 0) return null;

  return (
    <>
      {unknownParams.map((entry) => (
        <ContextMenuItem
          key={entry.name}
          inset
          onClick={() => onCreateTag(entry.name, entry.dataType)}
        >
          {`Create Tag '${entry.name}'...`}
        </ContextMenuItem>
      ))}
      <ContextMenuSeparator />
    </>
  );
}
