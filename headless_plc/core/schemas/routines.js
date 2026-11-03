import { z } from 'zod';
export const RoutineTypeSchema = z.enum(['st', 'ld']);
export const RoutineNameSchema = z.enum(['Prescan', 'EnableInFalse', 'Logic']);
const CompiledRoutineSchema = z.object({
    javascript: z.string(),
    compiledAt: z.string(),
    sourceMap: z.string().optional(),
});
export const RoutineDefinitionSchema = z.object({
    type: RoutineTypeSchema,
    content: z.string(),
    description: z.string().optional(),
    compiled: CompiledRoutineSchema.optional(),
});
export const AOIRoutinesSchema = z.object({
    Logic: RoutineDefinitionSchema,
    Prescan: RoutineDefinitionSchema.optional(),
    EnableInFalse: RoutineDefinitionSchema.optional(),
});
