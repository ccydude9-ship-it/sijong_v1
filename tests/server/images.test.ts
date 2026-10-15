import { it, expect, afterEach } from 'vitest';
import sharp from 'sharp';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServerFixture, loginTeacher, teacherRequest, studentActor } from '../helpers/server';
let f: Awaited<ReturnType<typeof createServerFixture>>;
afterEach(async () => f?.cleanup());
async function setup() {
  f = await createServerFixture();
  return loginTeacher(f);
}
async function png() {
  return sharp({ create: { width: 20, height: 20, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
}
async function upload(t: { cookie: string; csrf: string }, bytes: Buffer) {
  return f.client
    .post(`/api/teacher/lessons/${f.lessonId}/students/1/images`)
    .set('Cookie', t.cookie)
    .set('Origin', f.config.publicOrigin)
    .set('X-CSRF-Token', t.csrf)
    .set('Content-Type', 'image/png')
    .send(bytes);
}
it('accepts_png_jpeg_webp_and_strips_metadata', async () => {
  const t = await setup();
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    const bytes = await sharp(await png())
      [format]()
      .withMetadata()
      .toBuffer();
    const r = await upload(t, bytes);
    expect(r.status).toBe(201);
    const img = f.store.images.get(r.body.imageId)!;
    expect(
      (await sharp(await readFile(join(f.config.uploadDir, img.file))).metadata()).exif,
    ).toBeUndefined();
  }
});
it('rejects_svg_html_and_spoofed_mime', async () => {
  const t = await setup();
  for (const input of ['<svg xmlns="http://www.w3.org/2000/svg"/>', '<script>alert(1)</script>'])
    expect((await upload(t, Buffer.from(input))).status).toBe(400);
});
it('rejects_over_2mb_or_4096_dimensions', async () => {
  const t = await setup();
  expect((await upload(t, Buffer.alloc(2 * 1024 * 1024 + 1))).status).toBe(413);
  const large = await sharp({ create: { width: 4097, height: 1, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  expect((await upload(t, large)).status).toBe(400);
});
it('only_teacher_uploads_during_preparation', async () => {
  const t = await setup();
  f.store.lessons.set({ ...f.store.lessons.get(f.lessonId)!, phase: 'active' });
  expect((await upload(t, await png())).status).toBe(409);
  expect((await upload(studentActor(f), await png())).status).toBe(403);
});
it('student_can_read_only_own_images', async () => {
  await setup();
  const [a, b] = f.store.students.list(f.lessonId),
    s = studentActor(f, a.id);
  expect(
    (
      await f.client
        .get(`/api/images/${f.store.students.cards(a.id)[0].imageId}`)
        .set('Cookie', s.cookie)
    ).status,
  ).toBe(200);
  expect(
    (
      await f.client
        .get(`/api/images/${f.store.students.cards(b.id)[0].imageId}`)
        .set('Cookie', s.cookie)
    ).status,
  ).toBe(403);
});
it('failed_image_write_keeps_previous_files', async () => {
  const t = await setup();
  const before = await readdir(f.config.uploadDir);
  f.store.db.exec(
    "CREATE TRIGGER fail_image BEFORE INSERT ON images BEGIN SELECT RAISE(ABORT,'injected'); END;",
  );
  expect((await upload(t, await png())).status).toBe(500);
  expect(await readdir(f.config.uploadDir)).toEqual(before);
});
it('failed_attach_keeps_previous_image', async () => {
  const t = await setup(),
    s = f.store.students.list(f.lessonId)[0],
    cards = f.store.students.cards(s.id);
  const u = await upload(t, await png());
  expect(u.status).toBe(201);
  f.store.db.exec(
    "CREATE TRIGGER fail_card BEFORE UPDATE ON cards BEGIN SELECT RAISE(ABORT,'injected'); END;",
  );
  const r = await teacherRequest(f, t, 'put', `/api/teacher/lessons/${f.lessonId}/students/1`, {
    displayName: s.displayName,
    distinction: '',
    cards: cards.map((c, i) => (i === 0 ? { ...c, imageId: u.body.imageId } : c)),
  });
  expect(r.status).toBe(500);
  expect(f.store.students.cards(s.id)[0].imageId).toBe(cards[0].imageId);
});
it('deleting_copied_lesson_preserves_shared_image', async () => {
  const t = await setup();
  const image = f.store.students.cards(f.store.students.list(f.lessonId)[0].id)[0].imageId;
  f.store.lessons.set({ ...f.store.lessons.get(f.lessonId)!, phase: 'ended' });
  const next = await teacherRequest(f, t, 'post', '/api/teacher/lessons');
  expect((await teacherRequest(f, t, 'delete', `/api/teacher/lessons/${f.lessonId}`)).status).toBe(
    200,
  );
  const s = studentActor(f, f.store.students.list(next.body.id)[0].id);
  expect((await f.client.get(`/api/images/${image}`).set('Cookie', s.cookie)).status).toBe(200);
});
