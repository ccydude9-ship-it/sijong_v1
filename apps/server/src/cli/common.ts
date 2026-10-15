import { readConfig, type Config } from '../config';
import { openStore, type Store } from '../db';
import { acquireDataLock } from '../shutdown';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const isDirect = (url: string) =>
  !!process.argv[1] && url === pathToFileURL(resolve(process.argv[1])).href;
export async function maintenance<T>(fn: (store: Store, config: Config) => Promise<T> | T) {
  const config = readConfig(),
    release = acquireDataLock(config.dbPath);
  let store: Store | undefined;
  try {
    store = openStore(config);
    return await fn(store, config);
  } finally {
    store?.close();
    release();
  }
}
