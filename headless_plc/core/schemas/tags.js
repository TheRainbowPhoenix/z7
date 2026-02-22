import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { BoolFieldSchema, DintFieldSchema, RealFieldSchema, TimerValueSchema, CounterValueSchema, FbdTimerValueSchema, FbdCounterValueSchema, } from './values.js';
import { TagNameSchema } from './tag-name.js';
export const DataTypeValueSchema = z.enum(['BOOL', 'DINT', 'REAL', 'TIMER', 'COUNTER', 'FBD_TIMER', 'FBD_COUNTER']);
export const TagUsageSchema = z.enum(['input', 'output', 'local']);
export const StyleTypeSchema = z.enum(['Decimal', 'Binary', 'Hex', 'Float']);
export const ArraySizeSchema = z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val === '' || /^\d+$/.test(val), 'Array size must be a number')
    .transform((val) => (val === '' ? null : parseInt(val, 10)))
    .refine((val) => val === null || val >= 1, 'Array size must be a positive number')
    .refine((val) => val === null || val <= 128, 'Array size cannot exceed 128');
export const TagDescriptionSchema = z
    .string()
    .transform((value) => {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
})
    .optional();
const ScalarTagBaseSchema = z.object({
    id: z.string().uuid().default(() => uuid()),
    name: TagNameSchema,
    usage: TagUsageSchema,
    description: TagDescriptionSchema,
});
const ArrayDimensionSchema = z.number().int().min(1).max(128);
const ArrayTagBaseSchema = z.object({
    id: z.string().uuid().default(() => uuid()),
    name: TagNameSchema,
    usage: z.literal('local'),
    description: TagDescriptionSchema,
    defaultValue: z.undefined(),
    dimension: ArrayDimensionSchema,
});
const createArrayElementsSchema = (valueSchema) => z
    .record(z.string(), z.object({
    description: TagDescriptionSchema,
    defaultValue: valueSchema,
}))
    .optional();
const createArraySchema = (dataType, valueSchema) => ArrayTagBaseSchema.extend({
    dataType: z.literal(dataType),
    elements: createArrayElementsSchema(valueSchema),
});
export const BoolTagSchema = ScalarTagBaseSchema.extend({
    dataType: z.literal('BOOL'),
    defaultValue: BoolFieldSchema,
});
export const BoolArraySchema = createArraySchema('BOOL', BoolFieldSchema);
export const DintTagSchema = ScalarTagBaseSchema.extend({
    dataType: z.literal('DINT'),
    defaultValue: DintFieldSchema,
});
export const DintArraySchema = createArraySchema('DINT', DintFieldSchema);
export const RealTagSchema = ScalarTagBaseSchema.extend({
    dataType: z.literal('REAL'),
    defaultValue: RealFieldSchema,
});
export const RealArraySchema = createArraySchema('REAL', RealFieldSchema);
export const TimerTagSchema = ScalarTagBaseSchema.extend({
    dataType: z.literal('TIMER'),
    usage: z.literal('local'),
    defaultValue: TimerValueSchema.optional(),
});
export const TimerArraySchema = createArraySchema('TIMER', TimerValueSchema);
export const CounterTagSchema = ScalarTagBaseSchema.extend({
    dataType: z.literal('COUNTER'),
    usage: z.literal('local'),
    defaultValue: CounterValueSchema.optional(),
});
export const CounterArraySchema = createArraySchema('COUNTER', CounterValueSchema);
export const FbdTimerTagSchema = ScalarTagBaseSchema.extend({
    dataType: z.literal('FBD_TIMER'),
    usage: z.literal('local'),
    defaultValue: FbdTimerValueSchema.optional(),
});
export const FbdTimerArraySchema = createArraySchema('FBD_TIMER', FbdTimerValueSchema);
export const FbdCounterTagSchema = ScalarTagBaseSchema.extend({
    dataType: z.literal('FBD_COUNTER'),
    usage: z.literal('local'),
    defaultValue: FbdCounterValueSchema.optional(),
});
export const FbdCounterArraySchema = createArraySchema('FBD_COUNTER', FbdCounterValueSchema);
export const TagSchema = z.discriminatedUnion('dataType', [
    BoolTagSchema,
    DintTagSchema,
    RealTagSchema,
    TimerTagSchema,
    CounterTagSchema,
    FbdTimerTagSchema,
    FbdCounterTagSchema,
]);
export const ArraySchema = z.discriminatedUnion('dataType', [
    BoolArraySchema,
    DintArraySchema,
    RealArraySchema,
    TimerArraySchema,
    CounterArraySchema,
    FbdTimerArraySchema,
    FbdCounterArraySchema,
]);
const pruneArrayElements = (tag) => {
    if (!tag.elements)
        return tag;
    const maxIndex = tag.dimension;
    const prunedEntries = Object.entries(tag.elements).filter(([key, value]) => {
        const index = Number(key);
        const validIndex = Number.isInteger(index) && index >= 0 && index < maxIndex;
        if (!validIndex)
            return false;
        const hasDescription = value.description !== undefined;
        const hasValue = value.defaultValue !== undefined;
        return hasDescription || hasValue;
    });
    if (prunedEntries.length === 0) {
        return { ...tag, elements: undefined };
    }
    const prunedElements = Object.fromEntries(prunedEntries.map(([key, value]) => [key, value]));
    return { ...tag, elements: prunedElements };
};
export const TagDefinitionSchema = z.union([ArraySchema, TagSchema]).transform((tag) => {
    if ('elements' in tag) {
        return pruneArrayElements(tag);
    }
    return tag;
});
