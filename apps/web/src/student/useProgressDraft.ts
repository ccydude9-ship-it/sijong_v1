import { useEffect, useRef, useState } from 'react';
import type {
  StudentSnapshot,
  StudentProgress,
  ClockTime,
  ProgressCommand,
} from '../../../../packages/contracts/src/index';
import { request, json, ApiError } from '../api/client';
export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error' | 'conflict';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function useProgressDraft(snapshot: StudentSnapshot) {
  const [progress, setProgress] = useState(snapshot.progress),
    [status, setStatus] = useState<SaveStatus>('saved'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const draft = useRef(progress),
    confirmed = useRef(snapshot.progress),
    lesson = useRef({
      id: snapshot.lessonId,
      phase: snapshot.phase,
      revision: snapshot.phaseRevision,
    }),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    mounted = useRef(true),
    pending = useRef<ProgressCommand | null>(null),
    conflict = useRef<StudentSnapshot | null>(null);
  const changed = () =>
    !same(draft.current.answers, confirmed.current.answers) ||
    !same(draft.current.order, confirmed.current.order);
  function put(p: StudentProgress) {
    draft.current = p;
    if (mounted.current) setProgress(p);
  }
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  function adopt(incoming: StudentSnapshot) {
    if (incoming.lessonId !== lesson.current.id || incoming.student.id !== draft.current.studentId)
      return;
    if (incoming.phaseRevision >= lesson.current.revision)
      lesson.current = {
        id: incoming.lessonId,
        phase: incoming.phase,
        revision: incoming.phaseRevision,
      };
    if (incoming.progress.revision <= confirmed.current.revision) return;
    const dirty = changed(),
      own =
        pending.current &&
        same(incoming.progress.answers, pending.current.answers) &&
        same(incoming.progress.order, pending.current.order);
    confirmed.current = incoming.progress;
    if (!dirty) put(incoming.progress);
    else if (own) {
      put({ ...incoming.progress, answers: draft.current.answers, order: draft.current.order });
    } else {
      conflict.current = incoming;
      setStatus('conflict');
      setError('다른 화면에서 저장한 내용이 있어요. 어떤 내용을 이어 할지 골라 주세요.');
    }
  }
  useEffect(() => adopt(snapshot), [snapshot.progress.revision, snapshot.phaseRevision]);
  function update(p: StudentProgress) {
    put(p);
    setError('');
    if (!conflict.current) setStatus(navigator.onLine ? 'saving' : 'offline');
  }
  function updateAnswer(id: string, t: ClockTime) {
    const p = draft.current;
    update({
      ...p,
      answers: { ...p.answers, [id]: t },
      wrongTimeIds: p.wrongTimeIds.filter((x) => x !== id),
    });
  }
  function updateOrder(order: string[]) {
    update({ ...draft.current, order, wrongOrderIds: [] });
  }
  function makeCommand(action: ProgressCommand['action']): ProgressCommand {
    return {
      operationId: crypto.randomUUID(),
      expectedRevision: confirmed.current.revision,
      action,
      answers: draft.current.answers,
      order: draft.current.order,
    };
  }
  async function perform(command: ProgressCommand) {
    if (!navigator.onLine) {
      setStatus('offline');
      throw Error('연결을 확인해 주세요');
    }
    pending.current = command;
    setBusy(true);
    setStatus('saving');
    try {
      const r = await request<{ progress: StudentProgress }>(
        '/api/student/progress',
        json('PUT', command),
      );
      if (!mounted.current) return;
      const edited =
        !same(draft.current.answers, command.answers) || !same(draft.current.order, command.order);
      if (r.progress.revision >= confirmed.current.revision) {
        confirmed.current = r.progress;
        put(
          edited
            ? { ...r.progress, answers: draft.current.answers, order: draft.current.order }
            : r.progress,
        );
      }
      pending.current = null;
      if (!conflict.current) {
        setStatus(changed() ? 'saving' : 'saved');
        setError('');
      }
    } catch (e) {
      if (!mounted.current) throw e;
      if (e instanceof ApiError && e.status < 500) {
        pending.current = null;
        const remote = e.details as StudentSnapshot | undefined;
        if (
          e.status === 409 &&
          remote?.progress &&
          remote.student?.id === draft.current.studentId
        ) {
          confirmed.current = remote.progress;
          lesson.current = {
            id: remote.lessonId,
            phase: remote.phase,
            revision: remote.phaseRevision,
          };
          conflict.current = remote;
          setStatus(remote.phase === 'active' ? 'conflict' : 'error');
        } else setStatus('error');
      } else setStatus(navigator.onLine ? 'error' : 'offline');
      setError(e instanceof Error ? e.message : '연결을 확인해 주세요');
      throw e;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function serialized(fn: () => Promise<void>): Promise<void> {
    const work = queue.current.then(fn);
    queue.current = work.catch(() => {});
    return work;
  }
  function submit(action: ProgressCommand['action']): Promise<void> {
    return serialized(async () => {
      if (pending.current) await perform(pending.current);
      if (action === 'save' && !changed()) return;
      if (conflict.current) throw Error('저장된 내용과 초안 중 하나를 골라 주세요');
      if (lesson.current.phase !== 'active') {
        setStatus('error');
        setError('수업이 끝났어요. 저장된 내용은 그대로 있어요');
        throw Error('수업이 끝났어요');
      }
      await perform(makeCommand(action));
    });
  }
  useEffect(() => {
    if (
      !changed() ||
      !navigator.onLine ||
      lesson.current.phase !== 'active' ||
      conflict.current ||
      pending.current
    )
      return;
    const timer = setTimeout(() => void submit('save').catch(() => {}), 400);
    return () => clearTimeout(timer);
  }, [progress.answers, progress.order]);
  async function goHome() {
    if (!navigator.onLine) {
      setStatus('offline');
      return true;
    }
    try {
      await submit('save');
      return true;
    } catch {
      return false;
    }
  }
  function discardDraft() {
    pending.current = null;
    conflict.current = null;
    put(confirmed.current);
    setStatus('saved');
    setError('');
  }
  function recover(): Promise<void> {
    return serialized(async () => {
      try {
        if (pending.current) await perform(pending.current);
        const remote = await request<StudentSnapshot>('/api/student/state');
        if (!mounted.current) return;
        adopt(remote);
        if (!conflict.current && changed() && lesson.current.phase === 'active')
          await perform(makeCommand('save'));
        else if (!changed()) {
          setStatus('saved');
          setError('');
        }
      } catch (e) {
        if (mounted.current) {
          if (!conflict.current) setStatus(navigator.onLine ? 'error' : 'offline');
          setError(e instanceof Error ? e.message : '연결을 확인해 주세요');
        }
        throw e;
      }
    });
  }
  const canReapply =
    !!conflict.current &&
    conflict.current.phase === 'active' &&
    conflict.current.progress.stage === draft.current.stage;
  async function reapplyDraft() {
    if (!canReapply) throw Error('수업 상태가 바뀌어 초안을 적용할 수 없습니다');
    conflict.current = null;
    put({ ...draft.current, revision: confirmed.current.revision });
    await submit('save');
  }
  useEffect(() => {
    const online = () => void recover().catch(() => {}),
      offline = () => setStatus('offline');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);
  return {
    progress,
    status,
    error,
    busy,
    dirty: changed(),
    canReapply,
    updateAnswer,
    updateOrder,
    submit,
    goHome,
    discardDraft,
    recover,
    reapplyDraft,
  };
}
