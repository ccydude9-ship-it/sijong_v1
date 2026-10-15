import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardView } from '../../apps/web/src/teacher/Dashboard';
it('teacher_sees_individual_progress_and_can_share_completed_only', () => {
  const share = vi.fn();
  render(
    <DashboardView
      snapshot={{
        lessonId: 'l',
        phase: 'active',
        phaseRevision: 1,
        students: [
          {
            studentId: 's1',
            displayName: '별이',
            distinction: '',
            progressRevision: 2,
            stage: 'completed',
            correctTimeCount: 8,
            solvedCount: 3,
            connected: true,
            completedAt: '2026-10-15',
          },
          {
            studentId: 's2',
            displayName: '하늘',
            distinction: '',
            progressRevision: 1,
            stage: 'reading',
            correctTimeCount: 2,
            solvedCount: 1,
            connected: false,
            completedAt: null,
          },
        ],
      }}
      onShare={share}
    />,
  );
  expect(screen.getByTestId('student-summary-s1')).toHaveTextContent('완료');
  expect(screen.getByTestId('student-summary-s1')).toHaveTextContent('접속 중');
  expect(screen.getByRole('button', { name: '하늘 일과표 보기' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '별이 일과표 보기' }));
  expect(share).toHaveBeenCalledWith('s1');
});
