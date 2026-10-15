import { afterEach, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useProgressDraft } from '../../apps/web/src/student/useProgressDraft';
import { makeSnapshot } from '../helpers/snapshot';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('autosave_returns_revision_and_keeps_input', async () => {
  const s = makeSnapshot();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_p, init) => {
      const c = JSON.parse(init.body);
      return Response.json({
        progress: { ...s.progress, answers: c.answers, order: c.order, revision: 1 },
        wrongTimeIds: [],
        wrongOrderIds: [],
      });
    }),
  );
  const { result } = renderHook(() => useProgressDraft(s));
  act(() => result.current.updateAnswer('c1', { hour: 7, minute: 0 }));
  await waitFor(() => expect(result.current.status).toBe('saved'));
  expect(result.current.progress.answers.c1).toEqual({ hour: 7, minute: 0 });
  expect(result.current.progress.revision).toBe(1);
});
it('home_save_failure_keeps_draft_and_offers_retry', async () => {
  const s = makeSnapshot();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ message: '저장 실패' }, { status: 503 })),
  );
  const { result } = renderHook(() => useProgressDraft(s));
  act(() => result.current.updateAnswer('c1', { hour: 5, minute: 0 }));
  let allowed = true;
  await act(async () => {
    allowed = await result.current.goHome();
  });
  expect(allowed).toBe(false);
  expect(result.current.progress.answers.c1?.hour).toBe(5);
  expect(result.current.error).toBeTruthy();
});
it('offline_home_roundtrip_keeps_in_memory_draft', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const { result } = renderHook(() => useProgressDraft(makeSnapshot()));
  act(() => result.current.updateAnswer('c1', { hour: 5, minute: 0 }));
  let allowed = false;
  await act(async () => {
    allowed = await result.current.goHome();
  });
  expect(allowed).toBe(true);
  expect(result.current.progress.answers.c1?.hour).toBe(5);
  expect(result.current.status).toBe('offline');
});
it('completion_waits_for_server', async () => {
  const s = makeSnapshot();
  s.progress.stage = 'ordering';
  let finish: (r: Response) => void = () => {};
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((r) => (finish = r))),
  );
  const { result } = renderHook(() => useProgressDraft(s));
  act(() => {
    void result.current.submit('check-order');
  });
  await waitFor(() => expect(result.current.busy).toBe(true));
  expect(result.current.progress.stage).toBe('ordering');
  await act(async () =>
    finish(
      Response.json({
        progress: {
          ...s.progress,
          revision: 1,
          stage: 'completed',
          completedAt: new Date().toISOString(),
        },
        wrongTimeIds: [],
        wrongOrderIds: [],
      }),
    ),
  );
  expect(result.current.progress.stage).toBe('completed');
});
