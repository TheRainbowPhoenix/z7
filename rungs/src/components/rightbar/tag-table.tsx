import type { DataType, ParameterValue, ArrayParameterValue, TagDefinition } from '@repo/plc-core';
import { isStructuredTag } from '@repo/plc-core';
import { StructuredRows } from './structured-rows';
import { TagControl } from './tag-control';
import React from 'react';

export type TagWithValue = TagDefinition & { value?: unknown };

interface TagTableProps {
  tags: TagWithValue[];
  onParameterChange?: (name: string, value: string, dataType: DataType) => void;
  onLocalTagChange?: (
    name: string,
    value: ParameterValue | ArrayParameterValue,
    dataType: DataType,
  ) => void;
}

export function TagTable({ tags, onParameterChange, onLocalTagChange }: TagTableProps) {
  const renderTagRows = (tag: TagWithValue): React.ReactElement[] => {
    if (isStructuredTag(tag)) {
      return [
        <StructuredRows
          key={tag.name}
          tag={tag}
          onLocalChange={
            onLocalTagChange
              ? (name: string, value: unknown, dataType: DataType) =>
                  onLocalTagChange(name, value as ParameterValue | ArrayParameterValue, dataType)
              : undefined
          }
        />,
      ];
    }

    return [
      <tr key={tag.name} className="border-t">
        <td className="px-2 py-1 align-top">
          <span className="block max-w-full truncate font-medium" title={tag.name}>
            {tag.name}
          </span>
        </td>
        <td className="px-2 py-1 align-top">
          <div className="flex justify-end">
            <TagControl
              tag={tag}
              onParameterChange={onParameterChange}
              onLocalTagChange={onLocalTagChange}
            />
          </div>
        </td>
      </tr>,
    ];
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-xs" role="table" aria-label="Tag values">
        <colgroup>
          <col className="w-[75%]" />
          <col className="w-[25%]" />
        </colgroup>
        <thead className="sr-only">
          <tr>
            <th scope="col">Tag Name</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>{tags.flatMap((tag) => renderTagRows(tag))}</tbody>
      </table>
    </div>
  );
}
