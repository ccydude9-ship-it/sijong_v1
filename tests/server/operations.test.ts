import { it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { createFixture } from '../helpers/fixture';
import { createServerFixture } from '../helpers/server';
import { startServer } from '../../apps/server/src/main';
import { backupStore } from '../../apps/server/src/cli/backup';
import { openStore } from '../../apps/server/src/db';
import { AuthService } from '../../apps/server/src/auth/service';
import { readConfig } from '../../apps/server/src/config';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
  cleanups.length = 0;
});
async function ready() {
  const f = await createFixture();
  f.store.close();
  f.config.publicOrigin = 'http://127.0.0.1:0';
  cleanups.push(f.cleanup);
  return f;
}
async function server() {
  const f = await ready(),
    s = await startServer(f.config);
  cleanups.push(s.close);
  return { ...f, server: s };
}
it('production_serves_spa_and_health', async () => {
  const f = await server(),
    r = await fetch(`${f.server.url}/api/health`);
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ ok: true });
  const html = await fetch(f.server.url);
  expect(html.headers.get('content-type')).toContain('text/html');
  expect(await html.text()).toContain('시계는 째깍!');
});
it('unknown_api_is_json_404', async () => {
  const f = await server(),
    r = await fetch(`${f.server.url}/api/not-found`);
  expect(r.status).toBe(404);
  expect(r.headers.get('content-type')).toContain('application/json');
});
it('bootstrap_missing_password_fails_without_leaking_lock', async () => {
  const f = await ready();
  await expect(startServer({ ...f.config, teacherPassword: undefined })).rejects.toThrow(
    'SIJONG_TEACHER_PASSWORD',
  );
  const s = await startServer(f.config);
  cleanups.push(s.close);
  expect((await fetch(`${s.url}/api/health`)).status).toBe(200);
});
it('existing_db_does_not_reset_password', async () => {
  const f = await ready(),
    first = await startServer(f.config);
  await first.close();
  const s = await startServer({ ...f.config, teacherPassword: crypto.randomUUID() });
  cleanups.push(s.close);
  const r = await fetch(`${s.url}/api/auth/teacher`, {
    method: 'POST',
    headers: { Origin: s.url, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: f.config.teacherPassword }),
  });
  expect(r.status).toBe(200);
  expect(await r.json()).not.toHaveProperty('token');
});
it('graceful_close_releases_sse_and_db', async () => {
  const f = await server();
  const r = await fetch(`${f.server.url}/api/auth/teacher`, {
    method: 'POST',
    headers: { Origin: f.server.url, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: f.config.teacherPassword }),
  });
  const cookie = r.headers.get('set-cookie')!.split(';')[0];
  const stream = await fetch(`${f.server.url}/api/events?lessonId=${f.lessonId}`, {
      headers: { Cookie: cookie },
    }),
    reader = stream.body!.getReader();
  expect((await reader.read()).done).toBe(false);
  await f.server.close();
  await reader.cancel();
  const restored = openStore(f.config);
  expect(restored.lessons.get(f.lessonId)).toBeTruthy();
  restored.close();
});
it('backup_reopens_with_images_and_key', async () => {
  const f = await createServerFixture();
  cleanups.push(f.cleanup);
  const destination = join(f.root, 'backup');
  const result = await backupStore(f.store, destination, f.config.keyPath);
  expect((await stat(destination)).mode & 0o777).toBe(0o700);
  const restored = openStore({ dbPath: result.dbFile, uploadDir: join(destination, 'images') });
  try {
    const auth = new AuthService(restored, {
      ...f.config,
      keyPath: join(destination, 'server.key'),
    });
    expect(auth.loginTeacher(f.config.teacherPassword!).session.role).toBe('teacher');
    const student = restored.students.list(f.lessonId)[0],
      image = restored.images.get(restored.students.cards(student.id)[0].imageId)!;
    expect((await readFile(join(destination, 'images', image.file))).length).toBeGreaterThan(0);
    expect(JSON.parse(await readFile(result.manifestFile, 'utf8')).imageCount).toBe(48);
  } finally {
    restored.close();
  }
});
it('backup_refuses_existing_destination', async () => {
  const f = await createServerFixture();
  cleanups.push(f.cleanup);
  const dest = join(f.root, 'backup');
  await backupStore(f.store, dest, f.config.keyPath);
  await expect(backupStore(f.store, dest, f.config.keyPath)).rejects.toThrow();
});
it('server_lock_rejects_duplicate_start', async () => {
  const f = await server();
  await expect(startServer(f.config)).rejects.toThrow('사용 중');
});
it('production_cookie_requires_https_origin', () => {
  expect(() =>
    readConfig({ NODE_ENV: 'production', SIJONG_PUBLIC_ORIGIN: 'http://example.com' }),
  ).toThrow('HTTPS');
  expect(
    readConfig({ NODE_ENV: 'production', SIJONG_PUBLIC_ORIGIN: 'https://example.com' })
      .secureCookies,
  ).toBe(true);
});
