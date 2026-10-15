import React, { useState } from 'react';
import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionProvider, useSession } from '../../apps/web/src/auth/SessionProvider';
afterEach(() => {
  vi.unstubAllGlobals();
});
it('failed_student_reset_preserves_workspace_identity_and_local_draft', async () => {
  const student = {
    id: 'session',
    role: 'student',
    lessonId: 'lesson',
    studentId: 's1',
    expiresAt: Date.now() + 60000,
    csrfToken: 'token',
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path) =>
      path === '/api/session'
        ? Response.json(student)
        : Response.json({ message: '연결 실패' }, { status: 503 }),
    ),
  );
  function Draft() {
    const [answer, setAnswer] = useState('');
    return <input aria-label="초안" value={answer} onChange={(e) => setAnswer(e.target.value)} />;
  }
  function Probe() {
    const auth = useSession(),
      [error, setError] = useState('');
    if (auth.loading) return null;
    return (
      <>
        <Draft key={auth.epoch} />
        <span>{auth.session?.studentId}</span>
        <button onClick={() => void auth.resetStudent().catch((e) => setError(e.message))}>
          이름 변경
        </button>
        <p>{error}</p>
      </>
    );
  }
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
  await screen.findByLabelText('초안');
  fireEvent.change(screen.getByLabelText('초안'), { target: { value: '5시' } });
  fireEvent.click(screen.getByRole('button', { name: '이름 변경' }));
  await waitFor(() => expect(screen.getByText('연결 실패')).toBeVisible());
  expect(screen.getByLabelText('초안')).toHaveValue('5시');
  expect(screen.getByText('s1')).toBeVisible();
});
