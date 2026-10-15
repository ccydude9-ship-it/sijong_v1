import type { StudentSnapshot, TeacherSnapshot } from './models';
export type SnapshotEvent = { type: 'snapshot'; data: StudentSnapshot | TeacherSnapshot };
