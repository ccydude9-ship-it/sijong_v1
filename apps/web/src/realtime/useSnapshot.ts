import { useEffect, useState } from 'react';
import type { StudentSnapshot, TeacherSnapshot } from '../../../../packages/contracts/src/index';
import { snapshotSchema, teacherSnapshotSchema } from '../../../../packages/contracts/src/index';
import { mergeStudentSnapshot } from './merge';
export function useSnapshot(scope: {
  role: 'student' | 'teacher';
  lessonId: string;
  studentId?: string;
  epoch: number;
}) {
  const [snapshot, setSnapshot] = useState<StudentSnapshot | TeacherSnapshot | null>(null),
    [connected, setConnected] = useState(false);
  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setConnected(false);
    const es = new EventSource(
      `/api/events${scope.role === 'teacher' ? `?lessonId=${encodeURIComponent(scope.lessonId)}` : ''}`,
    );
    es.onopen = () => {
      if (active) setConnected(true);
    };
    es.onerror = () => {
      if (active) setConnected(false);
    };
    const listener = (event: MessageEvent) => {
      if (!active) return;
      try {
        const data =
          scope.role === 'teacher'
            ? teacherSnapshotSchema.parse(JSON.parse(event.data))
            : snapshotSchema.parse(JSON.parse(event.data));
        if (data.lessonId !== scope.lessonId) return;
        if (
          scope.role === 'student' &&
          (!('student' in data) || data.student.id !== scope.studentId)
        )
          return;
        setSnapshot((previous) => {
          if (scope.role === 'student' && previous && 'progress' in previous && 'progress' in data)
            return mergeStudentSnapshot(previous, data);
          if (previous && previous.phaseRevision > data.phaseRevision) return previous;
          return data;
        });
      } catch {
        setConnected(false);
      }
    };
    es.addEventListener('snapshot', listener);
    return () => {
      active = false;
      es.removeEventListener('snapshot', listener);
      es.close();
    };
  }, [scope.role, scope.lessonId, scope.studentId, scope.epoch]);
  return { snapshot, connected };
}
