import { backup } from 'node:sqlite';
import { mkdir, copyFile, chmod, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Store } from '../db';
import { isDirect, maintenance } from './common';
export async function backupStore(
  store: Store,
  targetDir: string,
  keyPath = join(dirname(store.config.dbPath), 'server.key'),
) {
  await mkdir(dirname(targetDir), { recursive: true, mode: 0o700 });
  await mkdir(targetDir, { mode: 0o700 });
  const dbFile = join(targetDir, 'sijong.sqlite'),
    manifestFile = join(targetDir, 'manifest.json');
  try {
    await backup(store.db, dbFile);
    await chmod(dbFile, 0o600);
    await mkdir(join(targetDir, 'images'), { mode: 0o700 });
    const images = store.images.list();
    for (const image of images) {
      const path = join(targetDir, 'images', image.file);
      await copyFile(join(store.config.uploadDir, image.file), path);
      await chmod(path, 0o600);
    }
    await copyFile(keyPath, join(targetDir, 'server.key'));
    await chmod(join(targetDir, 'server.key'), 0o600);
    await writeFile(
      manifestFile,
      JSON.stringify(
        {
          version: 1,
          createdAt: new Date().toISOString(),
          imageCount: images.length,
          database: 'sijong.sqlite',
          images: 'images',
          key: 'server.key',
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    return { dbFile, manifestFile };
  } catch (e) {
    await rm(targetDir, { recursive: true, force: true });
    throw e;
  }
}
if (isDirect(import.meta.url))
  maintenance(async (store, config) => {
    const directory = resolve(
      process.env.SIJONG_BACKUP_DIR ||
        join(dirname(config.dbPath), 'backups', new Date().toISOString().replace(/[:.]/g, '-')),
    );
    await backupStore(store, directory, config.keyPath);
    console.log('백업을 저장했습니다:', directory);
  }).catch(() => {
    console.error('백업하지 못했습니다. 서버가 종료되어 있는지, 새 백업 경로인지 확인해 주세요.');
    process.exitCode = 1;
  });
