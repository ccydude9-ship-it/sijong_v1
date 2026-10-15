import React, { useEffect, useState } from 'react';
import type { LessonPhase } from '../../../../packages/contracts/src/index';
import { request } from '../api/client';
export function LessonHistory({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [lessons, setLessons] = useState<{ id: string; phase: LessonPhase; createdAt?: string }[]>(
      [],
    ),
    [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    request<typeof lessons>('/api/teacher/lessons', { signal: abort.signal })
      .then((ls) => {
        setLessons(ls);
        setError('');
        if (!ls.some((l) => l.id === selectedId)) onSelect(ls[0]?.id || '');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => abort.abort();
  }, [selectedId]);
  return (
    <div className="history-select">
      <label>
        수업 기록
        <select
          aria-label="수업 기록"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          {lessons.map((l, i) => (
            <option key={l.id} value={l.id}>
              수업 {lessons.length - i} ·{' '}
              {l.phase === 'preparing' ? '준비 중' : l.phase === 'active' ? '진행 중' : '종료'}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
