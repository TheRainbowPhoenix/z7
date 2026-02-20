import { useState, useMemo } from 'react';
import { useStore } from '@/store/store';
import type { TagDefinition, DataType, ParameterValue } from '@repo/plc-core';
import {
  isArrayTag,
  TIMER_MEMBERS,
  COUNTER_MEMBERS,
  FBD_TIMER_MEMBERS,
  FBD_COUNTER_MEMBERS,
  TagDefinitionSchema,
} from '@repo/plc-core';
import TagNameCell from './cells/tag-name-cell';
import TagDataTypeCell from './cells/tag-data-type-cell';
import TagUsageCell from './cells/tag-usage-cell';
import TagArraySizeCell from './cells/tag-array-size-cell';
import TagDescriptionCell from './cells/tag-description-cell';
import ScalarValueInput from './cells/tag-default-value-cell';

type StructuredValue = Record<string, number | undefined>;

const parseBitIndex = (memberKey: string): number | null => {
  if (!/^\d+$/.test(memberKey)) return null;
  const bitIndex = Number(memberKey);
  if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex > 31) return null;
  return bitIndex;
};

type Props = {
  tagData: TagDefinition;
  memberKey: string;
  memberType: DataType;
  memberValue: number | string | StructuredValue | undefined;
  level: number;
};

