import { LessonHistory } from './teacher/LessonHistory';
import React, { useEffect, useState } from 'react';
import { Dashboard } from './teacher/Dashboard';
import { StudentWorkspace } from './student/StudentWorkspace';
import type {
  RosterItem,
  StudentSnapshot,
  StudentMode,
} from '../../../packages/contracts/src/index';
import { useSession } from './auth/SessionProvider';
import { TitleScreen } from './student/TitleScreen';
import { NamePicker } from './auth/NamePicker';
import { ModeMenu } from './student/ModeMenu';
import { TeacherLogin } from './auth/TeacherLogin';
import { DeviceConnect } from './auth/DeviceConnect';
import { LessonSetup } from './teacher/LessonSetup';
import { request, json } from './api/client';
export function App() {
  const auth = useSession(),
    [page, setPage] = useState('title'),
    [roster, setRoster] = useState<RosterItem[]>([]),
    [snapshot, setSnapshot] = useState<StudentSnapshot | null>(null),
    [lessonId, setLessonId] = useState(''),
    [error, setError] = useState(''),
    [mode, setMode] = useState<StudentMode | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    if (page === 'names')
      void request<RosterItem[]>('/api/classroom/students', { signal: abort.signal })
        .then(setRoster)
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    if (page === 'student')
      void request<StudentSnapshot>('/api/student/state', { signal: abort.signal })
        .then(setSnapshot)
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    if (page === 'teacher' && auth.session?.role === 'teacher')
      void request<{ id: string }[]>('/api/teacher/lessons', { signal: abort.signal })
        .then((ls) => setLessonId(ls[0]?.id || ''))
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    return () => abort.abort();
  }, [page, auth.epoch, auth.session?.id]);
  useEffect(() => {
    if (page === 'starting' && !auth.loading)
      setPage(auth.session && auth.session.role !== 'teacher' ? 'names' : 'device');
  }, [page, auth.loading, auth.session?.id]);
  if (page === 'title')
    return <TitleScreen onStart={() => setPage('starting')} onTeacher={() => setPage('teacher')} />;
  if (page === 'device')
    return <DeviceConnect onDone={() => setPage('names')} onBack={() => setPage('title')} />;
  if (page === 'teacher') {
    if (auth.session?.role !== 'teacher')
      return <TeacherLogin onDone={() => setPage('teacher')} onBack={() => setPage('title')} />;
    return (
      <main className="page teacher-page">
        <header className="student-top">
          <div>
            <span className="eyebrow">TEACHER'S ROOM</span>
            <h1>우리 반의 하루</h1>
          </div>
          <button
            className="ghost"
            onClick={async () => {
              await auth.logout();
              setPage('title');
            }}
          >
            나가기
          </button>
        </header>
        {error && <p role="alert">{error}</p>}
        <LessonHistory selectedId={lessonId} onSelect={setLessonId} />
        {lessonId ? (
          <LessonSetup key={lessonId} lessonId={lessonId} onDeleted={() => setLessonId('')}>
            <Dashboard key={`dashboard-${lessonId}`} lessonId={lessonId} />
          </LessonSetup>
        ) : (
          <p>등록된 수업이 없어요.</p>
        )}
        <button
          className="secondary"
          onClick={async () => {
            try {
              const r = await request<{ id: string }>('/api/teacher/lessons', json('POST', {}));
              setLessonId(r.id);
            } catch (e) {
              setError(e instanceof Error ? e.message : '다시 시도해 주세요');
            }
          }}
        >
          새 수업 준비하기
        </button>
      </main>
    );
  }
  if (page === 'names')
    return (
      <>
        <NamePicker
          students={roster}
          onStart={async (id) => {
            await auth.selectStudent(id);
            setSnapshot(null);
            setMode(null);
            setPage('student');
          }}
        />
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </>
    );
  if (error)
    return (
      <main className="page">
        <p className="notice error" role="alert">
          {error}
        </p>
        <button className="primary" onClick={() => setPage('title')}>
          처음으로
        </button>
      </main>
    );
  if (!snapshot)
    return (
      <main className="page">
        <p>나만의 하루를 불러오고 있어요…</p>
      </main>
    );
  return (
    <StudentWorkspace
      key={`${auth.epoch}:${snapshot.student.id}`}
      snapshot={snapshot}
      onChangeName={async () => {
        await auth.resetStudent();
        setSnapshot(null);
        setPage('names');
      }}
    />
  );
}
