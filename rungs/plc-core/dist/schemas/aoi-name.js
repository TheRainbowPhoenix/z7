import { z } from 'zod/v4';
export const AoiNameSchema = z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(40, 'Name must be 40 characters or fewer')
    .regex(/^[A-Za-z_]/, 'Name must start with a letter or underscore')
    .regex(/^[A-Za-z0-9_]+$/, 'Only letters, digits, and underscore are allowed');
