import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../../apps/server/src/db';
import { seedDemo } from '../../apps/server/src/demo/seed';
import type { Config } from '../../apps/server/src/config';
export async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'sijong-'));
  const config: Config = {
    port: 0,
    host: '127.0.0.1',
    publicOrigin: 'http://127.0.0.1:3000',
    dbPath: join(root, 'db.sqlite'),
    uploadDir: join(root, 'images'),
    keyPath: join(root, 'server.key'),
    secureCookies: false,
    teacherPassword: crypto.randomUUID(),
  };
  const store = openStore(config);
  const { lessonId } = await seedDemo(store);
  return {
    root,
    store,
    config,
    lessonId,
    async cleanup() {
      store.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
