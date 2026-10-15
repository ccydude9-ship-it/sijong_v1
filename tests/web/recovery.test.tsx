import { afterEach, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useProgressDraft } from '../../apps/web/src/student/useProgressDraft';
import { mergeStudentSnapshot } from '../../apps/web/src/realtime/merge';
import { makeSnapshot } from '../helpers/snapshot';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('older_snapshot_cannot_rollback_new_phase', () => {
  const current = makeSnapshot();
  current.phase = 'ended';
  current.phaseRevision = 3;
  current.progress.revision = 7;
  const old = makeSnapshot();
  expect(mergeStudentSnapshot(current, old)).toEqual(current);
});
it('saved_response_lost_retries_same_operation_once', async () => {
  const s = makeSnapshot(),
    ids: string[] = [];
  let first = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path, init) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(init.body);
        ids.push(body.operationId);
        if (first) {
          first = false;
          throw new TypeError('network response lost');
        }
        s.progress = { ...s.progress, revision: 1, answers: body.answers };
        return Response.json({ progress: s.progress });
      }
      return Response.json(s);
    }),
  );
  const { result } = renderHook(() => useProgressDraft(s));
  act(() => result.current.updateAnswer('c1', { hour: 7, minute: 0 }));
  await act(async () => {
    try {
      await result.current.submit('save');
    } catch {}
  });
  await act(async () => {
    await result.current.recover();
  });
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  expect(result.current.status).toBe('saved');
});
it('conflict_requires_discard_or_reapply', async () => {
  const s = makeSnapshot(),
    remote = makeSnapshot();
  remote.progress = { ...s.progress, revision: 2, answers: { c2: { hour: 8, minute: 0 } } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ message: '다른 화면에서 저장했어요', details: remote }, { status: 409 }),
    ),
  );
  const { result } = renderHook(() => useProgressDraft(s));
  act(() => result.current.updateAnswer('c1', { hour: 5, minute: 0 }));
  await act(async () => {
    try {
      await result.current.submit('save');
    } catch {}
  });
  expect(result.current.status).toBe('conflict');
  expect(result.current.progress.answers.c1?.hour).toBe(5);
  act(() => result.current.discardDraft());
  expect(result.current.progress.answers.c2?.hour).toBe(8);
  expect(result.current.progress.answers.c1).toBeUndefined();
});
it('ended_lesson_prevents_reapply', async () => {
  const s = makeSnapshot(),
    remote = { ...makeSnapshot(), phase: 'ended', phaseRevision: 2 };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ message: '수업 종료', details: remote }, { status: 409 })),
  );
  const { result } = renderHook(() => useProgressDraft(s));
  act(() => result.current.updateAnswer('c1', { hour: 5, minute: 0 }));
  await act(async () => {
    try {
      await result.current.submit('save');
    } catch {}
  });
  expect(result.current.canReapply).toBe(false);
});
