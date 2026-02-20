import TagRow from './tag-row';
import TagRowExpandable from './tag-row-expandable';
import type { TagDefinition } from '@repo/plc-core';
import { getTagMembers, getTagMemberValue } from '@repo/plc-core';
import { useState } from 'react';

type Props = {
  tagData: TagDefinition;
};

function TagRowMap({ tagData }: Props) {
  const members = getTagMembers(tagData);
  const isExpandable = members.length > 0;
  const [open, setOpen] = useState(false);

  const leading = isExpandable ? (
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
  ) : (
    <span className="inline-block h-5 w-5" />
  );

  return (
    <>
      <TagRow tagData={tagData} leading={leading} />
      {isExpandable &&
        open &&
        members.map((member) => (
          <TagRowExpandable
            key={`${tagData.name}.${member.key}`}
            tagData={tagData}
            memberKey={member.key}
            memberType={member.type}
            memberValue={getTagMemberValue(tagData, member.key)}
            level={1}
          />
        ))}
    </>
  );
}

export default TagRowMap;
