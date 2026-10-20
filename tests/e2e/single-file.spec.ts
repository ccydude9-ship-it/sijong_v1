import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test.use({ actionTimeout: 10000 });

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
    await page.getByRole('button', { name: '홈', exact: true }).click();
    await expect(page.getByRole('heading', { name: '무엇을 해 볼까요?' })).toBeVisible();
  }
  expect(remote).toEqual([]);
});

test('home resets practical answers without affecting another student', async ({ page }) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  const first = page.locator('[data-reading-card]').first();
  await first.getByRole('button', { name: /시각 고르기/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '5시', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '30분', exact: true }).click();
  await page.getByRole('button', { name: '입력 완료' }).click();
  await page.getByRole('button', { name: '홈', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '하늘', exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await expect(page.getByRole('button', { name: '하늘의 일어나기 카드 뒤집기' })).toBeVisible();
  await expect(
    page
      .locator('[data-reading-card]')
      .first()
      .getByRole('button', { name: /시각 고르기/ })
      .locator('.time-blank'),
  ).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await expect(
    page
      .locator('[data-reading-card]')
      .first()
      .getByRole('button', { name: /시각 고르기/ })
      .locator('.time-blank'),
  ).toHaveCount(2);
});

test('teacher changes names cards and pictures within the one file app', async ({ page }) => {
  await page.getByRole('button', { name: '선생님 설정' }).click();
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
  await page.getByRole('button', { name: '이전 화면으로' }).click();
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
  await page.getByRole('button', { name: '00분', exact: true }).click();
  await page.getByRole('button', { name: '정답 확인하기' }).click();
  await expect(page.getByRole('alert')).toContainText('다시 한번');
  await page.getByRole('button', { name: /긴 바늘 따라가기/ }).click();
  await page.getByRole('button', { name: `${question.hour}시`, exact: true }).click();
  await page
    .getByRole('button', { name: `${String(question.minute).padStart(2, '0')}분`, exact: true })
    .click();
  await page.getByRole('button', { name: '정답 확인하기' }).click();
  await expect(page.getByRole('button', { name: /일과 카드 눌러 다음 문제/ })).toBeVisible();
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
  await page.getByRole('button', { name: '선생님 설정' }).click();
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
  await expect(page.getByRole('button', { name: /공유모드/ })).toBeVisible();
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
    await card.getByRole('button', { name: /시각 고르기/ }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: `${times[i][0]}시`, exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: `${String(times[i][1]).padStart(2, '0')}분`, exact: true })
      .click();
    await page.getByRole('button', { name: '입력 완료' }).click();
  }
  await page.getByRole('button', { name: '시각 확인하기' }).click();
  await expect(page.getByRole('heading', { name: '착착! 맞춰봐' })).toBeVisible();
  await expect(page.locator('.order-tile').first()).toBeDisabled();
  await expect(page.locator('.order-tile').last()).toBeDisabled();
  await expect(page.locator('.order-tile').first()).toContainText('일어나기');
  await expect(page.locator('.order-tile').last()).toContainText('잠자기');
  await expect(page.locator('.order-tile:not(:disabled)')).toHaveCount(6);
  const orderRows = await page.locator('[data-order-id]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { y: box.y, bottom: box.bottom };
    }),
  );
  expect(new Set(orderRows.map((box) => Math.round(box.y))).size).toBe(2);
  expect(Math.max(...orderRows.map((box) => box.bottom))).toBeLessThan(768);
  const finish = await page.getByRole('button', { name: '완성하기', exact: true }).boundingBox();
  expect(finish!.y + finish!.height).toBeLessThan(768);
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
    const card = page.getByRole('button', {
      name: '별이의 ' + correct[target] + ' 카드 선택',
      exact: true,
    });
    const index = await card.getAttribute('data-position');
    if (index !== String(target)) {
      const beforeSelection = await page.locator('[data-order-id]').evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height];
        }),
      );
      await card.click();
      expect(
        await page.locator('[data-order-id]').evaluateAll((nodes) =>
          nodes.map((n) => {
            const r = n.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          }),
        ),
      ).toEqual(beforeSelection);
      await page
        .getByRole('button', { name: target + 1 + '번째 자리에 놓기', exact: true })
        .click();
    }
  }
  await expect(page.locator('.order-tile:disabled')).toHaveCount(8);
  await page.getByRole('button', { name: '완성하기', exact: true }).click();
  await expect(page.locator('.timeline-card')).toHaveCount(8);
  await expect(page.getByRole('button', { name: '홈', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '선생님 설정' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '시각 다시 읽기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '완료 기록 내보내기' })).toHaveCount(0);
  await page.getByRole('button', { name: '별이의 일어나기 크게 보기', exact: true }).click();
  const popup = page.getByRole('dialog');
  await popup.getByRole('button', { name: '발표 카드 뒤집기' }).click();
  await expect(popup.locator('.clock-face')).toBeVisible();
  await popup.getByRole('button', { name: '닫기', exact: true }).click();
  await page.screenshot({ path: '.local/classroom/completed-waiting.png' });
  await page.reload();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await expect(page.locator('.timeline-card')).toHaveCount(8);
  await expect(page.getByRole('button', { name: '홈', exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: '선생님 설정' }).click();
  await page.getByRole('button', { name: '공유모드 열기' }).click();
  await page.getByRole('button', { name: '별이 일과표 보기', exact: true }).click();
  await expect(page.locator('.timeline-card')).toHaveCount(8);
  await expect(page.getByRole('heading', { name: '별이의 하루' })).toHaveCount(0);
});

test('student photo is editable persistent and displayed as a round name avatar', async ({
  page,
}) => {
  await page.getByRole('button', { name: '선생님 설정' }).click();
  await page.getByLabel('학생 사진').setInputFiles({
    name: 'face.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/h9sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByText('학생 사진을 바꿨어요. 이 학생 저장을 눌러 주세요.')).toBeVisible();
  await page.getByRole('button', { name: '이 학생 저장' }).click();
  await page.reload();
  await page.getByRole('button', { name: '게임 시작' }).click();
  const avatar = page.getByRole('button', { name: '별이', exact: true }).locator('img');
  await expect(avatar).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  expect(await avatar.locator('..').evaluate((el) => getComputedStyle(el).borderRadius)).toBe(
    '50%',
  );
});

test('correct practice reveals a large own card to the right and tapping starts a fresh question', async ({
  page,
}) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /연습모드/ }).click();
  const q = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sijong.single.v1')!).students[0].progress.practice,
  );
  expect(q.cardId).toBeTruthy();
  await page.getByRole('button', { name: q.hour + '시', exact: true }).click();
  await page
    .getByRole('button', { name: String(q.minute).padStart(2, '0') + '분', exact: true })
    .click();
  await page.getByRole('button', { name: '정답 확인하기' }).click();
  const reward = page.getByRole('button', { name: /일과 카드 눌러 다음 문제/ });
  await expect(reward).toBeVisible();
  const cardBox = await reward.boundingBox(),
    clockBox = await page.locator('.clock-panel').boundingBox();
  expect(cardBox!.x).toBeGreaterThan(clockBox!.x + clockBox!.width - 2);
  expect(cardBox!.height).toBeGreaterThan(300);
  for (const size of [
    { width: 1024, height: 768 },
    { width: 1180, height: 820 },
  ]) {
    await page.setViewportSize(size);
    const left = await page.locator('.clock-panel > .paper-card').boundingBox();
    const right = await reward.locator('.paper-card').boundingBox();
    for (const prop of ['y', 'width', 'height'] as const)
      expect(Math.abs(left![prop] - right![prop])).toBeLessThan(2);
  }
  await expect(page.getByText('잘 읽었어요! ✦')).toHaveCount(0);
  await reward.click();
  await expect(reward).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음 시계 만나기' })).toHaveCount(0);
  await expect(page.locator('.time-readout .time-blank')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '정답 확인하기' })).toBeDisabled();
  await expect(page.locator('.stat')).toContainText('1개의 시계');
  const next = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sijong.single.v1')!).students[0].progress.practice,
  );
  expect(next.cardId).not.toBe(q.cardId);
  expect(next.answer).toBeNull();
  await expect(page.locator('[data-action="sound"]')).toHaveCount(0);
});

