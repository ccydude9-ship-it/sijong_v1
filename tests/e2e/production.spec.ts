import { test, expect } from '@playwright/test';
import { createFixture } from '../helpers/fixture';
import { startServer } from '../../apps/server/src/main';
test('built app starts through production runtime and teaches a clock', async ({
  browser,
  page,
}) => {
  const f = await createFixture(),
    student = f.store.students.list(f.lessonId)[0];
  f.store.close();
  const runtime = await startServer({ ...f.config, publicOrigin: 'http://127.0.0.1:0' });
  const context = await browser.newContext();
  try {
    await page.goto(runtime.url);
    await page.getByRole('button', { name: '선생님 입장' }).click();
    await page.getByLabel('선생님 비밀번호').fill(f.config.teacherPassword!);
    await page.getByRole('button', { name: '입장하기', exact: true }).click();
    await page.getByRole('button', { name: '학급 코드 새로 발급' }).click();
    const code = (await page.locator('output').innerText()).trim();
    await page.getByRole('button', { name: '수업 시작하기' }).click();
    const p = await context.newPage();
    await p.goto(runtime.url);
    await p.getByRole('button', { name: '게임 시작' }).click();
    await p.getByLabel('학급 접속 코드').fill(code);
    await p.getByRole('button', { name: '이 기기 연결하기' }).click();
    await p.getByRole('button', { name: student.displayName, exact: true }).click();
    await p.getByRole('button', { name: /연습모드/ }).click();
    await expect(p.getByRole('img', { name: '바늘시계' })).toBeVisible();
    const state = await (await context.request.get(`${runtime.url}/api/student/state`)).json();
    await p.getByRole('button', { name: `${state.practice.clock.hour}시`, exact: true }).click();
    await p
      .getByRole('button', {
        name: `${String(state.practice.clock.minute).padStart(2, '0')}분`,
        exact: true,
      })
      .click();
    await p.getByRole('button', { name: '확인하기', exact: true }).click();
    await expect(p.getByText('잘 읽었어요!')).toBeVisible();
    await expect(page.getByTestId(`student-summary-${student.id}`)).toContainText('연습 1개', {
      timeout: 2000,
    });
  } finally {
    await context.close();
    await runtime.close();
    await f.cleanup();
  }
});
