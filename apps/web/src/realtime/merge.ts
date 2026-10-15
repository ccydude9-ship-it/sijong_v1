import type { StudentSnapshot } from '../../../../packages/contracts/src/index';
export function mergeStudentSnapshot(
  current: StudentSnapshot,
  incoming: StudentSnapshot,
): StudentSnapshot {
  if (current.lessonId !== incoming.lessonId || current.student.id !== incoming.student.id)
    return current;
  const phaseNew = incoming.phaseRevision >= current.phaseRevision,
    progressNew = incoming.progress.revision >= current.progress.revision;
  return {
    ...(phaseNew && progressNew ? incoming : current),
    phase: phaseNew ? incoming.phase : current.phase,
    phaseRevision: Math.max(current.phaseRevision, incoming.phaseRevision),
    progress: progressNew ? incoming.progress : current.progress,
    solvedCount: Math.max(current.solvedCount, incoming.solvedCount),
  };
}
