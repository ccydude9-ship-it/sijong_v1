import React, { useState } from 'react';
import type { TeacherLesson, Card } from '../../../../packages/contracts/src/index';
import { toClockTime, toMinuteOfDay } from '../../../../packages/domain/src/index';
type Student = TeacherLesson['students'][number];
type Setup = { displayName: string; distinction: string; cards: Card[] };
export function StudentCardEditor({
  student,
  disabled,
  onSave,
  onUpload,
}: {
  student: Student;
  disabled: boolean;
  onSave: (setup: Setup) => Promise<void>;
  onUpload: (file: File) => Promise<string>;
}) {
  const [name, setName] = useState(student.displayName),
    [distinction, setDistinction] = useState(student.distinction),
    [cards, setCards] = useState(student.cards),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  function patch(id: string, changes: Partial<Card>) {
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }
  return (
    <section className="editor panel">
      <div className="form-row">
        <label>
          학생 이름
          <input
            aria-label="학생 이름"
            value={name}
            maxLength={30}
            disabled={disabled}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          같은 이름 구별하기
          <input
            value={distinction}
            maxLength={30}
            disabled={disabled}
            placeholder="필요할 때만 입력"
            onChange={(e) => setDistinction(e.target.value)}
          />
        </label>
      </div>
      <div className="card-editor-grid">
        {cards.map((c) => {
          const time = toClockTime(c.minuteOfDay),
            period = c.minuteOfDay < 720 ? 'am' : 'pm';
          return (
            <fieldset disabled={disabled || busy} key={c.id}>
              <img src={`/api/images/${c.imageId}`} alt={c.title} />
              <input
                aria-label="일과 이름"
                value={c.title}
                maxLength={60}
                onChange={(e) => patch(c.id, { title: e.target.value })}
              />
              <div className="form-row">
                <select
                  aria-label="오전·오후"
                  value={period}
                  onChange={(e) =>
                    patch(c.id, { minuteOfDay: toMinuteOfDay(time, e.target.value as 'am' | 'pm') })
                  }
                >
                  <option value="am">오전</option>
                  <option value="pm">오후</option>
                </select>
                <select
                  aria-label="시"
                  value={time.hour}
                  onChange={(e) =>
                    patch(c.id, {
                      minuteOfDay: toMinuteOfDay({ ...time, hour: Number(e.target.value) }, period),
                    })
                  }
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}시
                    </option>
                  ))}
                </select>
                <select
                  aria-label="분"
                  value={time.minute}
                  onChange={(e) =>
                    patch(c.id, {
                      minuteOfDay: toMinuteOfDay(
                        { ...time, minute: Number(e.target.value) as 0 | 30 },
                        period,
                      ),
                    })
                  }
                >
                  <option value="0">00분</option>
                  <option value="30">30분</option>
                </select>
              </div>
              <label className="upload-label">
                그림 바꾸기
                <input
                  type="file"
                  aria-label="그림 바꾸기"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBusy(true);
                    setError('');
                    try {
                      patch(c.id, { imageId: await onUpload(file) });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : '등록하지 못했어요');
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              <small>
                {c.kind === 'wake'
                  ? '필수 · 일어나기'
                  : c.kind === 'sleep'
                    ? '필수 · 잠자기'
                    : '자유 일과'}
              </small>
            </fieldset>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button
        className="primary"
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await onSave({ displayName: name, distinction, cards });
          } catch (e) {
            setError(e instanceof Error ? e.message : '저장하지 못했어요');
          } finally {
            setBusy(false);
          }
        }}
      >
        이 학생 저장
      </button>
    </section>
  );
}
