import { Router } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AuthService } from '../auth/service';
import { requireRole } from '../auth/middleware';
import { hashValue } from '../auth/crypto';
import { fail } from '../errors';
import {
  classroomSchema,
  progressSchema,
  validProgress,
  emptyProgress,
  type Classroom,
} from './schema';

type State = {
  code: string;
  epoch: string;
  lessonId: string;
  data: Classroom;
  authIds: Record<string, string>;
  revisions: Record<string, number>;
  updated: Record<string, number>;
};
const key = 'live-classroom-v1';
export function liveRoutes(auth: AuthService) {
  const r = Router(),
    store = auth.store,
    presence = new Map<string, { at: number; screen: string }>();
  const load = () => {
    const raw = store.settings.get(key);
    if (!raw) return fail(404, '선생님이 먼저 수업을 열어 주세요');
    return JSON.parse(raw) as State;
  };
  const localId = (
    state: State,
    session: { role: string; studentId?: string; lessonId?: string },
  ) => {
    if (session.role !== 'teacher' && session.lessonId !== state.lessonId)
      fail(401, '새 교실 코드로 다시 연결해 주세요');
    return Object.keys(state.authIds).find((id) => state.authIds[id] === session.studentId);
  };
  const snapshot = (state: State, id?: string) => ({
    epoch: state.epoch,
    phase: state.data.phase,
    students: state.data.students
      .filter((s) => !id || s.id === id)
      .map((s) => ({
        id: s.id,
        progress: s.progress,
        revision: state.revisions[s.id],
        updatedAt: state.updated[s.id],
        connected: Date.now() - (presence.get(s.id)?.at || 0) < 15000,
        screen: presence.get(s.id)?.screen || '',
      })),
  });
  r.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  r.get('/info', (_req, res) => res.json({ enabled: true }));
  r.post('/setup', requireRole('teacher'), (req, res) => {
    const input = z
      .object({ data: classroomSchema, replace: z.boolean().default(false) })
      .strict()
      .parse(req.body);
    if (store.settings.get(key) && !input.replace)
      fail(409, '이미 열린 수업이 있습니다. 기존 수업에 연결하거나 새 자료로 교체해 주세요');
    const code = String(randomInt(100000, 1000000));
    const state = store.transaction(() => {
      let lesson = store.lessons.list().find((l) => l.phase !== 'ended');
      if (!lesson) {
        lesson = {
          id: randomUUID(),
          phase: 'active',
          revision: 0,
          demo: false,
          createdAt: new Date().toISOString(),
        };
        store.lessons.create(lesson);
      }
      store.lessons.set({
        ...lesson,
        phase: input.data.phase,
        codeHash: auth.codeHash(code),
        revision: lesson.revision + 1,
      });
      const students = store.students.list(lesson.id);
      const state: State = {
        code,
        epoch: randomUUID(),
        lessonId: lesson.id,
        data: input.data,
        authIds: {},
        revisions: {},
        updated: {},
      };
      input.data.students.forEach((s, i) => {
        const existing = students.find((x) => x.slot === i),
          authId = existing?.id || randomUUID();
        store.students.set({
          id: authId,
          lessonId: lesson!.id,
          slot: i,
          displayName: s.name,
          distinction: s.distinction,
        });
        state.authIds[s.id] = authId;
        state.revisions[s.id] = 0;
        state.updated[s.id] = Date.now();
      });
      store.settings.set(key, JSON.stringify(state));
      return state;
    });
    auth.revokeLessonSessions(state.lessonId);
    presence.clear();
    res.json({ code, epoch: state.epoch });
  });
  r.post('/phase', requireRole('teacher'), (req, res) => {
    const { phase } = z
      .object({ phase: z.enum(['active', 'ended']) })
      .strict()
      .parse(req.body);
    const state = load();
    state.data.phase = phase;
    const lesson = store.lessons.get(state.lessonId)!;
    store.transaction(() => {
      store.settings.set(key, JSON.stringify(state));
      store.lessons.set({ ...lesson, phase, revision: lesson.revision + 1 });
    });
    res.json({ phase });
  });
  r.get('/state', requireRole('teacher', 'student', 'classroom'), (_req, res) => {
    const state = load(),
      session = res.locals.session,
      id = localId(state, session);
    if (session.role === 'student' && !id) fail(403, '이름을 다시 골라 주세요');
    const data =
      session.role === 'teacher'
        ? state.data
        : {
            ...state.data,
            students: state.data.students.map((s) =>
              s.id === id ? s : { ...s, progress: emptyProgress(s) },
            ),
          };
    res.json({
      data,
      code: session.role === 'teacher' ? state.code : undefined,
      studentId: id || null,
      authIds: state.authIds,
      ...snapshot(state, session.role === 'student' ? id : undefined),
      ...(session.role === 'classroom' ? { students: [] } : {}),
    });
  });
  r.get('/progress', requireRole('teacher', 'student'), (req, res) => {
    const state = load(),
      session = res.locals.session,
      id = localId(state, session);
    if (session.role === 'student') {
      if (!id) fail(403, '이름을 다시 골라 주세요');
      const screen = z
        .enum(['menu', 'practice', 'practical', 'names', 'title', 'teacher-share', 'teacher'])
        .catch('menu')
        .parse(req.query.screen);
      presence.set(id, { at: Date.now(), screen });
    }
    res.json(snapshot(state, session.role === 'student' ? id : undefined));
  });
  r.put('/progress', requireRole('student'), (req, res) => {
    const input = z
      .object({
        epoch: z.string().uuid(),
        expectedRevision: z.number().int().min(0),
        operationId: z.string().uuid(),
        progress: progressSchema,
        screen: z
          .enum(['menu', 'practice', 'practical', 'names', 'title', 'teacher-share', 'teacher'])
          .default('menu'),
      })
      .strict()
      .parse(req.body);
    const state = load(),
      id = localId(state, res.locals.session);
    if (!id) fail(403, '이름을 다시 골라 주세요');
    if (state.epoch !== input.epoch) fail(409, '수업 자료가 바뀌었어요. 다시 연결해 주세요');
    const scope = 'live:' + state.epoch + ':' + id,
      hash = hashValue(JSON.stringify(input));
    const result = store.transaction(() => {
      const replay = store.operations.find(scope, input.operationId);
      if (replay) {
        if (replay.request_hash !== hash) fail(409, '같은 요청 번호로 다른 답을 보낼 수 없습니다');
        return JSON.parse(replay.response);
      }
      if (state.data.phase !== 'active') fail(409, '수업이 끝났어요');
      if (state.revisions[id] !== input.expectedRevision)
        fail(409, '같은 이름으로 다른 기기에서 저장한 기록이 있어요', snapshot(state, id));
      const student = state.data.students.find((s) => s.id === id)!;
      if (!validProgress(student, input.progress)) fail(400, '이 학생의 카드와 답을 확인해 주세요');
      student.progress = input.progress;
      state.revisions[id]++;
      state.updated[id] = Date.now();
      store.settings.set(key, JSON.stringify(state));
      const result = { revision: state.revisions[id], updatedAt: state.updated[id] };
      store.operations.set(scope, input.operationId, hash, result);
      return result;
    });
    presence.set(id, { at: Date.now(), screen: input.screen });
    res.json(result);
  });
  return r;
}
