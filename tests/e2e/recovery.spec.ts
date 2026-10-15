import { test, expect, studentPage } from '../helpers/browser';
test('offline home preserves draft and reconnect plus reload restores confirmed progress', async ({
  page,
  classroom: c,
}) => {
  c.store.lessons.set({ ...c.store.lessons.get(c.lessonId)!, phase: 'active' });
  const student = c.students[0],
    card = c.store.students.cards(student.id)[0];
  await studentPage(page, c, student);
  await page.getByRole('button', { name: /실전모드/ }).click();
  await page.context().setOffline(true);
  await page
    .getByTestId(`reading-${card.id}`)
    .getByRole('button', { name: '5시', exact: true })
    .click();
  await page.getByRole('button', { name: '홈으로 돌아가기' }).click();
  await page.getByRole('button', { name: '이름 다시 고르기' }).click();
  await expect(page.getByRole('alert')).toContainText('이름을 바꾸기 전에');
  await expect(page.getByRole('button', { name: '저장 안 된 변경 취소' })).toBeVisible();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await expect(
    page.getByTestId(`reading-${card.id}`).getByRole('button', { name: '5시', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.context().setOffline(false);
  await expect.poll(() => c.store.progress.get(student.id).answers[card.id]?.hour).toBe(5);
  await page.reload();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: student.displayName, exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await expect(
    page.getByTestId(`reading-${card.id}`).getByRole('button', { name: '5시', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
test('lost saved response retries same operation without duplicate mutation', async ({
  page,
  classroom: c,
}) => {
  c.store.lessons.set({ ...c.store.lessons.get(c.lessonId)!, phase: 'active' });
  const student = c.students[0],
    card = c.store.students.cards(student.id)[0],
    operations: string[] = [];
  await studentPage(page, c, student);
  await page.getByRole('button', { name: /실전모드/ }).click();
  let abortFirst = true;
  await page.route('**/api/student/progress', async (route) => {
    operations.push(route.request().postDataJSON().operationId);
    const response = await route.fetch();
    if (abortFirst) {
      abortFirst = false;
      await route.abort('failed');
    } else await route.fulfill({ response });
  });
  await page
    .getByTestId(`reading-${card.id}`)
    .getByRole('button', { name: '5시', exact: true })
    .click();
  await expect(page.getByRole('button', { name: '다시 저장', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다시 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(operations).toHaveLength(2);
  expect(operations[0]).toBe(operations[1]);
  expect(c.store.progress.get(student.id).revision).toBe(1);
});
test('failed name reset keeps practice draft and allows retry', async ({ page, classroom: c }) => {
  c.store.lessons.set({ ...c.store.lessons.get(c.lessonId)!, phase: 'active' });
  await studentPage(page, c, c.students[0]);
  await page.getByRole('button', { name: /연습모드/ }).click();
  await page.getByRole('button', { name: '5시', exact: true }).click();
  await page.getByRole('button', { name: '홈으로 돌아가기' }).click();
  await page.route('**/api/auth/student/reset', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: '잠시 연결할 수 없어요' }),
    }),
  );
  await page.getByRole('button', { name: '이름 다시 고르기' }).click();
  await expect(page.getByRole('alert')).toContainText('잠시 연결할 수 없어요');
  await page.getByRole('button', { name: /연습모드/ }).click();
  await expect(page.getByRole('button', { name: '5시', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '홈으로 돌아가기' }).click();
  await page.unroute('**/api/auth/student/reset');
  await page.getByRole('button', { name: '이름 다시 고르기' }).click();
  await expect(page.getByRole('heading', { name: /내 이름을 골라요/ })).toBeVisible();
});
test('server restart preserves session artwork and progress', async ({ page, classroom: c }) => {
  c.store.lessons.set({ ...c.store.lessons.get(c.lessonId)!, phase: 'active' });
  const student = c.students[0],
    card = c.store.students.cards(student.id)[0];
  await studentPage(page, c, student);
  await page.getByRole('button', { name: /실전모드/ }).click();
  await page
    .getByTestId(`reading-${card.id}`)
    .getByRole('button', { name: '6시', exact: true })
    .click();
  await expect.poll(() => c.store.progress.get(student.id).answers[card.id]?.hour).toBe(6);
  await c.restart();
  await page.reload();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: student.displayName, exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await expect(
    page.getByTestId(`reading-${card.id}`).getByRole('button', { name: '6시', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId(`reading-${card.id}`).locator('img')).toHaveJSProperty(
    'complete',
    true,
  );
});
test('ending lesson updates student controls immediately', async ({ page, classroom: c }) => {
  c.store.lessons.set({ ...c.store.lessons.get(c.lessonId)!, phase: 'active' });
  await studentPage(page, c, c.students[0]);
  await page.getByRole('button', { name: /실전모드/ }).click();
  c.app.locals.lessons.changePhase(c.lessonId, {
    operationId: crypto.randomUUID(),
    expectedRevision: 0,
    phase: 'ended',
    confirmIncomplete: true,
  });
  await expect(page.getByText('수업이 끝났어요. 저장된 나의 하루를 볼 수 있어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '시각 확인하기' })).toBeDisabled();
});
