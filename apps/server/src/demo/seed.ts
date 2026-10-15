import { randomUUID, randomInt } from 'node:crypto';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Store } from '../db';
import type { StudentRecord, Card } from '../storage/records';
import { demoArtwork } from './artwork';
const names = ['별이', '하늘', '바다', '초록', '나무', '구름'];
const titles = [
  '일어나기',
  '아침 먹기',
  '학교 가기',
  '점심 먹기',
  '놀이터 가기',
  '저녁 먹기',
  '책 읽기',
  '잠자기',
];
export async function populateLesson(store: Store, lessonId: string) {
  const files: string[] = [];
  const students: { student: StudentRecord; cards: Card[] }[] = [];
  try {
    for (let slot = 0; slot < 6; slot++) {
      const studentId = randomUUID(),
        cards: Card[] = [];
      for (let i = 0; i < 8; i++) {
        const imageId = randomUUID(),
          file = `${imageId}.png`,
          bytes = await demoArtwork(slot, i);
        await writeFile(join(store.config.uploadDir, file), bytes, { mode: 0o600 });
        files.push(file);
        cards.push({
          id: randomUUID(),
          studentId,
          title: `${names[slot]}의 ${titles[i]}`,
          kind: i === 0 ? ('wake' as const) : i === 7 ? ('sleep' as const) : ('custom' as const),
          imageId,
          minuteOfDay: [420, 450, 480, 720, 900, 1080, 1170, 1230][i] + slot * 30,
        });
      }
      students.push({
        student: {
          id: studentId,
          lessonId,
          slot: slot + 1,
          displayName: names[slot],
          distinction: '',
        },
        cards,
      });
    }
    store.transaction(() => {
      for (const { student, cards } of students) {
        store.students.set(student);
        for (const c of cards) {
          const file = `${c.imageId}.png`;
          store.images.set({
            id: c.imageId,
            file,
            mime: 'image/png',
            ownerId: student.id,
            size: 0,
          });
          store.students.setCard(c);
        }
        const order = cards.map((c) => c.id);
        for (let i = 7; i > 0; i--) {
          const j = randomInt(i + 1);
          [order[i], order[j]] = [order[j], order[i]];
        }
        store.progress.set({
          studentId: student.id,
          revision: 0,
          stage: 'reading',
          answers: {},
          order,
          completedAt: null,
          wrongTimeIds: [],
          wrongOrderIds: [],
        });
      }
    });
  } catch (e) {
    for (const file of files) await rm(join(store.config.uploadDir, file), { force: true });
    throw e;
  }
}
export async function seedDemo(store: Store): Promise<{ lessonId: string; created: boolean }> {
  const open = store.lessons.list().find((l) => l.phase !== 'ended');
  if (open) {
    if (open.demo) return { lessonId: open.id, created: false };
    throw Error('진행 중인 실제 수업은 보존합니다. 먼저 종료해 주세요');
  }
  const lessonId = randomUUID();
  store.lessons.create({
    id: lessonId,
    phase: 'preparing',
    revision: 0,
    demo: true,
    createdAt: new Date().toISOString(),
  });
  try {
    await populateLesson(store, lessonId);
  } catch (e) {
    store.run('DELETE FROM lessons WHERE id=?', lessonId);
    throw e;
  }
  return { lessonId, created: true };
}