test('tablet shows all eight portrait cards in two rows of four', async ({ page }) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  for (const size of [
    { width: 1024, height: 768 },
    { width: 1180, height: 820 },
  ]) {
    await page.setViewportSize(size);
    const boxes = await page.locator('[data-reading-card]').evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.x, y: r.y, bottom: r.bottom };
      }),
    );
    expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(2);
    expect(boxes.slice(0, 4).every((b) => Math.abs(b.y - boxes[0].y) < 2)).toBe(true);
    expect(Math.max(...boxes.map((b) => b.bottom))).toBeLessThan(size.height);
    const picture = await page.locator('.picture-button').first().boundingBox();
    expect(picture!.height).toBeGreaterThan(picture!.width);
  }
});

test('older saved practice questions migrate to an actual personal card', async ({ page }) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /연습모드/ }).click();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('sijong.single.v1')!);
    delete data.students[0].progress.practice.cardId;
    data.students[0].progress.practice.hour = 2;
    localStorage.setItem('sijong.single.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /연습모드/ }).click();
  const matchesCard = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('sijong.single.v1')!).students[0],
      q = s.progress.practice;
    return s.cards.some(
      (c: { id: string; minute: number }) =>
        c.id === q.cardId &&
        (Math.floor(c.minute / 60) % 12 || 12) === q.hour &&
        c.minute % 60 === q.minute,
    );
  });
  expect(matchesCard).toBe(true);
});

