import React from 'react';
import type { Card } from '../../../../packages/contracts/src/index';
import { toClockTime } from '../../../../packages/domain/src/index';
import { ClockFace } from './ClockFace';
import { RotateCw } from 'lucide-react';
export function ActivityCard({
  card,
  flipped,
  onFlip,
}: {
  card: Card;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <button
      className={`activity-face ${flipped ? 'flipped' : ''}`}
      aria-label={`${card.title} 카드 뒤집기`}
      aria-pressed={flipped}
      onClick={onFlip}
    >
      <span className="card-period">{card.minuteOfDay < 720 ? '오전' : '오후'}</span>
      {flipped ? (
        <ClockFace time={toClockTime(card.minuteOfDay)} />
      ) : (
        <img src={`/api/images/${card.imageId}`} alt={card.title} />
      )}
      <span className="activity-title">{card.title}</span>
      <small>
        <RotateCw size={12} />
        {flipped ? '그림 보기' : '뒤집어서 시계 보기'}
      </small>
    </button>
  );
}
