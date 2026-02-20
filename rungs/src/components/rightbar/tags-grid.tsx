import type {
  ParameterMap,
  DataType,
  AOIDefinition,
  TagDefinition,
  ArrayParameterValue,
  ParameterValue,
} from '@repo/plc-core';
import { TagTable, type TagWithValue } from './tag-table';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/dual-sidebar';

interface TagsGridProps {
  aoi: AOIDefinition | null;
  tagView: 'all' | 'inputs' | 'outputs' | 'local';
  parameters: ParameterMap;
  localTags: ParameterMap;
  onParameterChange?: (name: string, value: string, dataType: DataType) => void;
  onLocalTagChange?: (
    name: string,
    value: ParameterValue | ArrayParameterValue,
    dataType: DataType,
  ) => void;
}

export function TagsGrid({
  aoi,
  tagView,
  parameters,
  localTags,
  onParameterChange,
  onLocalTagChange,
}: TagsGridProps) {
  if (!aoi) return null;

  const mapWithValue = (tags: TagDefinition[]) =>
    tags.map((tag) => ({
      ...tag,
      value: tag.usage === 'local' ? localTags[tag.name] : parameters[tag.name],
    }));

  const inputs = mapWithValue(aoi.tags.filter((t) => t.usage === 'input'));
  const outputs = mapWithValue(aoi.tags.filter((t) => t.usage === 'output'));
  const locals = mapWithValue(aoi.tags.filter((t) => t.usage === 'local'));

  const renderGroup = (label: string, tags: TagWithValue[]) => {
    if (tags.length === 0) return null;
    return (
      <SidebarGroup className="ph-ignore-rageclick">
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <TagTable
            tags={tags}
            onParameterChange={onParameterChange}
            onLocalTagChange={onLocalTagChange}
          />
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  if (tagView === 'inputs') return renderGroup('Inputs', inputs);
  if (tagView === 'outputs') return renderGroup('Outputs', outputs);
  if (tagView === 'local') return renderGroup('Local', locals);

  // All
  return (
    <>
      {renderGroup('Inputs', inputs)}
      {renderGroup('Outputs', outputs)}
      {renderGroup('Local', locals)}
    </>
  );
}