test('hour hint highlights the interval without filling an answer and clocks match the blue card', async ({
  page,
}) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /연습모드/ }).click();
  await expect(page.getByRole('button', { name: /크게 보기/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /짧은 바늘 사이 보기/ })).toBeVisible({
    timeout: 1500,
  });
  await page.getByRole('button', { name: /짧은 바늘 사이 보기/ }).click();
  await expect(page.locator('[data-hint="hour"]')).toBeVisible();
  await expect(page.locator('.hint-explanation')).toContainText('짧은 바늘');
  await expect(page.getByRole('button', { name: '정답 확인하기' })).toBeDisabled();
  await expect(page.locator('.clock-face')).toHaveAttribute('stroke', '#2583ff');
  await expect(page.locator('.clock-panel .paper-card')).toBeVisible();
});

test('teacher imports multiple tablet results without overwriting another student', async ({
  page,
}) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /연습모드/ }).click();
  const students = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sijong.single.v1')!).students,
  );
  const records = students.slice(0, 2).map((s: any) => {
    s.progress.stage = 'completed';
    s.progress.order = [...s.cards]
      .sort((a: any, b: any) => a.minute - b.minute)
      .map((c: any) => c.id);
    s.progress.answers = Object.fromEntries(
      s.cards.map((c: any) => [
        c.id,
        { hour: Math.floor(c.minute / 60) % 12 || 12, minute: c.minute % 60 },
      ]),
    );
    return {
      name: s.id + '.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({ kind: 'sijong-student-result', version: 1, student: s }),
      ),
    };
  });
  await page.reload();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /공유모드/ }).click();
  await expect(page.getByRole('button', { name: '홈', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '선생님 설정', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '선생님 설정', exact: true }).click();
  await expect(page.getByLabel('완료 기록 불러오기')).toBeAttached();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByLabel('완료 기록 불러오기').setInputFiles(records);
  await expect(page.getByText('2명의 완료 기록을 불러왔어요.')).toBeVisible();
  await page.getByRole('button', { name: '공유모드 열기', exact: true }).click();
  await expect(page.getByRole('button', { name: '별이 일과표 보기', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '하늘 일과표 보기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '별이 일과표 보기', exact: true }).click();
  await expect(page.locator('.timeline-card')).toHaveCount(8);
  await page.getByRole('button', { name: '하늘 일과표 보기', exact: true }).click();
  await expect(page.locator('.timeline-card').first()).toContainText('하늘');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('sijong.single.v1')!).students[2]),
  ).toEqual(students[2]);
});

