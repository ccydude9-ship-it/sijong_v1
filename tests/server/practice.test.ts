import { afterEach, it, expect } from 'vitest';
import { createServerFixture, studentActor } from '../helpers/server';
import { PracticeService } from '../../apps/server/src/practice/service';
let f: Awaited<ReturnType<typeof createServerFixture>>;
afterEach(async () => f?.cleanup());
async function setup() {
  f = await createServerFixture();
  f.store.lessons.set({ ...f.store.lessons.get(f.lessonId)!, phase: 'active' });
  return studentActor(f);
}
function post(s: ReturnType<typeof studentActor>, path: string, body: object = {}) {
  return f.client
    .post(path)
    .set('Cookie', s.cookie)
    .set('Origin', f.config.publicOrigin)
    .set('X-CSRF-Token', s.csrf)
    .send(body);
}
it('samples_all_24_faces', async () => {
  const s = await setup();
  let n = 0;
  const service = new PracticeService(f.store, () => n++ % 24),
    session = f.store.sessions.list()[0],
    seen = new Set();
  for (let i = 0; i < 24; i++) {
    const q = service.next(session);
    seen.add(`${q.clock.hour}:${q.clock.minute}`);
    service.check(session, q.id, q.clock);
  }
  expect(seen.size).toBe(24);
});
it('unsolved_question_is_reused', async () => {
  const s = await setup();
  const a = await post(s, '/api/student/practice/next'),
    b = await post(s, '/api/student/practice/next');
  expect(a.status).toBe(200);
  expect(b.body).toEqual(a.body);
});
it('wrong_answer_does_not_expose_target_in_feedback', async () => {
  const s = await setup(),
    q = await post(s, '/api/student/practice/next');
  expect(q.status).toBe(200);
  const r = await post(s, `/api/student/practice/${q.body.id}/check`, {
    hour: (q.body.clock.hour % 12) + 1,
    minute: q.body.clock.minute,
  });
  expect(r.status).toBe(200);
  expect(r.body.correct).toBe(false);
  expect(r.body).not.toHaveProperty('clock');
  expect(r.body).not.toHaveProperty('hour');
});
it('solved_answer_counts_once', async () => {
  const s = await setup(),
    q = await post(s, '/api/student/practice/next');
  for (let i = 0; i < 2; i++) {
    const r = await post(s, `/api/student/practice/${q.body.id}/check`, q.body.clock);
    expect(r.body.solvedCount).toBe(1);
  }
});
it('no_matching_card_still_succeeds', async () => {
  await setup();
  const session = f.store.sessions.list()[0],
    service = new PracticeService(f.store, () => 0),
    q = service.next(session);
  expect(service.check(session, q.id, q.clock)).toMatchObject({
    correct: true,
    matchedCardId: null,
  });
});
it('matching_am_pm_selects_earlier_card', async () => {
  await setup();
  const session = f.store.sessions.list()[0],
    service = new PracticeService(f.store, () => 12);
  const cards = f.store.students.cards(session.studentId!);
  f.store.students.setCard({ ...cards[1], minuteOfDay: 1140 });
  const q = service.next(session);
  expect(q.clock).toEqual({ hour: 7, minute: 0 });
  expect(service.check(session, q.id, q.clock).matchedCardId).toBe(cards[0].id);
});
it('active_lesson_allows_practice_without_mode_lock', async () => {
  const s = await setup();
  expect((await post(s, '/api/student/practice/next')).status).toBe(200);
  f.store.lessons.set({ ...f.store.lessons.get(f.lessonId)!, phase: 'ended' });
  expect((await post(s, '/api/student/practice/next')).status).toBe(409);
});
it('another_student_question_is_forbidden', async () => {
  const s = await setup(),
    q = await post(s, '/api/student/practice/next'),
    other = studentActor(f, f.store.students.list(f.lessonId)[1].id);
  expect(
    (await post(other, `/api/student/practice/${q.body.id}/check`, { hour: 1, minute: 0 })).status,
  ).toBe(403);
});
it('no_ten_question_limit', async () => {
  await setup();
  const session = f.store.sessions.list()[0],
    service = new PracticeService(f.store);
  for (let i = 0; i < 25; i++) {
    const q = service.next(session);
    expect(service.check(session, q.id, q.clock).solvedCount).toBe(i + 1);
  }
});
