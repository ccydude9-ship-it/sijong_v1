import React, { useState } from 'react';
import { Star, ArrowRight } from 'lucide-react';
import type { RosterItem } from '../../../../packages/contracts/src/index';
export function NamePicker({
  students,
  onStart,
}: {
  students: RosterItem[];
  onStart: (id: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  return (
    <main className="page name-page">
      <header className="page-heading">
        <span className="eyebrow">STEP 01 · PLAYER SELECT</span>
        <h1>
          내 이름을 골라요<span className="heading-star">✦</span>
        </h1>
        <p>반가워요! 오늘의 주인공은 누구인가요?</p>
      </header>
      <div className="name-grid">
        {students.map((s, i) => (
          <button
            className={`name-tile tone-${i}`}
            key={s.id}
            aria-label={`${s.displayName}${s.distinction ? ` ${s.distinction}` : ''}`}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError('');
              try {
                await onStart(s.id);
              } catch (e) {
                setError(e instanceof Error ? e.message : '다시 골라 주세요');
              } finally {
                setPending(false);
              }
            }}
          >
            <span className="player-number">PLAYER {String(i + 1).padStart(2, '0')}</span>
            <span className="avatar" aria-hidden="true">
              <Star size={46} strokeWidth={1.8} />
              <span>{['✿', '☀', '☁', '✦', '♧', '☾'][i]}</span>
            </span>
            <span className="student-label">
              {s.displayName}
              {s.distinction ? ` ${s.distinction}` : ''}
            </span>
            <span className="tile-go" aria-hidden="true">
              <ArrowRight size={19} />
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <p className="subtle center">내 이름을 누르면 나만의 일과 카드가 기다리고 있어요.</p>
    </main>
  );
}