test('minutes stay unselected and partial answers survive reload in both modes', async ({
  page,
}) => {
  for (const mode of ['연습모드', '실전모드']) {
    await page.reload();
    await page.getByRole('button', { name: '게임 시작' }).click();
    await page.getByRole('button', { name: '별이', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(mode) }).click();
    if (mode === '실전모드')
      await page
        .getByRole('button', { name: /시각 고르기/ })
        .first()
        .click();
    await page.getByRole('button', { name: '7시', exact: true }).click();
    await expect(page.getByRole('button', { name: '00분', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(
      page.getByRole('button', {
        name: mode === '연습모드' ? '정답 확인하기' : '입력 완료',
        exact: true,
      }),
    ).toBeDisabled();
    await expect(page.getByText('분도 골라 주세요', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: '게임 시작' }).click();
    await page.getByRole('button', { name: '별이', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(mode) }).click();
    if (mode === '실전모드')
      await page
        .getByRole('button', { name: /시각 고르기/ })
        .first()
        .click();
    await expect(page.getByRole('button', { name: '7시', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: '00분', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.getByRole('button', { name: '00분', exact: true }).click();
    await expect(
      page.getByRole('button', {
        name: mode === '연습모드' ? '정답 확인하기' : '입력 완료',
        exact: true,
      }),
    ).toBeEnabled();
  }
});

test('dialog card flips while preserving the selected time', async ({ page }) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await page
    .getByRole('button', { name: /시각 고르기/ })
    .first()
    .click();
  await page.getByRole('button', { name: '7시', exact: true }).click();
  const flip = page.getByRole('button', { name: '입력창 카드 뒤집기' });
  await flip.click();
  await expect(flip.locator('.card-caption')).toBeVisible();
  await expect(page.getByRole('button', { name: '7시', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await flip.click();
  await expect(flip.locator('.clock-face')).toBeVisible();
});

test('settings is available on screens and dialog close preserves partial answers', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: '선생님 준비', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '선생님 설정', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await expect(page.getByRole('button', { name: '선생님 설정', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  for (const mode of ['연습모드', '공유모드']) {
    await page.getByRole('button', { name: new RegExp(mode) }).click();
    await page.getByRole('button', { name: '선생님 설정', exact: true }).click();
    await page.getByRole('button', { name: '이전 화면으로', exact: true }).click();
    await page.getByRole('button', { name: '홈', exact: true }).click();
  }
  await page.getByRole('button', { name: /실전모드/ }).click();
  await page
    .getByRole('button', { name: /시각 고르기/ })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: '7시', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '선생님 설정', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '홈', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: '나중에 이어하기' })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: /시각 고르기/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '7시', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '00분', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
});

test('home and settings align and practice controls stay still through answers and feedback', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: '게임 시작' }).click();
  await expect(page.getByRole('button', { name: '시작 화면으로' })).toHaveCount(0);
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await expect(page.getByRole('button', { name: '이름 다시 고르기' })).toHaveCount(0);
  const home = page.getByRole('button', { name: '홈', exact: true });
  const gear = page.getByRole('button', { name: '선생님 설정', exact: true });
  const h = (await home.boundingBox())!,
    g = (await gear.boundingBox())!;
  expect([h.y, h.width, h.height]).toEqual([g.y, g.width, g.height]);
  for (const button of [home, gear]) {
    const b = (await button.boundingBox())!,
      icon = (await button.locator('svg').boundingBox())!;
    expect(Math.abs(b.x + b.width / 2 - icon.x - icon.width / 2)).toBeLessThan(1);
    expect(Math.abs(b.y + b.height / 2 - icon.y - icon.height / 2)).toBeLessThan(1);
  }
  await page.getByRole('button', { name: /연습모드/ }).click();
  const q = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sijong.single.v1')!).students[0].progress.practice,
  );
  const positions = () =>
    page
      .locator('.clock-panel, .reward-panel, .hours, [data-action=practice-check], .stat')
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height];
        }),
      );
  const before = await positions();
  await page.getByRole('button', { name: `${(q.hour % 12) + 1}시`, exact: true }).click();
  await page.getByRole('button', { name: '00분', exact: true }).click();
  expect(await positions()).toEqual(before);
  await page.getByRole('button', { name: '정답 확인하기' }).click();
  expect(await positions()).toEqual(before);
  await page.getByRole('button', { name: `${q.hour}시`, exact: true }).click();
  await page
    .getByRole('button', { name: `${String(q.minute).padStart(2, '0')}분`, exact: true })
    .click();
  await page.getByRole('button', { name: '정답 확인하기' }).click();
  const reward = await positions();
  expect(reward.slice(0, 2)).toEqual(before.slice(0, 2));
  expect(reward.at(-1)).toEqual(before.at(-1));
  await page.screenshot({ path: '.local/classroom/aligned-practice.png' });
  await page.getByRole('button', { name: /일과 카드 눌러 다음 문제/ }).click();
  expect(await positions()).toEqual(before);
  await home.click();
  await expect(page.getByRole('heading', { name: '무엇을 해 볼까요?' })).toBeVisible();
});

