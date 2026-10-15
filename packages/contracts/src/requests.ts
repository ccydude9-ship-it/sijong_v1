import { z } from 'zod';
export const clockSchema = z
  .object({ hour: z.number().int().min(1).max(12), minute: z.union([z.literal(0), z.literal(30)]) })
  .strict();
export const cardSchema = z
  .object({
    id: z.string().min(1),
    studentId: z.string().min(1),
    title: z.string().trim().min(1).max(60),
    kind: z.enum(['wake', 'sleep', 'custom']),
    imageId: z.string().min(1),
    minuteOfDay: z.number().int().min(0).max(1439).multipleOf(30),
  })
  .strict();
export const studentSetupSchema = z
  .object({
    displayName: z.string().trim().min(1).max(30),
    distinction: z.string().trim().max(30),
    cards: z.array(cardSchema).length(8),
  })
  .strict();
export const progressSchema = z
  .object({
    operationId: z.string().min(8).max(100),
    expectedRevision: z.number().int().min(0),
    action: z.enum(['save', 'check-times', 'check-order', 'return-to-reading']),
    answers: z.record(z.string(), clockSchema.nullable()).optional(),
    order: z.array(z.string()).length(8).optional(),
  })
  .strict();
export type ProgressCommand = z.infer<typeof progressSchema>;
export const phaseSchema = z
  .object({
    operationId: z.string().min(8).max(100),
    expectedRevision: z.number().int().min(0),
    phase: z.enum(['active', 'ended']),
    confirmIncomplete: z.boolean().default(false),
  })
  .strict();
