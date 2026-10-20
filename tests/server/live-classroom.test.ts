import request from 'supertest';
import { openStore } from '../../apps/server/src/db';
import { createApp } from '../../apps/server/src/app';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { createServerFixture, loginTeacher, teacherRequest, studentActor } from '../helpers/server';
import { classroomSchema, emptyProgress, type Classroom } from '../../apps/server/src/live/schema';
let f: Awaited<ReturnType<typeof createServerFixture>>;
beforeEach(async () => {
  f = await createServerFixture();
});
afterEach(async () => {
  await f.cleanup();
});
export function fixtureClassroom(): Classroom {
  const students = Array.from({ length: 6 }, (_, i) => {
    const cards = Array.from({ length: 8 }, (_, j) => ({
      id: `s${i}c${j}`,
      title: '예시 ' + j,
      minute: 420 + j * 60,
      image: '',
      scene: j,
    }));
    return {
      id: 's' + i,
      name: '학생 ' + i,
      distinction: '',
      photo: '',
      cards,
      progress: emptyProgress({ cards }),
    };
  });
  return { version: 1, phase: 'active', students };
}
describe('standalone classroom live API', () => {
  it('streams unfinished, isolated student progress with revision protection and replay', async () => {
    const teacher = await loginTeacher(f),
      data = fixtureClassroom();
    const setup = await teacherRequest(f, teacher, 'post', '/api/live/setup', { data });
    expect(setup.status).toBe(200);
    const state = await teacherRequest(f, teacher, 'get', '/api/live/state');
    expect(state.status).toBe(200);
    const a = studentActor(f, state.body.authIds.s0),
      b = studentActor(f, state.body.authIds.s1);
    const p = { ...data.students[0].progress, answers: { s0c0: { hour: 7, minute: null } } };
    const command = {
      epoch: setup.body.epoch,
      expectedRevision: 0,
      operationId: crypto.randomUUID(),
      progress: p,
      screen: 'practical',
    };
    expect((await teacherRequest(f, a, 'put', '/api/live/progress', command)).status).toBe(200);
    expect((await teacherRequest(f, a, 'put', '/api/live/progress', command)).body.revision).toBe(
      1,
    );
    expect(
      (
        await teacherRequest(f, a, 'put', '/api/live/progress', {
          ...command,
          operationId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(409);
    expect((await teacherRequest(f, b, 'put', '/api/live/progress', command)).status).toBe(400);
    expect(
      (await teacherRequest(f, a, 'post', '/api/live/setup', { data, replace: true })).status,
    ).toBe(403);
    const all = await teacherRequest(f, teacher, 'get', '/api/live/progress');
    expect(all.body.students[0].progress.answers.s0c0).toEqual({ hour: 7, minute: null });
    expect(all.body.students[0].connected).toBe(true);
    expect(all.body.students[1].progress.answers).toEqual({});
    const own = await teacherRequest(f, a, 'get', '/api/live/progress');
    expect(own.body.students).toHaveLength(1);
    const loaded = await teacherRequest(f, b, 'get', '/api/live/state');
    expect(loaded.body.data.students[0].progress.answers).toEqual({});
    expect((await f.client.get('/api/live/state')).status).toBe(401);
  });
  it('validates complete progress and rejects missing cards or malformed image data', () => {
    const data = fixtureClassroom();
    data.students[0].progress.stage = 'completed';
    expect(classroomSchema.safeParse(data).success).toBe(false);
    data.students[0].progress.stage = 'reading';
    data.students[0].photo = 'javascript:alert(1)';
    expect(classroomSchema.safeParse(data).success).toBe(false);
  });
  it('requires explicit roster replacement and invalidates existing student sessions', async () => {
    const teacher = await loginTeacher(f),
      data = fixtureClassroom();
    await teacherRequest(f, teacher, 'post', '/api/live/setup', { data });
    const state = await teacherRequest(f, teacher, 'get', '/api/live/state');
    const a = studentActor(f, state.body.authIds.s0);
    expect((await teacherRequest(f, teacher, 'post', '/api/live/setup', { data })).status).toBe(
      409,
    );
    expect(
      (await teacherRequest(f, teacher, 'post', '/api/live/setup', { data, replace: true })).status,
    ).toBe(200);
    expect((await teacherRequest(f, a, 'get', '/api/live/progress')).status).toBe(401);
  });
});

it('retains prepared cards and unfinished progress after reopening the database', async () => {
  const teacher = await loginTeacher(f),
    data = fixtureClassroom();
  const setup = await teacherRequest(f, teacher, 'post', '/api/live/setup', { data });
  const state = await teacherRequest(f, teacher, 'get', '/api/live/state');
  const student = studentActor(f, state.body.authIds.s0);
  const command = {
    epoch: setup.body.epoch,
    expectedRevision: 0,
    operationId: crypto.randomUUID(),
    progress: { ...data.students[0].progress, answers: { s0c0: { hour: 7, minute: null } } },
  };
  expect((await teacherRequest(f, student, 'put', '/api/live/progress', command)).status).toBe(200);
  f.store.close();
  const restored = openStore(f.config),
    app = createApp({ store: restored, config: f.config });
  try {
    const result = await request(app).get('/api/live/state').set('Cookie', teacher.cookie);
    expect(result.status).toBe(200);
    expect(result.body.data.students[0].cards).toEqual(data.students[0].cards);
    expect(result.body.data.students[0].progress.answers.s0c0).toEqual({ hour: 7, minute: null });
    const replay = await request(app)
      .put('/api/live/progress')
      .set('Cookie', student.cookie)
      .set('Origin', f.config.publicOrigin)
      .set('X-CSRF-Token', student.csrf)
      .send(command);
    expect(replay.status).toBe(200);
    expect(replay.body.revision).toBe(1);
  } finally {
    app.locals.hub.close();
    restored.close();
  }
});

it('keeps concurrent progress from all six tablets separate', async () => {
  const teacher = await loginTeacher(f),
    data = fixtureClassroom();
  const setup = await teacherRequest(f, teacher, 'post', '/api/live/setup', { data });
  const state = await teacherRequest(f, teacher, 'get', '/api/live/state');
  const results = await Promise.all(
    data.students.map((s, i) => {
      const actor = studentActor(f, state.body.authIds[s.id]);
      return teacherRequest(f, actor, 'put', '/api/live/progress', {
        epoch: setup.body.epoch,
        expectedRevision: 0,
        operationId: crypto.randomUUID(),
        progress: { ...s.progress, answers: { [s.cards[0].id]: { hour: i + 1, minute: null } } },
      });
    }),
  );
  expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
  const snapshot = await teacherRequest(f, teacher, 'get', '/api/live/progress');
  for (let i = 0; i < 6; i++) {
    expect(snapshot.body.students[i].progress.answers).toEqual({
      ['s' + i + 'c0']: { hour: i + 1, minute: null },
    });
    expect(snapshot.body.students[i].revision).toBe(1);
  }
});