test('dialog number grid and submit button remain fixed from empty to complete time', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await page
    .getByRole('button', { name: /시각 고르기/ })
    .first()
    .click();
  const positions = () =>
    page
      .getByRole('dialog')
      .locator('.hours, .minutes, [data-action=close-answer]')
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height];
        }),
      );
  const initial = await positions();
  await page.getByRole('dialog').getByRole('button', { name: '7시', exact: true }).click();
  expect(await positions()).toEqual(initial);
  await page.getByRole('dialog').getByRole('button', { name: '30분', exact: true }).click();
  expect(await positions()).toEqual(initial);
  await page.screenshot({ path: '.local/classroom/aligned-dialog.png' });
});

test('home clears practice count and answer for a fresh attempt', async ({ page }) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  await page.getByRole('button', { name: /연습모드/ }).click();
  const q = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sijong.single.v1')!).students[0].progress.practice,
  );
  await page.getByRole('button', { name: q.hour + '시', exact: true }).click();
  await page
    .getByRole('button', { name: String(q.minute).padStart(2, '0') + '분', exact: true })
    .click();
  await page.getByRole('button', { name: '정답 확인하기' }).click();
  await expect(page.locator('.stat')).toContainText('1개의 시계');
  await page.getByRole('button', { name: '홈', exact: true }).click();
  await page.getByRole('button', { name: /연습모드/ }).click();
  await expect(page.locator('.stat')).toContainText('0개의 시계');
  await expect(page.locator('.time-readout .time-blank')).toHaveCount(2);
});

test('student name badges stay aligned and return to student selection', async ({ page }) => {
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.getByRole('button', { name: '별이', exact: true }).click();
  const initial = await page.locator('.top .chip').boundingBox();
  for (const mode of ['연습모드', '실전모드', '공유모드']) {
    await page.getByRole('button', { name: new RegExp(mode) }).click();
    const box = await page.locator('.top .chip').boundingBox();
    expect(box!.x).toBe(initial!.x);
    expect(box!.y).toBe(initial!.y);
    await page.getByRole('button', { name: '홈', exact: true }).click();
  }
  await page.getByRole('button', { name: '✦ 별이', exact: true }).click();
  await expect(page.getByRole('button', { name: '하늘', exact: true })).toBeVisible();
});
