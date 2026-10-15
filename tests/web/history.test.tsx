import React from 'react';
import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonHistory } from '../../apps/web/src/teacher/LessonHistory';
afterEach(() => vi.unstubAllGlobals());
it('teacher_can_select_saved_earlier_lesson', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json([
        { id: 'current', phase: 'preparing' },
        { id: 'old', phase: 'ended' },
      ]),
    ),
  );
  const select = vi.fn();
  render(<LessonHistory selectedId="current" onSelect={select} />);
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
  fireEvent.change(screen.getByLabelText('수업 기록'), { target: { value: 'old' } });
  expect(select).toHaveBeenCalledWith('old');
});
