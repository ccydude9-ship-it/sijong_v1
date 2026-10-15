import React, { useCallback, useEffect, useState } from 'react';
import type { TeacherLesson } from '../../../../packages/contracts/src/index';
import { request, json, ApiError } from '../api/client';
import { StudentCardEditor } from './StudentCardEditor';
export function LessonSetup({
  lessonId,
  children,
  onDeleted,
}: {
  lessonId: string;
  children?: React.ReactNode;
  onDeleted?: () => void;
}) {
  const [lesson, setLesson] = useState<TeacherLesson | null>(null),
    [selected, setSelected] = useState(''),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [blockedEditors, setBlockedEditors] = useState<Record<string, boolean>>({});
  const editorStatus = useCallback((id: string, blocked: boolean) => {
    setBlockedEditors((current) =>
      current[id] === blocked ? current : { ...current, [id]: blocked },
    );
  }, []);
  const unfinished = Object.values(blockedEditors).some(Boolean);
  async function load() {
    const data = await request<TeacherLesson>(`/api/teacher/lessons/${lessonId}`);
    setLesson(data);
    setSelected((s) => s || data.students[0]?.id || '');
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [lessonId]);
  if (!lesson) return <p className="notice">{error || '수업을 불러오고 있어요…'}</p>;
  async function phase(target: 'active' | 'ended', confirmIncomplete = false) {
    if (target === 'active' && unfinished) {
      setError('변경한 학생 카드를 저장하거나 취소한 뒤 수업을 시작해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await request(
        `/api/teacher/lessons/${lessonId}/phase`,
        json('POST', {
          operationId: crypto.randomUUID(),
          expectedRevision: lesson!.revision,
          phase: target,
          confirmIncomplete,
        }),
      );
      await load();
    } catch (e) {
      if (e instanceof ApiError && (e.details as any)?.requiresConfirmation) {
        if (window.confirm('아직 끝내지 않은 학생이 있어요. 수업을 종료할까요?'))
          await phase(target, true);
      } else setError(e instanceof Error ? e.message : '다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="lesson-toolbar panel">
        <div>
          <span className={`status-dot ${lesson.phase}`} />
          <strong>
            {lesson.phase === 'preparing'
              ? '수업 준비 중'
              : lesson.phase === 'active'
                ? '함께 배우는 중'
                : '수업 종료'}
          </strong>
          <p className="subtle">학생 6명 · 학생마다 일과 카드 8장</p>
        </div>
        <div className="toolbar-actions">
          {lesson.phase !== 'ended' && (
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setError('');
                try {
                  const r = await request<{ code: string }>(
                    `/api/teacher/lessons/${lessonId}/code`,
                    json('POST', {}),
                  );
                  setCode(r.code);
                } catch (e) {
                  setError(e instanceof Error ? e.message : '다시 시도해 주세요');
                }
              }}
            >
              학급 코드 새로 발급
            </button>
          )}
          {lesson.phase === 'preparing' && (
            <button
              className="primary"
              disabled={busy || unfinished}
              onClick={() => void phase('active')}
            >
              수업 시작하기
            </button>
          )}
          {lesson.phase === 'active' && (
            <button className="secondary" disabled={busy} onClick={() => void phase('ended')}>
              수업 종료하기
            </button>
          )}
        </div>
      </div>
      {lesson.phase === 'preparing' && unfinished && (
        <p className="notice" role="status">
          변경한 학생 카드를 저장하거나 취소한 뒤 수업을 시작해 주세요. 그림을 등록하거나 저장하는
          중에는 잠시 기다려 주세요.
        </p>
      )}
      {code && (
        <div className="notice code-panel">
          <strong>
            학급 접속 코드 <output>{code}</output>
          </strong>
          <p>
            각 태블릿에서 이 코드로 연결해 주세요. 새 코드 발급 시 기존 기기는 다시 연결해야 해요.
          </p>
          <button className="ghost" onClick={() => setCode('')}>
            코드 숨기기
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {children}
      <div className="teacher-tabs" role="tablist" aria-label="학생 카드 준비">
        {lesson.students.map((s) => (
          <button
            role="tab"
            aria-selected={selected === s.id}
            className={selected === s.id ? 'selected' : ''}
            key={s.id}
            onClick={() => setSelected(s.id)}
          >
            {s.displayName} {s.distinction}
          </button>
        ))}
      </div>
      {lesson.students.map((s) => (
        <div key={s.id} hidden={selected !== s.id}>
          <StudentCardEditor
            student={s}
            disabled={busy || lesson.phase !== 'preparing'}
            onStatusChange={editorStatus}
            onSave={async (body) => {
              const updated = await request<TeacherLesson>(
                `/api/teacher/lessons/${lessonId}/students/${s.slot}`,
                json('PUT', body),
              );
              setLesson(updated);
            }}
            onUpload={async (file) => {
              const r = await request<{ imageId: string }>(
                `/api/teacher/lessons/${lessonId}/students/${s.slot}/images`,
                { method: 'POST', headers: { 'Content-Type': file.type }, body: file },
              );
              return r.imageId;
            }}
          />
        </div>
      ))}
      {lesson.phase !== 'active' && (
        <button
          className="ghost danger"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm('이 수업의 카드와 기록을 삭제할까요? 되돌릴 수 없어요.')) return;
            setBusy(true);
            try {
              await request(`/api/teacher/lessons/${lessonId}`, { method: 'DELETE' });
              onDeleted?.();
            } catch (e) {
              setError(e instanceof Error ? e.message : '삭제하지 못했습니다');
            } finally {
              setBusy(false);
            }
          }}
        >
          이 수업 삭제
        </button>
      )}
    </div>
  );
}
