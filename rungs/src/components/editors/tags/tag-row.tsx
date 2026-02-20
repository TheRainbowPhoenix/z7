import { useState, ReactNode, forwardRef } from 'react';
import { useStore } from '@/store/store';
import { type DataType, type TagDefinition } from '@repo/plc-core';
import { EditableRowProvider, FocusField, useEditableRow } from './editable-row-context';
import TagNameCell from './cells/tag-name-cell';
import TagDescriptionCell from './cells/tag-description-cell';
import TagArraySizeCell from './cells/tag-array-size-cell';
import ScalarValueInput from './cells/tag-default-value-cell';
import TagDataTypeCell from './cells/tag-data-type-cell';
import TagUsageCell from './cells/tag-usage-cell';
import RowContextMenu from './row-context-menu';
import { useTagForm, type TagUsage, isStructuredType } from './use-tag-form';

type Props = {
  tagData?: TagDefinition;
  leading?: ReactNode;
};

const isUsageOption = (value: string): value is TagUsage =>
  value === 'input' || value === 'output' || value === 'local';

function TagRow({ tagData, leading }: Props) {
  const isNewRow = !tagData;
  const addTag = useStore((state) => state.addTag);
  const updateTag = useStore((state) => state.updateTag);
  const deleteTag = useStore((state) => state.deleteTag);
  const allTags = useStore((state) => state.aoi?.tags ?? []);

  const [isEditing, setIsEditing] = useState(isNewRow);
  const [focusField, setFocusField] = useState<FocusField>(null);
  const [dataTypeOpen, setDataTypeOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);

  const existingNames = new Set(allTags.map((tag) => tag.name.toLowerCase()));
  const excludeName = tagData?.name;

  const form = useTagForm({
    existingNames,
    excludeName,
    initialTag: tagData,
    onSubmit: (tag) => {
      if (isNewRow) {
        addTag(tag);
        form.reset();
        setFocusField('name');
      } else {
        updateTag({
          originalName: tagData.name,
          originalUsage: tagData.usage,
          tag,
        });
        setIsEditing(false);
      }
    },
  });

  const handleCancel = () => {
    if (isNewRow) {
      form.reset();
      return;
    }
    if (tagData) {
      form.resetToTag(tagData);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!tagData) return;
    deleteTag({ name: tagData.name, usage: tagData.usage });
  };

  const onRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    const nextTarget = e.relatedTarget;
    if (nextTarget instanceof Node && e.currentTarget.contains(nextTarget)) return;
    if (dataTypeOpen || usageOpen) return;

    if (isNewRow && form.values.name?.trim()) {
      form.validateAndSubmit();
    } else if (isEditing) {
      form.validateAndSubmit();
    }
  };

  const rowContent = (
    <TagRowContent
      form={form}
      isNewRow={isNewRow}
      leading={leading}
      dataTypeOpen={dataTypeOpen}
      onDataTypeOpenChange={setDataTypeOpen}
      usageOpen={usageOpen}
      onUsageOpenChange={setUsageOpen}
      onRowBlur={onRowBlur}
      onFieldFocus={(field) => {
        if (!isEditing) {
          setFocusField(field);
          setIsEditing(true);
        }
      }}
      onStartEditing={() => setIsEditing(true)}
      tagData={tagData}
    />
  );

  return (
    <EditableRowProvider
      isEditing={isEditing}
      setIsEditing={setIsEditing}
      focusField={focusField}
      setFocusField={setFocusField}
      saveIfValid={form.validateAndSubmit}
      handleCancel={handleCancel}
    >
      {isNewRow ? (
        rowContent
      ) : (
        <RowContextMenu onDelete={handleDelete}>{rowContent}</RowContextMenu>
      )}
    </EditableRowProvider>
  );
}

type RowContentProps = React.ComponentPropsWithoutRef<'tr'> & {
  form: ReturnType<typeof useTagForm>;
  isNewRow: boolean;
  leading?: ReactNode;
  dataTypeOpen: boolean;
  onDataTypeOpenChange: (open: boolean) => void;
  usageOpen: boolean;
  onUsageOpenChange: (open: boolean) => void;
  onRowBlur: (event: React.FocusEvent<HTMLTableRowElement>) => void;
  onFieldFocus: (field: FocusField) => void;
  onStartEditing: () => void;
  tagData?: TagDefinition;
};

