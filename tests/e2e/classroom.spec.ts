import { toClockTime } from '../../packages/domain/src/index';
import { test, expect, teacherPage, studentPage, completePractical } from '../helpers/browser';
test('teacher saves edited cards before starting and students see the same titles', async ({
  browser,
  page,
  classroom: c,
}) => {
  await page.goto(c.url);
  await page.getByRole('button', { name: '선생님 입장' }).click();
  await page.getByLabel('선생님 비밀번호').fill(c.config.teacherPassword!);
  await page.getByRole('button', { name: '입장하기', exact: true }).click();
  await page.getByLabel('일과 이름').first().fill('수정된 일과');
  await expect(page.getByRole('button', { name: '수업 시작하기' })).toBeDisabled();
  await expect(page.getByText(/변경한 학생 카드를 저장하거나 취소/)).toBeVisible();
  await page.getByRole('button', { name: '이 학생 저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '수업 시작하기' })).toBeEnabled();
  await page.getByRole('button', { name: '수업 시작하기' }).click();
  await expect(page.getByText('함께 배우는 중')).toBeVisible();
  await expect(page.getByLabel('일과 이름').first()).toHaveValue('수정된 일과');
  const ctx = await browser.newContext();
  try {
    const p = await ctx.newPage();
    await studentPage(p, c, c.students[0]);
    await p.getByRole('button', { name: /실전모드/ }).click();
    await expect(p.getByRole('button', { name: '수정된 일과 카드 뒤집기' })).toBeVisible();
  } finally {
    await ctx.close();
  }
});
test('arcade entry and six independent students with live teacher dashboard', async ({
  browser,
  page,
  classroom: c,
}) => {
  await page.goto(c.url);
  await expect(page.getByRole('heading', { name: '시계는 째깍! 하루는 찰칵!' })).toBeVisible();
  await page.screenshot({ path: '.superpowers/sdd/2026-10-15-clock-learning-app/title.png' });
  await teacherPage(page, c);
  const peers = [];
  try {
    for (let i = 0; i < 6; i++) {
      const context = await browser.newContext({ viewport: { width: 1024, height: 768 } }),
        p = await context.newPage();
      peers.push({ context, page: p });
      await studentPage(p, c, c.students[i]);
      await p
        .getByRole('button', {
          name: i % 3 === 0 ? /실전모드/ : i % 3 === 1 ? /연습모드/ : /공유모드/,
        })
        .click();
    }
    await expect(page.getByTestId(`student-summary-${c.students[0].id}`)).toContainText('접속 중');
    for (let i = 0; i < 6; i++) {
      const p = peers[i].page;
      if (i % 3 === 0) {
        await expect(p.getByRole('heading', { name: '착착! 시각을 읽어요' })).toBeVisible();
        const card = c.store.students.cards(c.students[i].id)[0];
        await expect(p.getByRole('button', { name: `${card.title} 카드 뒤집기` })).toBeVisible();
        const other = c.store.students.cards(c.students[(i + 1) % 6].id)[0];
        await expect(p.getByRole('button', { name: `${other.title} 카드 뒤집기` })).toHaveCount(0);
      } else if (i % 3 === 1)
        await expect(p.getByRole('heading', { name: '째깍! 지금 몇 시일까요?' })).toBeVisible();
      else await expect(p.getByText('실전모드에서 일과표를 완성해 주세요')).toBeVisible();
      await p.getByRole('button', { name: '홈으로 돌아가기' }).click();
      await expect(p.getByRole('heading', { name: /무엇을 해 볼까요/ })).toBeVisible();
    }
  } finally {
    for (const peer of peers) await peer.context.close();
  }
});
test('personal reading ordering completion sharing and home roundtrip', async ({
  browser,
  page,
  classroom: c,
}) => {
  await teacherPage(page, c);
  const ctx = await browser.newContext(),
    p = await ctx.newPage();
  try {
    await studentPage(p, c, c.students[0]);
    await completePractical(p, c, c.students[0]);
    await expect(page.getByTestId(`student-summary-${c.students[0].id}`)).toContainText('완료', {
      timeout: 2000,
    });
    await p.getByRole('button', { name: '홈으로 돌아가기' }).click();
    await p.getByRole('button', { name: /공유모드/ }).click();
    await expect(p.getByText(c.store.students.cards(c.students[0].id)[0].title)).toBeVisible();
    await page.getByRole('button', { name: `${c.students[0].displayName} 일과표 보기` }).click();
    await expect(p.getByRole('heading', { name: '찰칵! 내 하루를 들려줘' })).toBeVisible();
    await p.getByRole('button', { name: '홈으로 돌아가기' }).click();
    await p.getByRole('button', { name: /실전모드/ }).click();
    await expect(p.getByRole('heading', { name: '내 하루 완성!' })).toBeVisible();
  } finally {
    await ctx.close();
  }
});
test('reload starts at title and selecting another name never reuses cards', async ({
  page,
  classroom: c,
}) => {
  c.store.lessons.set({ ...c.store.lessons.get(c.lessonId)!, phase: 'active' });
  await studentPage(page, c, c.students[0]);
  await page.reload();
  await expect(page.getByRole('heading', { name: '시계는 째깍! 하루는 찰칵!' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /내 이름을 골라요/ })).toBeVisible();
  await page.getByRole('button', { name: c.students[1].displayName, exact: true }).click();
  await page.getByRole('button', { name: /실전모드/ }).click();
  await expect(
    page.getByRole('button', {
      name: `${c.store.students.cards(c.students[1].id)[0].title} 카드 뒤집기`,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: `${c.store.students.cards(c.students[0].id)[0].title} 카드 뒤집기`,
    }),
  ).toHaveCount(0);
});
test('first tap waits for session loading instead of trapping title', async ({
  page,
  classroom: c,
}) => {
  await page.context().request.post(`${c.url}/api/auth/classroom`, {
    headers: { Origin: c.url },
    data: { code: c.code },
  });
  let release: () => void = () => {},
    intercepted = false;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/api/session', async (route) => {
    intercepted = true;
    await gate;
    await route.continue();
  });
  await page.goto(c.url);
  await expect.poll(() => intercepted).toBe(true);
  await page.getByRole('button', { name: '게임 시작' }).click();
  release();
  await expect(page.getByRole('heading', { name: /내 이름을 골라요/ })).toBeVisible();
});
test('touch and keyboard ordering work without changing card identities', async ({
  page,
  classroom: c,
}) => {
  c.store.lessons.set({ ...c.store.lessons.get(c.lessonId)!, phase: 'active' });
  const student = c.students[0],
    cards = c.store.students.cards(student.id),
    p = c.store.progress.get(student.id);
  c.store.progress.set({
    ...p,
    stage: 'ordering',
    answers: Object.fromEntries(cards.map((card) => [card.id, toClockTime(card.minuteOfDay)])),
  });
  await studentPage(page, c, student);
  await page.getByRole('button', { name: /실전모드/ }).click();
  const ids = () =>
    page
      .locator('[data-order-card]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.orderCard!));
  const before = await ids(),
    handle = await page.locator('.drag-handle').first().boundingBox(),
    target = await page.locator('[data-order-card]').nth(1).boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect.poll(ids).not.toEqual(before);
  const current = await ids(),
    card = cards.find((c) => c.id === current[1])!;
  await page.getByRole('button', { name: `${card.title} 뒤로`, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(ids).not.toEqual(current);
  expect(new Set(await ids()).size).toBe(8);
});
test('small screen controls remain accessible with reduced motion', async ({
  browser,
  classroom: c,
}) => {
  c.store.lessons.set({ ...c.store.lessons.get(c.lessonId)!, phase: 'active' });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage();
  try {
    await page.goto(c.url);
    expect(
      await page.locator('.start-prompt>span').evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none');
    await studentPage(page, c, c.students[0]);
    await page.getByRole('button', { name: /연습모드/ }).click();
    const button = page.getByRole('button', { name: '5시', exact: true });
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(48);
    expect(box!.height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    await context.close();
  }
});
