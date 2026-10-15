import React from 'react';
import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { StudentCardEditor } from '../../apps/web/src/teacher/StudentCardEditor';
import { LessonSetup } from '../../apps/web/src/teacher/LessonSetup';
import { makeValidCards } from '../helpers/cards';
afterEach(() => vi.unstubAllGlobals());
it('teacher_edits_personal_cards_with_period', () => {
  render(
    <StudentCardEditor
      student={{
        id: 's1',
        displayName: '별이',
        distinction: '',
        slot: 1,
        cards: makeValidCards(),
        progress: {} as any,
        solvedCount: 0,
      }}
      disabled={false}
      onSave={async () => {}}
      onUpload={async () => ''}
    />,
  );
  expect(screen.getByLabelText('학생 이름')).toHaveValue('별이');
  expect(screen.getAllByLabelText('오전·오후')).toHaveLength(8);
  expect(screen.getAllByLabelText('그림 바꾸기')).toHaveLength(8);
});
it('teacher_replaces_example_artwork', async () => {
  const upload = vi.fn(async () => 'new-art'),
    save = vi.fn(async () => {});
  render(
    <StudentCardEditor
      student={{
        id: 's1',
        displayName: '별이',
        distinction: '',
        slot: 1,
        cards: makeValidCards(),
        progress: {} as any,
        solvedCount: 0,
      }}
      disabled={false}
      onSave={save}
      onUpload={upload}
    />,
  );
  fireEvent.change(screen.getAllByLabelText('그림 바꾸기')[0], {
    target: { files: [new File(['fake'], 'test.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(upload).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '이 학생 저장' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        cards: expect.arrayContaining([expect.objectContaining({ imageId: 'new-art' })]),
      }),
    ),
  );
});
it('start_requires_saving_or_discarding_edits_and_waits_for_image_upload', async () => {
  let lesson = {
    id: 'lesson',
    phase: 'preparing',
    revision: 0,
    students: [
      {
        id: 's1',
        slot: 1,
        displayName: '별이',
        distinction: '',
        cards: makeValidCards(),
        progress: {} as any,
        solvedCount: 0,
      },
    ],
  };
  let finishUpload!: (r: Response) => void;
  const fetcher = vi.fn(async (path, init) => {
    if (String(path).endsWith('/images'))
      return new Promise<Response>((r) => {
        finishUpload = r;
      });
    if (init?.method === 'PUT') {
      const body = JSON.parse(init.body);
      lesson = { ...lesson, students: [{ ...lesson.students[0], ...body }] };
    }
    if (String(path).endsWith('/phase')) lesson = { ...lesson, phase: 'active', revision: 1 };
    return Response.json(lesson);
  });
  vi.stubGlobal('fetch', fetcher);
  render(<LessonSetup lessonId="lesson" />);
  const start = await screen.findByRole('button', { name: '수업 시작하기' });
  fireEvent.change(screen.getAllByLabelText('일과 이름')[0], { target: { value: '수정된 일과' } });
  expect(start).toBeDisabled();
  expect(screen.getByText(/변경한 학생 카드를 저장하거나 취소/)).toBeVisible();
  fireEvent.click(start);
  expect(fetcher.mock.calls.some(([path]) => String(path).endsWith('/phase'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '변경 취소' }));
  await waitFor(() => expect(start).toBeEnabled());
  expect(screen.getAllByLabelText('일과 이름')[0]).toHaveValue(makeValidCards()[0].title);
  fireEvent.change(screen.getAllByLabelText('그림 바꾸기')[0], {
    target: { files: [new File(['fake'], 'test.png', { type: 'image/png' })] },
  });
  expect(start).toBeDisabled();
  await waitFor(() => expect(finishUpload).toBeTypeOf('function'));
  await React.act(async () => {
    finishUpload(Response.json({ imageId: 'replacement' }));
  });
  expect(start).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '이 학생 저장' }));
  await waitFor(() => expect(start).toBeEnabled());
  expect(lesson.students[0].cards[0].imageId).toBe('replacement');
  fireEvent.click(start);
  await screen.findByText('함께 배우는 중');
  expect(screen.getAllByLabelText('일과 이름')[0]).toBeDisabled();
  expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', '/api/images/replacement');
});