const TagRowContent = forwardRef<HTMLTableRowElement, RowContentProps>(function TagRowContent(
  {
    form,
    isNewRow,
    leading,
    dataTypeOpen,
    onDataTypeOpenChange,
    usageOpen,
    onUsageOpenChange,
    onRowBlur,
    onFieldFocus,
    onStartEditing,
    tagData,
    ...restProps
  },
  ref,
) {
  const { values, errors, resetKey } = form;
  const { isEditing, focusField, onInputKeyDown } = useEditableRow();
  const isArrayValue = values.dimension !== undefined;
  const isStructuredValue = isStructuredType(values.dataType);
  const isComplexOrArray = isArrayValue || isStructuredValue;
  const nameError = errors.name ?? null;
  const arrayDisplayValue = isArrayValue ? values.dimension : null;

  return (
    <tr
      ref={ref}
      {...restProps}
      className={`odd:bg-background even:bg-muted/40 h-9 ${
        isNewRow ? '' : 'hover:bg-accent/40 cursor-pointer'
      }`}
      onDoubleClick={isNewRow ? undefined : onStartEditing}
      onBlur={onRowBlur}
    >
      <td className="relative overflow-visible px-3 py-1 align-middle">
        <TagNameCell
          value={values.name}
          onChange={(v) => form.setValue('name', v)}
          error={nameError}
          leading={leading}
          placeholder={isNewRow ? 'Add Tag...' : undefined}
          autoFocus={isNewRow}
          onClick={isNewRow ? undefined : () => onFieldFocus('name')}
        />
      </td>

      <td className="overflow-hidden px-3 py-1 align-middle">
        <TagDataTypeCell
          value={values.dataType}
          usage={values.usage}
          onChange={(val: DataType) => {
            if (values.usage !== 'local' && isStructuredType(val)) return;
            form.setDataTypeValue(val);
          }}
          open={dataTypeOpen}
          onOpenChange={onDataTypeOpenChange}
          tagData={tagData}
          onClick={isNewRow ? undefined : () => onFieldFocus('type')}
        />
      </td>

      <td className="overflow-hidden px-3 py-1 align-middle">
        <TagUsageCell
          value={values.usage}
          dataType={values.dataType}
          onChange={(val) => {
            if (isUsageOption(val)) form.setUsageValue(val);
          }}
          open={usageOpen}
          onOpenChange={onUsageOpenChange}
          onClick={isNewRow ? undefined : () => onFieldFocus('usage')}
        />
      </td>

      <td className="relative overflow-visible px-3 py-1 align-middle">
        <TagArraySizeCell
          value={values.dimension !== undefined ? String(values.dimension) : ''}
          onChange={form.setArraySizeValue}
          error={null}
          disabled={values.usage !== 'local'}
          placeholder={values.usage === 'local' ? 'Optional' : 'N/A'}
          displayValue={arrayDisplayValue}
          onClick={
            isNewRow || values.usage !== 'local' ? undefined : () => onFieldFocus('arraySize')
          }
        />
      </td>

      <td className="overflow-hidden px-3 py-1 align-middle">
        {isComplexOrArray ? (
          <div className="flex h-8 items-center">
            <span className="text-muted-foreground">[Object]</span>
          </div>
        ) : (
          <div onClick={isNewRow ? undefined : () => onFieldFocus('value')}>
            <ScalarValueInput
              key={resetKey}
              value={
                typeof values.defaultValue === 'object'
                  ? 0
                  : (values.defaultValue as number | string | undefined | null)
              }
              dataType={values.dataType}
              onChange={form.setDefaultValue}
              isEditing={isEditing}
              placeholder="0"
              autoFocus={focusField === 'value'}
              onKeyDown={onInputKeyDown}
            />
          </div>
        )}
      </td>

      <td className="overflow-hidden px-3 py-1 align-middle">
        <TagDescriptionCell
          value={values.description ?? ''}
          onChange={(v) => form.setValue('description', v || undefined)}
          placeholder="Description"
          onClick={isNewRow ? undefined : () => onFieldFocus('description')}
        />
      </td>
    </tr>
  );
});

export default TagRow;
