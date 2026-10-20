import { startServer } from '../apps/server/src/main';
import { readConfig } from '../apps/server/src/config';
const env = {
  ...process.env,
  SIJONG_DATA_DIR: process.env.SIJONG_DATA_DIR || '.local/live-classroom',
};
startServer({ ...readConfig(env), standalone: true })
  .then((server) => {
    console.log(`수업용 단일 웹앱: ${server.url}`);
    for (const signal of ['SIGINT', 'SIGTERM'] as const)
      process.once(signal, () => void server.close().then(() => process.exit(0)));
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : '수업 서버를 열지 못했습니다');
    process.exitCode = 1;
  });
