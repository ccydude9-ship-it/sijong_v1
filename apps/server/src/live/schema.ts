import { z } from 'zod';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const picture = z
  .string()
  .max(5_000_000)
  .regex(/^(?:|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/);
const time = z
  .object({
    hour: z.number().int().min(1).max(12).nullable(),
    minute: z.union([z.literal(0), z.literal(30), z.null()]),
  })
  .strict();
export const progressSchema = z
  .object({
    stage: z.enum(['reading', 'ordering', 'completed']),
    answers: z.record(id, time),
    order: z.array(id).length(8),
    flipped: z.record(id, z.boolean()),
    wrong: z.array(id).max(8),
    solved: z.number().int().min(0).max(100000),
    practice: z
      .object({
        hour: z.number().int().min(1).max(12),
        minute: z.union([z.literal(0), z.literal(30)]),
        cardId: id.optional(),
        answer: time.nullable(),
        hint: z.enum(['none', 'minute', 'hour', 'zoom']),
        correct: z.boolean(),
        dismissed: z.boolean().optional(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const studentSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(30),
    distinction: z.string().max(20),
    photo: z.union([picture, z.string().regex(/^preset:[0-5]$/)]).optional(),
    cards: z
      .array(
        z
          .object({
            id,
            title: z.string().trim().min(1).max(60),
            minute: z.number().int().min(0).max(1439).multipleOf(30),
            image: picture,
            scene: z.number().int().min(0).max(7),
          })
          .strict(),
      )
      .length(8),
    progress: progressSchema,
  })
  .strict();
export const classroomSchema = z
  .object({
    version: z.literal(1),
    phase: z.enum(['active', 'ended']),
    students: z.array(studentSchema).length(6),
    portraitSheet: picture.optional(),
    classPortraits: z.string().max(100).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (new Set(data.students.map((s) => s.id)).size !== 6)
      ctx.addIssue({ code: 'custom', message: '학생 번호가 중복됩니다' });
    for (const s of data.students) {
      if (
        new Set(s.cards.map((c) => c.id)).size !== 8 ||
        new Set(s.cards.map((c) => c.minute)).size !== 8
      )
        ctx.addIssue({ code: 'custom', message: '카드 번호와 시각은 서로 달라야 합니다' });
      if (s.photo?.startsWith('preset:') && !data.portraitSheet)
        ctx.addIssue({ code: 'custom', message: '학생 사진 자료가 필요합니다' });
      if (!validProgress(s, s.progress))
        ctx.addIssue({ code: 'custom', message: '학생 카드와 진행 기록이 일치하지 않습니다' });
    }
  });
export type Classroom = z.infer<typeof classroomSchema>;
export type Student = z.infer<typeof studentSchema>;
export type Progress = z.infer<typeof progressSchema>;
export function validProgress(s: Pick<Student, 'cards'>, p: Progress) {
  const has = (id: string) => s.cards.some((c) => c.id === id);
  if (
    new Set(p.order).size !== 8 ||
    !p.order.every(has) ||
    !Object.keys(p.answers).every(has) ||
    !Object.keys(p.flipped).every(has) ||
    !p.wrong.every(has)
  )
    return false;
  if (p.practice?.cardId && !has(p.practice.cardId)) return false;
  if (
    p.stage !== 'reading' &&
    s.cards.some(
      (c) =>
        p.answers[c.id]?.hour !== (Math.floor(c.minute / 60) % 12 || 12) ||
        p.answers[c.id]?.minute !== c.minute % 60,
    )
  )
    return false;
  if (
    p.stage === 'completed' &&
    [...s.cards].sort((a, b) => a.minute - b.minute).some((c, i) => p.order[i] !== c.id)
  )
    return false;
  return true;
}
export function emptyProgress(s: Pick<Student, 'cards'>): Progress {
  return {
    stage: 'reading',
    answers: {},
    order: s.cards.map((c) => c.id),
    flipped: {},
    wrong: [],
    solved: 0,
    practice: null,
  };
}
