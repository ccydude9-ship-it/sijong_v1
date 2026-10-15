import React, { useEffect, useRef, useState } from 'react';
import type {
  StudentSnapshot,
  PracticeQuestion,
  ClockTime,
} from '../../../../packages/contracts/src/index';
import { ClockFace } from '../components/ClockFace';
import { TimeInput } from '../components/TimeInput';
import { request, json } from '../api/client';
import { Lightbulb, ZoomIn, CheckCircle2 } from 'lucide-react';
export type PracticeDraft = {
  question: PracticeQuestion | null;
  answer: ClockTime | null;
  hint: 'none' | 'minute-hand' | 'zoom';
  correct: boolean;
  matchedCardId: string | null;
};
export function PracticeView({
  snapshot,
  draft,
  onDraft,
  onSolved,
  onSound,
}: {
  snapshot: StudentSnapshot;
  draft: PracticeDraft;
  onDraft: (v: PracticeDraft) => void;
  onSolved: (count: number) => void;
  onSound: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (draft.question || snapshot.phase !== 'active') return;
    const c = new AbortController();
    setBusy(true);
    request<PracticeQuestion>('/api/student/practice/next', {
      ...json('POST', {}),
      signal: c.signal,
    })
      .then((question) => onDraft({ ...draft, question }))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (mounted.current) setBusy(false);
      });
    return () => c.abort();
  }, [draft.question?.id, snapshot.phase]);
  async function check() {
    if (!draft.question || !draft.answer || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await request<{
        correct: boolean;
        matchedCardId: string | null;
        solvedCount: number;
      }>(`/api/student/practice/${draft.question.id}/check`, json('POST', draft.answer));
      if (!mounted.current) return;
      onDraft({ ...draft, correct: r.correct, matchedCardId: r.matchedCardId });
      onSolved(r.solvedCount);
      if (r.correct) onSound();
      else setError('다시 한번 읽어 볼까요?');
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : '연결을 확인해 주세요');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const card = snapshot.cards.find((c) => c.id === draft.matchedCardId);
  return (
    <section>
      <header className="page-heading">
        <span className="eyebrow">연습모드 · TICK TOCK</span>
        <h1>째깍! 지금 몇 시일까요?</h1>
        <p>바늘이 가리키는 시각을 읽어 봐요. 천천히 해도 괜찮아요.</p>
      </header>
      <div className="practice-layout">
        <div className="clock-panel panel">
          {draft.question ? (
            <ClockFace time={draft.question.clock} hint={draft.hint} />
          ) : (
            <p>새 시계를 만나고 있어요…</p>
          )}
          <div className="hint-buttons">
            <button className="ghost" onClick={() => onDraft({ ...draft, hint: 'minute-hand' })}>
              <Lightbulb size={16} />긴 바늘 보기
            </button>
            <button
              className="ghost"
              onClick={() => onDraft({ ...draft, hint: draft.hint === 'zoom' ? 'none' : 'zoom' })}
            >
              <ZoomIn size={16} />
              크게 보기
            </button>
          </div>
        </div>
        <div className="answer-panel panel">
          <span className="eyebrow">시각을 골라요</span>
          <TimeInput
            value={draft.answer}
            onChange={(answer) => {
              onDraft({ ...draft, answer });
              setError('');
            }}
            error={false}
            disabled={busy || draft.correct}
          />
          {draft.correct ? (
            <div className="positive-feedback" role="status">
              <CheckCircle2 size={24} />
              <h2>잘 읽었어요!</h2>
              {card && <img src={`/api/images/${card.imageId}`} alt={card.title} />}
              <button
                className="primary"
                onClick={() => {
                  setError('');
                  onDraft({
                    question: null,
                    answer: null,
                    hint: 'none',
                    correct: false,
                    matchedCardId: null,
                  });
                }}
              >
                다음 시계 만나기
              </button>
            </div>
          ) : (
            <>
              <button
                className="primary confirm-button"
                disabled={busy || !draft.answer || !draft.question || snapshot.phase !== 'active'}
                onClick={() => void check()}
              >
                {busy ? '확인하는 중…' : '확인하기'}
              </button>
              {error && (
                <p className="practice-feedback" role="status">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <p className="subtle center">
        오늘 {snapshot.solvedCount}개의 시계를 읽었어요. 문제는 계속 만날 수 있어요!
      </p>
    </section>
  );
}