function TagRowExpandable({ tagData, memberKey, memberType, memberValue, level }: Props) {
  const updateTag = useStore((state) => state.updateTag);
  const [open, setOpen] = useState(false);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [isEditingSubValues, setIsEditingSubValues] = useState<Record<string, boolean>>({});

  const isComplexType =
    memberType === 'TIMER' ||
    memberType === 'COUNTER' ||
    memberType === 'FBD_TIMER' ||
    memberType === 'FBD_COUNTER';
  const isExpandable = isComplexType;
  const readOnlyEditingState = { isEditing: false, focusField: null } as const;

  const subMembers = useMemo(() => {
    if (memberType === 'TIMER') {
      return TIMER_MEMBERS;
    }
    if (memberType === 'COUNTER') {
      return COUNTER_MEMBERS;
    }
    if (memberType === 'FBD_TIMER') {
      return FBD_TIMER_MEMBERS;
    }
    if (memberType === 'FBD_COUNTER') {
      return FBD_COUNTER_MEMBERS;
    }
    return [];
  }, [memberType]);

  const getSubMemberValue = (subKey: string): number | undefined => {
    if (memberValue && typeof memberValue === 'object' && subKey in memberValue) {
      const val = (memberValue as StructuredValue)[subKey];
      return typeof val === 'number' ? val : undefined;
    }
    return undefined;
  };

  const updateMemberValue = (value: number | null) => {
    if (isComplexType) {
      return;
    }
    updateTagMemberValue(memberKey, value ?? undefined);
  };

  const updateSubMemberValue = (subKey: string, value: number | null) => {
    if (!isComplexType) return;

    const currentStructured =
      memberValue && typeof memberValue === 'object' ? (memberValue as StructuredValue) : {};

    if (value === null || value === 0) {
      const rest = { ...currentStructured };
      delete rest[subKey];
      const hasValues = Object.keys(rest).length > 0;
      updateTagMemberValue(memberKey, hasValues ? rest : undefined);
      return;
    }

    updateTagMemberValue(memberKey, { ...currentStructured, [subKey]: value });
  };

  const persistTag = (nextTag: TagDefinition) => {
    const parsed = TagDefinitionSchema.safeParse(nextTag);
    const tag = parsed.success ? parsed.data : nextTag;
    updateTag({
      originalName: tagData.name,
      originalUsage: tagData.usage,
      tag,
    });
  };

  const updateTagMemberValue = (key: string, value: number | StructuredValue | undefined) => {
    const bitIndex = parseBitIndex(key);
    if (tagData.dataType === 'DINT' && bitIndex !== null) {
      const currentValue = typeof tagData.defaultValue === 'number' ? Math.trunc(tagData.defaultValue) : 0;
      const mask = 1 << bitIndex;
      const shouldSetBit = typeof value === 'number' && value !== 0;
      const nextValue = shouldSetBit ? (currentValue | mask) : (currentValue & ~mask);
      persistTag({
        ...tagData,
        defaultValue: nextValue === 0 ? undefined : nextValue,
      } as unknown as TagDefinition);
      return;
    }

    if (key.startsWith('[') && key.endsWith(']')) {
      const indexKey = key.slice(1, -1);
      if (!isArrayTag(tagData)) return;

      const currentElements: Record<string, { defaultValue?: unknown }> = { ...(tagData.elements ?? {}) };
      const isEmpty =
        value === undefined ||
        (typeof value === 'number' && value === 0) ||
        (typeof value === 'object' && Object.keys(value).length === 0);

      if (isEmpty) {
        delete currentElements[indexKey];
      } else {
        currentElements[indexKey] = { defaultValue: value };
      }

      const hasElements = Object.keys(currentElements).length > 0;
      persistTag({ ...tagData, elements: hasElements ? currentElements : undefined } as unknown as TagDefinition);
      return;
    }

    const current =
      tagData.defaultValue && typeof tagData.defaultValue === 'object'
        ? (tagData.defaultValue as StructuredValue)
        : {};
    const merged = { ...current, [key]: value };
    const sparseDefault = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== 0 && v !== undefined),
    );
    const hasNonDefaultValues = Object.keys(sparseDefault).length > 0;

    if (tagData.usage === 'local') {
      persistTag({
        ...tagData,
        defaultValue: hasNonDefaultValues ? (sparseDefault as ParameterValue) : undefined,
      } as unknown as TagDefinition);
    }
  };

  const chevronIcon = (
    <button
      type="button"
      className={`hover:bg-muted flex h-5 w-5 items-center justify-center rounded transition-colors ${open ? 'rotate-90' : ''}`}
      aria-label={open ? 'Collapse' : 'Expand'}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((v) => !v);
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="M9 6l6 6-6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  const indentationPadding = `${level * 20 + 8}px`;

  return (
    <>
      <tr className="odd:bg-background even:bg-muted/40">
        <td className="px-3 py-1 align-middle">
          <div style={{ paddingLeft: indentationPadding }}>
            <TagNameCell
              value={
                memberKey.startsWith('[')
                  ? `${tagData.name}${memberKey}`
                  : `${tagData.name}.${memberKey}`
              }
            onChange={() => {}}
            leading={isExpandable ? chevronIcon : <span className="inline-block h-5 w-5" />}
            onClick={isExpandable ? () => setOpen((v) => !v) : undefined}
            editingState={readOnlyEditingState}
          />
          </div>
        </td>

        <td className="px-3 py-1 align-middle">
          <TagDataTypeCell
            value={memberType}
            usage={tagData.usage}
            onChange={() => {}}
            tagData={tagData}
            editingState={readOnlyEditingState}
          />
        </td>

        <td className="px-3 py-1 align-middle">
          <TagUsageCell
            value={tagData.usage}
            dataType={memberType}
            onChange={() => {}}
            editingState={readOnlyEditingState}
          />
        </td>

        <td className="px-3 py-1 align-middle">
          <TagArraySizeCell
            value=""
            onChange={() => {}}
            disabled
            placeholder="N/A"
            displayValue={null}
            editingState={readOnlyEditingState}
          />
        </td>

        <td className="px-3 py-1 align-middle">
          {isComplexType ? (
            <div className="flex h-8 items-center">
              <span className="text-muted-foreground">[Object]</span>
            </div>
          ) : (
            <div onClick={() => !isEditingValue && setIsEditingValue(true)}>
              <ScalarValueInput
                value={memberValue as string | number | undefined | null}
                dataType={memberType}
                onChange={updateMemberValue}
                isEditing={isEditingValue}
                onEditingChange={setIsEditingValue}
                placeholder="0"
                autoFocus
              />
            </div>
          )}
        </td>

        <td className="px-3 py-1 align-middle">
          <TagDescriptionCell
            value=""
            onChange={() => {}}
            placeholder="Description"
            editingState={readOnlyEditingState}
          />
        </td>
      </tr>

      {isExpandable &&
        open &&
        subMembers.map((sub) => (
          <tr key={`${memberKey}.${sub.key}`} className="odd:bg-background even:bg-muted/40">
            <td className="px-3 py-1 align-middle">
              <div style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}>
                <TagNameCell
                  value={
                    memberKey.startsWith('[')
                      ? `${tagData.name}${memberKey}.${sub.key}`
                      : `${tagData.name}.${memberKey}.${sub.key}`
                  }
                  onChange={() => {}}
                  leading={<span className="inline-block h-5 w-5" />}
                  editingState={readOnlyEditingState}
                />
              </div>
            </td>

            <td className="px-3 py-1 align-middle">
              <TagDataTypeCell
                value={sub.type}
                usage={tagData.usage}
                onChange={() => {}}
                editingState={readOnlyEditingState}
              />
            </td>

            <td className="px-3 py-1 align-middle">
              <TagUsageCell
                value={tagData.usage}
                dataType={sub.type}
                onChange={() => {}}
                editingState={readOnlyEditingState}
              />
            </td>

            <td className="px-3 py-1 align-middle">
              <TagArraySizeCell
                value=""
                onChange={() => {}}
                disabled
                placeholder="N/A"
                displayValue={null}
                editingState={readOnlyEditingState}
              />
            </td>

            <td className="px-3 py-1 align-middle">
              <div
                onClick={() =>
                  !isEditingSubValues[sub.key] &&
                  setIsEditingSubValues({ ...isEditingSubValues, [sub.key]: true })
                }
              >
                <ScalarValueInput
                  value={getSubMemberValue(sub.key)}
                  dataType={sub.type}
                  onChange={(value) => updateSubMemberValue(sub.key, value)}
                  isEditing={isEditingSubValues[sub.key] || false}
                  onEditingChange={(editing) =>
                    setIsEditingSubValues({ ...isEditingSubValues, [sub.key]: editing })
                  }
                  placeholder="0"
                  autoFocus
                />
              </div>
            </td>

            <td className="px-3 py-1 align-middle">
              <TagDescriptionCell
                value=""
                onChange={() => {}}
                placeholder="Description"
                editingState={readOnlyEditingState}
              />
            </td>
          </tr>
        ))}
    </>
  );
}

export default TagRowExpandable;
