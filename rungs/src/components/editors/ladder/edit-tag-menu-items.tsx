import type { TagDefinition } from '@repo/plc-core';
import type { InstructionData, RungData } from '@repo/ladder-editor';
import { ContextMenuItem, ContextMenuSeparator } from '@repo/ladder-editor';
import { useStore } from '@/store/store';
import { getTagBaseName, isNumericTagParameter } from '../tags/tag-parameter-utils';

type EditTagMenuItemsProps = {
  instructionData: InstructionData;
  rungData: RungData;
  onEditTag: (tag: TagDefinition) => void;
};

export function EditTagMenuItems({
  instructionData,
  onEditTag,
}: EditTagMenuItemsProps) {
  const tags = useStore((state) => state.aoi?.tags ?? []);
  const tagMap = new Map(tags.map((t) => [t.name.toLowerCase(), t]));

  const matchedTags: TagDefinition[] = [];
  const seenNames = new Set<string>();

  for (const param of instructionData.parameters) {
    if (param === '?' || param === '' || isNumericTagParameter(param)) continue;

    const baseName = getTagBaseName(param);
    if (!baseName) continue;

    const lowerBase = baseName.toLowerCase();
    if (seenNames.has(lowerBase)) continue;
    seenNames.add(lowerBase);

    const existing = tagMap.get(lowerBase);
    if (existing) {
      matchedTags.push(existing);
    }
  }

  if (matchedTags.length === 0) return null;

  return (
    <>
      {matchedTags.map((tag) => (
        <ContextMenuItem
          key={tag.name}
          inset
          onClick={() => onEditTag(tag)}
        >
          {`Edit Tag '${tag.name}'...`}
        </ContextMenuItem>
      ))}
      <ContextMenuSeparator />
    </>
  );
}
