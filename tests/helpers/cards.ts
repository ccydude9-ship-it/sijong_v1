import type { Card } from '../../packages/domain/src/index';
export function makeValidCards(studentId = 's1'): Card[] {
  return [420, 450, 480, 720, 900, 1080, 1170, 1230].map((minuteOfDay, i) => ({
    id: `c${i + 1}`,
    studentId,
    title: `예시 일과 ${i + 1}`,
    kind: i === 0 ? 'wake' : i === 7 ? 'sleep' : 'custom',
    imageId: `art${i}`,
    minuteOfDay,
  }));
}
