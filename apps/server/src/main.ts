import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { Config } from './config';
import { readConfig } from './config';
import { openStore } from './db';
import { createApp } from './app';
import { acquireDataLock } from './shutdown';
export async function startServer(
  config: Config,
): Promise<{ url: string; close: () => Promise<void> }> {
  const release = acquireDataLock(config.dbPath);
  let store: ReturnType<typeof openStore> | undefined;
  try {
    store = openStore(config);
    const effective = { ...config },
      app = createApp({ store, config: effective }),
      server = createServer(app);
    await new Promise<void>((done, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, () => {
        server.off('error', reject);
        done();
      });
    });
    const address = server.address() as { port: number };
    const url = `http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${address.port}`;
    if (config.port === 0) effective.publicOrigin = url;
    let closing: Promise<void> | null = null;
    return {
      url,
      close() {
        return (closing ??= (async () => {
          app.locals.hub.close();
          await new Promise<void>((done) => {
            const timeout = setTimeout(() => server.closeAllConnections(), 5000);
            timeout.unref();
            server.close(() => {
              clearTimeout(timeout);
              done();
            });
            server.closeIdleConnections();
          });
          store!.close();
          release();
        })());
      },
    };
  } catch (e) {
    store?.close();
    release();
    throw e;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startServer(readConfig())
    .then((server) => {
      console.log(`시계 학습 앱 실행됨: ${server.url}`);
      for (const signal of ['SIGINT', 'SIGTERM'] as const)
        process.once(signal, () => {
          void server.close().then(() => process.exit(0));
        });
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : '앱을 시작하지 못했습니다');
      process.exitCode = 1;
    });
}
