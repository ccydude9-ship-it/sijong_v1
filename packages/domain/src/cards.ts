import { toClockTime } from './time';
export type Card = {
  id: string;
  studentId: string;
  title: string;
  kind: 'wake' | 'sleep' | 'custom';
  imageId: string;
  minuteOfDay: number;
};
export function validateCards(cards: Card[]): { cardId?: string; code: string }[] {
  const errors: { cardId?: string; code: string }[] = [];
  if (cards.length !== 8) errors.push({ code: 'eight-cards' });
  if (
    new Set(cards.map((c) => c.id)).size !== cards.length ||
    new Set(cards.map((c) => c.studentId)).size !== 1
  )
    errors.push({ code: 'card-identity' });
  if (new Set(cards.map((c) => c.minuteOfDay)).size !== cards.length)
    errors.push({ code: 'duplicate-time' });
  for (const card of cards) {
    try {
      toClockTime(card.minuteOfDay);
    } catch {
      errors.push({ cardId: card.id, code: 'invalid-time' });
    }
    if (!card.title.trim() || card.title.length > 60 || !card.imageId)
      errors.push({ cardId: card.id, code: 'missing-card-data' });
  }
  const wakes = cards.filter((c) => c.kind === 'wake'),
    sleeps = cards.filter((c) => c.kind === 'sleep');
  if (wakes.length !== 1 || sleeps.length !== 1 || wakes[0]?.minuteOfDay >= sleeps[0]?.minuteOfDay)
    errors.push({ code: 'wake-before-sleep' });
  return errors;
}
