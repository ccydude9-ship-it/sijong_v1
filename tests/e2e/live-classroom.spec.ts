import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../../apps/server/src/main';
import { randomUUID } from 'node:crypto';
let server: Awaited<ReturnType<typeof startServer>>, root: string;
const password = randomUUID();
test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'sijong-live-e2e-'));
  server = await startServer({
    standalone: true,
    port: 0,
    host: '127.0.0.1',
    publicOrigin: 'http://127.0.0.1:0',
    dbPath: join(root, 'db.sqlite'),
    uploadDir: join(root, 'images'),
    keyPath: join(root, 'key'),
    secureCookies: false,
    teacherPassword: password,
  });
});
test.afterAll(async () => {
  await server?.close();
  await rm(root, { recursive: true, force: true });
});
async function loginStudent(page: Page, code: string, name: string) {
  await page.goto(server.url);
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByLabel('교실 코드', { exact: true }).fill(code);
  await page.getByRole('button', { name: '교실 연결하기', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
}
test('teacher sees two independent tablets before completion and offline edits recover', async ({
  browser,
}) => {
  const contexts: BrowserContext[] = [];
  try {
    const teacherContext = await browser.newContext(),
      aContext = await browser.newContext(),
      bContext = await browser.newContext();
    contexts.push(teacherContext, aContext, bContext);
    const teacher = await teacherContext.newPage(),
      a = await aContext.newPage(),
      b = await bContext.newPage();
    const errors: string[] = [];
    for (const p of [teacher, a, b]) p.on('pageerror', (e) => errors.push(e.message));
    await teacher.goto(server.url);
    await teacher.getByRole('button', { name: '선생님 설정', exact: true }).click();
    await teacher.getByLabel('선생님 비밀번호', { exact: true }).fill(password);
    await teacher.getByRole('button', { name: '선생님 접속하기', exact: true }).click();
    await teacher.getByLabel('일과 이름', { exact: true }).first().fill('준비된 아침 카드');
    await teacher
      .getByLabel('그림 바꾸기', { exact: true })
      .first()
      .setInputFiles({
        name: 'prepared-card.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/h9sAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    await expect(teacher.getByText('그림을 바꿨어요. 이 학생 저장을 눌러 주세요.')).toBeVisible();
    await teacher.getByRole('button', { name: '이 학생 저장', exact: true }).click();
    const prepared = await teacher.evaluate(
      () => JSON.parse(localStorage.getItem('sijong.single.v1')!).students[0].cards[0],
    );
    await teacher.getByRole('button', { name: '이 자료로 수업 열기', exact: true }).click();
    const code = await teacher.locator('.class-code').innerText();
    expect(code).toMatch(/^\d{6}$/);
    await teacher.getByRole('button', { name: '공유모드 열기', exact: true }).click();
    await loginStudent(a, code, '별이');
    await loginStudent(b, code, '하늘');
    await expect(a.locator('[data-reading-card]').first().locator('img')).toHaveAttribute(
      'src',
      prepared.image,
    );
    await expect(a.locator('[data-reading-card]').first()).toContainText('준비된 아침 카드');
    expect(
      await a.evaluate(
        () => JSON.parse(localStorage.getItem('sijong.single.v1')!).students[0].cards[0].minute,
      ),
    ).toBe(prepared.minute);
    await expect(b.locator('[data-reading-card]').first()).not.toContainText('준비된 아침 카드');
    await a
      .getByRole('button', { name: /시각 고르기/ })
      .first()
      .click();
    await a.getByRole('dialog').getByRole('button', { name: '7시', exact: true }).click();
    await teacher.getByRole('button', { name: '별이 일과표 보기', exact: true }).click();
    await expect(teacher.locator('.timeline-time').first()).toContainText('7시', {
      timeout: 10000,
    });
    await expect(teacher.locator('.timeline-time').first().locator('.time-blank')).toHaveCount(1);
    await a.getByRole('dialog').getByRole('button', { name: '00분', exact: true }).click();
    await expect(
      teacher.getByRole('button', { name: '별이 일과표 보기', exact: true }),
    ).toContainText('시각 입력 1/8', { timeout: 10000 });
    await b
      .getByRole('button', { name: /시각 고르기/ })
      .first()
      .click();
    await b.getByRole('dialog').getByRole('button', { name: '8시', exact: true }).click();
    await b.getByRole('dialog').getByRole('button', { name: '30분', exact: true }).click();
    await expect(
      teacher.getByRole('button', { name: '하늘 일과표 보기', exact: true }),
    ).toContainText('시각 입력 1/8', { timeout: 10000 });
    await teacher.getByRole('button', { name: '하늘 일과표 보기', exact: true }).click();
    await expect(teacher.locator('.timeline-time').first()).toHaveText('8시 30분');
    await aContext.setOffline(true);
    await a.getByRole('dialog').getByRole('button', { name: '9시', exact: true }).click();
    await a.getByRole('button', { name: '입력 완료', exact: true }).click();
    await expect(a.locator('[data-reading-card]').first()).toContainText('9시 00분');
    await aContext.setOffline(false);
    await teacher.getByRole('button', { name: '별이 일과표 보기', exact: true }).click();
    await expect(teacher.locator('.timeline-time').first()).toHaveText('9시 00분', {
      timeout: 15000,
    });
    await a.reload();
    await a.getByRole('button', { name: /실전모드/ }).click();
    await expect(a.locator('[data-reading-card]').first()).toContainText('9시 00분');
    const cards = await a.evaluate(
      () => JSON.parse(localStorage.getItem('sijong.single.v1')!).students[0].cards,
    );
    for (let i = 0; i < cards.length; i++) {
      await a
        .getByRole('button', { name: /시각 고르기/ })
        .nth(i)
        .click();
      await a
        .getByRole('dialog')
        .getByRole('button', {
          name: (Math.floor(cards[i].minute / 60) % 12 || 12) + '시',
          exact: true,
        })
        .click();
      await a
        .getByRole('dialog')
        .getByRole('button', {
          name: String(cards[i].minute % 60).padStart(2, '0') + '분',
          exact: true,
        })
        .click();
      await a.getByRole('button', { name: '입력 완료', exact: true }).click();
    }
    await a.getByRole('button', { name: '시각 확인하기', exact: true }).click();
    await expect(
      teacher.getByRole('button', { name: '별이 일과표 보기', exact: true }),
    ).toContainText('순서 맞추는 중', { timeout: 10000 });
    await a.locator('.order-tile').first().click();
    await a.getByRole('button', { name: '2번째 자리에 놓기', exact: true }).click();
    const expectedOrder = await a.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('sijong.single.v1')!).students[0];
      return s.progress.order.map(
        (id: string) => s.cards.find((c: { id: string }) => c.id === id).title,
      );
    });
    await expect(teacher.locator('.timeline-card h2')).toHaveText(expectedOrder, {
      timeout: 10000,
    });
    await a.getByRole('button', { name: '선생님 설정', exact: true }).click();
    await expect(a.getByLabel('선생님 비밀번호', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
