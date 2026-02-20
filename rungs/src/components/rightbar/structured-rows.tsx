import { BoolField } from './bool-field';
import { IntField } from './int-field';
import { RealField } from './real-field';
import { TimerCounterEditor } from './timer-counter-editor';
import type { DataType } from '@repo/plc-core';
import { DATA_TYPES, isStructuredTag } from '@repo/plc-core';
import { parseParameterValue } from '@/components/editors/tags/tag-field-utils';
import type { TagWithValue } from './tag-table';
import { Fragment } from 'react';

type Props = {
  tag: TagWithValue;
  onLocalChange?: (name: string, value: unknown, dataType: DataType) => void;
};

export function StructuredRows({ tag, onLocalChange }: Props) {
  const isArray =
    Array.isArray(tag.value) ||
    (tag.usage === 'local' && 'dimension' in tag && tag.dimension !== undefined);

  if (isArray) {
    const arr: unknown[] = Array.isArray(tag.value) ? tag.value : [];
    const size: number =
      ('dimension' in tag && typeof tag.dimension === 'number' ? tag.dimension : null) ??
      arr.length ??
      0;
    const baseType = tag.dataType.toUpperCase();
    const canEdit = tag.usage === 'input' && Boolean(onLocalChange);

    const setElementAt = (index: number, newVal: string) => {
      if (!canEdit || !onLocalChange) return;
      const next = Array.isArray(tag.value) ? [...tag.value] : [...new Array(size).fill(0)];
      const parsed = parseParameterValue(newVal, baseType as DataType);
      if (parsed !== null) {
        next[index] = parsed;
      }
      onLocalChange(tag.name, next, tag.dataType);
    };

    return (
      <>
        <tr key={tag.name} className="border-t">
          <td className="px-2 py-1">
            <span className="font-medium">{tag.name}</span>
          </td>
          <td className="px-2 py-1">
            <div className="flex items-center justify-end gap-2">
              <span className="text-[11px] text-gray-500">Array[{size}]</span>
            </div>
          </td>
        </tr>

        {Array.from({ length: size }).map((_, i) =>
          baseType === DATA_TYPES.TIMER ||
          baseType === DATA_TYPES.COUNTER ||
          baseType === DATA_TYPES.FBD_TIMER ||
          baseType === DATA_TYPES.FBD_COUNTER ? (
            <Fragment key={`${tag.name}[${i}]`}>
              <tr className="border-t">
                <td className="px-2 py-1 align-top">
                  <span
                    className="block max-w-full truncate pl-2 font-mono text-[12px]"
                    title={`${tag.name}[${i}]`}
                  >
                    {`${tag.name}[${i}]`}
                  </span>
                </td>
                <td className="px-2 py-1 align-top">
                  <span className="text-[11px] text-gray-500">[Object]</span>
                </td>
              </tr>
              <TimerCounterEditor
                tag={
                  {
                    ...tag,
                    name: `${tag.name}[${i}]`,
                    dataType: baseType,
                    value: arr[i] || {},
                  } as TagWithValue
                }
                indentLevel={2}
                onLocalTagChange={tag.usage === 'input' ? onLocalChange : undefined}
              />
            </Fragment>
          ) : (
            <tr key={`${tag.name}.${i}`} className="border-t">
              <td className="px-2 py-1 align-top">
                <span
                  className="block max-w-full truncate pl-2 font-mono text-[12px]"
                  title={`${tag.name}[${i}]`}
                >
                  {`${tag.name}[${i}]`}
                </span>
              </td>
              <td className="px-2 py-1 align-top">
                <div className="flex justify-end">
                  {baseType === DATA_TYPES.BOOL ? (
                    <BoolField
                      value={typeof arr[i] === 'number' && arr[i] === 1 ? 1 : 0}
                      editable={canEdit}
                      onChange={(v) => setElementAt(i, v)}
                    />
                  ) : baseType === DATA_TYPES.REAL ? (
                    <RealField
                      value={
                        typeof arr[i] === 'number' && !Number.isNaN(arr[i] as number)
                          ? (arr[i] as number)
                          : 0
                      }
                      editable={canEdit}
                      onChange={(v) => setElementAt(i, v)}
                    />
                  ) : (
                    <IntField
                      value={typeof arr[i] === 'number' ? (arr[i] as number) : 0}
                      editable={canEdit}
                      onChange={(v) => setElementAt(i, v)}
                    />
                  )}
                </div>
              </td>
            </tr>
          ),
        )}
      </>
    );
  }

  // Non-array
  return (
    <>
      <tr key={tag.name} className="border-t">
        <td className="px-2 py-1 align-top">
          <span className="block max-w-full truncate font-medium" title={tag.name}>
            {tag.name}
          </span>
        </td>
        <td className="px-2 py-1 align-top">
          <div className="flex justify-end">
            {isStructuredTag(tag) ? (
              <span className="text-[11px] text-gray-500">[Object]</span>
            ) : null}
          </div>
        </td>
      </tr>
      {isStructuredTag(tag) ? (
        <TimerCounterEditor
          tag={{ ...tag, value: tag.value || {} }}
          onLocalTagChange={tag.usage === 'input' ? onLocalChange : undefined}
        />
      ) : null}
    </>
  );
}

export default StructuredRows;
