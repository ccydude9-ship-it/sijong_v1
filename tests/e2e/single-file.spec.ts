import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appFile = resolve('index.html');
const appUrl = 'http://127.0.0.1:4179/index.html';
test.beforeEach(async ({ page }) => {
  expect(existsSync(appFile), '수업용 index.html 한 파일이 있어야 합니다').toBe(true);
  // This managed browser blocks file:// by policy. Fulfill the exact HTML locally;
  // no application server, asset server or outgoing network is used.
  await page.route(appUrl, (route) =>
    route.fulfill({ contentType: 'text/html', body: readFileSync(appFile, 'utf8') }),
  );
  await page.goto(appUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('single file opens offline and keeps title name and free mode navigation', async ({
  page,
}) => {
  const remote: string[] = [];
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && r.url() !== appUrl) remote.push(r.url());
  });
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '시계는 째깍! 하루는 찰칵!' })).toBeVisible();
  await page.keyboard.press('a');
  await page.getByRole('button', { name: '별이', exact: true }).click();
  for (const mode of ['연습모드', '실전모드', '공유모드']) {
    await page.getByRole('button', { name: new RegExp(mode) }).click();
    await page.getByRole('button', { name: '홈으로 돌아가기' }).click();
    await expect(page.getByRole('heading', { name: '무엇을 해 볼까요?' })).toBeVisible();
  }
  expect(remote).toEqual([]);
});

test('personal reading drafts survive home reload and another student selection', async ({
  page,
}) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  const first = page.locator('[data-reading-card]').first();
  await first.getByRole('button', { name: '5시', exact: true }).click();
  await first.getByRole('button', { name: '30분', exact: true }).click();
  await page.getByRole('button', { name: '홈으로 돌아가기' }).click();
  await page.getByRole('button', { name: '이름 다시 고르기' }).click();
  await page.getByRole('button', { name: '하늘', exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await expect(page.getByRole('button', { name: '하늘의 일어나기 카드 뒤집기' })).toBeVisible();
  await expect(
    page.locator('[data-reading-card]').first().getByRole('button', { name: '5시', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await expect(
    page.locator('[data-reading-card]').first().getByRole('button', { name: '5시', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('teacher changes names cards and pictures within the one file app', async ({ page }) => {
  await page.getByRole('button', { name: '선생님 준비' }).click();
  await page.getByLabel('학생 이름').fill('지민');
  await page.getByLabel('일과 이름').first().fill('지민의 아침');
  await page
    .getByLabel('그림 바꾸기')
    .first()
    .setInputFiles({ name: 'test.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('PNG');
  await page
    .getByLabel('그림 바꾸기')
    .first()
    .setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/h9sAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  await expect(page.getByText('그림을 바꿨어요. 이 학생 저장을 눌러 주세요.')).toBeVisible();
  await page.getByRole('button', { name: '이 학생 저장' }).click();
  await page.getByRole('button', { name: '시작 화면으로' }).click();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '지민', exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await expect(page.getByRole('button', { name: '지민의 아침 카드 뒤집기' })).toBeVisible();
  await expect(page.locator('[data-reading-card]').first().locator('img')).toHaveAttribute(
    'src',
    /^data:image\/jpeg;base64,/,
  );
});

test('practice gives retry hints and grades without a network service', async ({ page }) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /연습모드/ }).click();
  const question = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sijong.single.v1')!).students[0].progress.practice,
  );
  await page.getByRole('button', { name: `${(question.hour % 12) + 1}시`, exact: true }).click();
  await page.getByRole('button', { name: '정답 확인하기' }).click();
  await expect(page.getByRole('alert')).toContainText('다시 한번');
  await page.getByRole('button', { name: /긴 바늘 보기/ }).click();
  await page.getByRole('button', { name: `${question.hour}시`, exact: true }).click();
  await page
    .getByRole('button', { name: `${String(question.minute).padStart(2, '0')}분`, exact: true })
    .click();
  await page.getByRole('button', { name: '정답 확인하기' }).click();
  await expect(page.getByText('잘 읽었어요! ✦')).toBeVisible();
  await expect(page.locator('.stat')).toContainText('1개의 시계');
});

test('import rejects malformed progress instead of rendering injected content', async ({
  page,
}) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /연습모드/ }).click();
  const bad = await page.evaluate(() => JSON.parse(localStorage.getItem('sijong.single.v1')!));
  bad.students[0].progress.solved = '<img src=x onerror="window.injected=true">';
  await page.reload();
  await page.getByRole('button', { name: '선생님 준비' }).click();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByLabel('자료 불러오기', { exact: true }).setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bad)),
  });
  await expect(page.getByRole('alert')).toContainText('수업 자료 파일');
  expect(await page.evaluate(() => (window as any).injected)).toBeUndefined();
});

test('own cards can be read ordered and shared with serverless grading', async ({ page }) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /공유모드/ }).click();
  await expect(page.getByText('실전모드에서 일과표를 완성해 주세요')).toBeVisible();
  await page.getByRole('button', { name: '홈으로 돌아가기' }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  const times = [
    [7, 0],
    [7, 30],
    [8, 0],
    [12, 0],
    [3, 0],
    [6, 0],
    [7, 30],
    [8, 30],
  ];
  for (let i = 0; i < 8; i++) {
    const card = page.locator('[data-reading-card]').nth(i);
    await card.getByRole('button', { name: `${times[i][0]}시`, exact: true }).click();
    await card
      .getByRole('button', { name: `${String(times[i][1]).padStart(2, '0')}분`, exact: true })
      .click();
  }
  await page.getByRole('button', { name: '시각 확인하기' }).click();
  await expect(page.getByRole('heading', { name: '내 하루를 순서대로!' })).toBeVisible();
  const correct = [
    '일어나기',
    '아침 먹기',
    '학교 가기',
    '점심 먹기',
    '놀이터 가기',
    '저녁 먹기',
    '책 읽기',
    '잠자기',
  ];
  for (let target = 0; target < 8; target++) {
    const up = page.getByRole('button', { name: `별이의 ${correct[target]} 앞으로`, exact: true });
    while ((await up.locator('..').getAttribute('data-position')) !== String(target))
      await up.click();
  }
  await page.getByRole('button', { name: '완성하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '내 하루 완성!' })).toBeVisible();
  await page.getByRole('button', { name: '내 하루 소개하기' }).click();
  await expect(page.getByRole('heading', { name: '찰칵! 내 하루를 들려줘' })).toBeVisible();
  await expect(page.locator('.timeline-card')).toHaveCount(8);
});
