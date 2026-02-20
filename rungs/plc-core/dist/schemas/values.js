import { z } from 'zod/v4';
export const DINT_MIN = -2147483648;
export const DINT_MAX = 2147483647;
export const REAL_MIN = -3.402823e38;
export const REAL_MAX = 3.402823e38;
export const BoolValueSchema = z.coerce
    .number()
    .transform((value) => (value ? 1 : 0))
    .refine((value) => value === 0 || value === 1, 'BOOL must be 0 or 1');
export const DintValueSchema = z.coerce
    .number()
    .refine(Number.isFinite, 'DINT must be finite')
    .transform((v) => Math.trunc(v))
    .refine((v) => v >= DINT_MIN && v <= DINT_MAX, 'DINT must be within 32-bit range');
export const RealValueSchema = z.coerce
    .number()
    .refine(Number.isFinite, 'REAL must be finite')
    .refine((v) => v >= REAL_MIN && v <= REAL_MAX, 'REAL must be within allowable range');
export const BasicValueSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('BOOL'), value: BoolValueSchema }),
    z.object({ type: z.literal('DINT'), value: DintValueSchema }),
    z.object({ type: z.literal('REAL'), value: RealValueSchema }),
]);
const sparseValue = (value) => (value === 0 ? undefined : value);
const stripUndefined = (obj) => {
    const filtered = Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
    return Object.keys(filtered).length === 0 ? undefined : filtered;
};
export const BoolFieldSchema = BoolValueSchema.transform(sparseValue).optional();
export const DintFieldSchema = DintValueSchema.transform(sparseValue).optional();
export const RealFieldSchema = RealValueSchema.transform(sparseValue).optional();
export const TimerValueSchema = z
    .object({
    PRE: DintFieldSchema,
    ACC: DintFieldSchema,
    EN: BoolFieldSchema,
    TT: BoolFieldSchema,
    DN: BoolFieldSchema,
})
    .transform(stripUndefined);
export const CounterValueSchema = z
    .object({
    PRE: DintFieldSchema,
    ACC: DintFieldSchema,
    CU: BoolFieldSchema,
    CD: BoolFieldSchema,
    DN: BoolFieldSchema,
    OV: BoolFieldSchema,
    UN: BoolFieldSchema,
})
    .transform(stripUndefined);
export const FbdTimerValueSchema = z
    .object({
    EnableIn: BoolFieldSchema,
    TimerEnable: BoolFieldSchema,
    PRE: DintFieldSchema,
    Reset: BoolFieldSchema,
    EnableOut: BoolFieldSchema,
    ACC: DintFieldSchema,
    EN: BoolFieldSchema,
    TT: BoolFieldSchema,
    DN: BoolFieldSchema,
    Status: DintFieldSchema,
    InstructFault: BoolFieldSchema,
    PresetInv: BoolFieldSchema,
})
    .transform(stripUndefined);
export const FbdCounterValueSchema = z
    .object({
    EnableIn: BoolFieldSchema,
    CUEnable: BoolFieldSchema,
    CDEnable: BoolFieldSchema,
    PRE: DintFieldSchema,
    Reset: BoolFieldSchema,
    EnableOut: BoolFieldSchema,
    ACC: DintFieldSchema,
    CU: BoolFieldSchema,
    CD: BoolFieldSchema,
    DN: BoolFieldSchema,
    OV: BoolFieldSchema,
    UN: BoolFieldSchema,
})
    .transform(stripUndefined);
