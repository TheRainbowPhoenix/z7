import { z } from 'zod/v4';
import { TagDefinitionSchema } from './tags.js';
import { AOIRoutinesSchema } from './routines.js';
import { AoiNameSchema } from './aoi-name.js';
export const AOIMetadataSchema = z.object({
    created: z.string().optional(),
    modified: z.string().optional(),
});
export const TestDefinitionSchema = z.object({
    content: z.string(),
    config: z
        .object({
        timeout: z.number().positive(),
        maxIterations: z.number().positive(),
        enableDebugMode: z.boolean(),
    })
        .optional(),
});
export const AOIDefinitionSchema = z.object({
    name: AoiNameSchema,
    description: z.string(),
    tags: z.array(TagDefinitionSchema),
    routines: AOIRoutinesSchema,
    metadata: AOIMetadataSchema.optional(),
    testing: TestDefinitionSchema.optional(),
});
