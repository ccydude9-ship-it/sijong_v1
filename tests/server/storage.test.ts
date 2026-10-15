import { afterEach, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../../apps/server/src/db';
import { seedDemo } from '../../apps/server/src/demo/seed';
import { validateCards } from '../../packages/domain/src/index';
let cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const f of cleanups) await f();
  cleanups = [];
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'sijong-'));
  let store = openStore({ dbPath: join(root, 'db.sqlite'), uploadDir: join(root, 'images') });
  cleanups.push(async () => {
    store.close();
    await rm(root, { recursive: true, force: true });
  });
  return {
    root,
    get store() {
      return store;
    },
    reopen() {
      store.close();
      store = openStore({ dbPath: join(root, 'db.sqlite'), uploadDir: join(root, 'images') });
    },
  };
}
it('reopens_saved_progress', async () => {
  const f = await fixture(),
    { lessonId } = await seedDemo(f.store),
    s = f.store.students.list(lessonId)[0];
  const p = f.store.progress.get(s.id);
  f.store.progress.set({ ...p, revision: 3 });
  f.reopen();
  expect(f.store.progress.get(s.id).revision).toBe(3);
});
it('rolls_back_failed_transaction', async () => {
  const f = await fixture();
  expect(() =>
    f.store.transaction(() => {
      f.store.lessons.create({ id: 'rollback', phase: 'preparing', revision: 0, demo: false });
      throw Error('fail');
    }),
  ).toThrow('fail');
  expect(f.store.lessons.get('rollback')).toBeUndefined();
});
it('migrations_are_repeatable', async () => {
  const f = await fixture();
  await seedDemo(f.store);
  f.reopen();
  expect(f.store.lessons.list()).toHaveLength(1);
});
it('seed_is_non_destructive', async () => {
  const f = await fixture();
  const a = await seedDemo(f.store),
    b = await seedDemo(f.store);
  expect(a.created).toBe(true);
  expect(b).toEqual({ ...a, created: false });
  expect(f.store.lessons.list()).toHaveLength(1);
});
it('seed_refuses_when_real_lesson_open', async () => {
  const f = await fixture();
  f.store.lessons.create({ id: 'real', phase: 'preparing', revision: 0, demo: false });
  await expect(seedDemo(f.store)).rejects.toThrow();
  expect(f.store.lessons.list()).toHaveLength(1);
});
it('demo_has_six_distinct_personal_sets', async () => {
  const f = await fixture(),
    { lessonId } = await seedDemo(f.store);
  const students = f.store.students.list(lessonId);
  expect(students).toHaveLength(6);
  const arts = new Set();
  for (const s of students) {
    const cards = f.store.students.cards(s.id);
    expect(cards).toHaveLength(8);
    expect(validateCards(cards)).toEqual([]);
    arts.add(cards[0].imageId);
  }
  expect(arts.size).toBe(6);
});
it('foreign_key_violation_is_observable', async () => {
  const f = await fixture();
  expect(() =>
    f.store.progress.set({
      studentId: 'missing',
      revision: 0,
      stage: 'reading',
      answers: {},
      order: [],
      completedAt: null,
      wrongTimeIds: [],
      wrongOrderIds: [],
    }),
  ).toThrow();
});
