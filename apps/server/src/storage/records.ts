import type {
  Card,
  LessonPhase,
  RosterItem,
  Session,
  StudentProgress,
  ClockTime,
} from '../../../../packages/contracts/src/index';
export type LessonRecord = {
  id: string;
  phase: LessonPhase;
  revision: number;
  demo: boolean;
  codeHash?: string;
  createdAt?: string;
  endedAt?: string;
};
export type StudentRecord = RosterItem & { lessonId: string; slot: number };
export type ImageRecord = { id: string; file: string; mime: string; ownerId: string; size: number };
export type SessionRecord = Session & { tokenHash: string; csrfToken: string };
export type PracticeRecord = { id: string; studentId: string; clock: ClockTime; solved: boolean };
export type { Card, StudentProgress };
