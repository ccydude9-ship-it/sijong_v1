import { resolve, join } from 'node:path';
export type Config = {
  port: number;
  host: string;
  publicOrigin: string;
  dbPath: string;
  uploadDir: string;
  teacherPassword?: string;
  secureCookies: boolean;
  keyPath: string;
};
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dir = resolve(env.SIJONG_DATA_DIR || '.local');
  const port = Number(env.PORT || 3000);
  const rawOrigin = env.SIJONG_PUBLIC_ORIGIN || `http://127.0.0.1:${port}`;
  const parsed = new URL(rawOrigin);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  )
    throw Error('올바른 공개 주소를 설정해 주세요');
  const publicOrigin = parsed.origin;
  if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:')
    throw Error('운영 환경에는 HTTPS 주소가 필요합니다');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('올바른 포트가 필요합니다');
  return {
    port,
    host: env.HOST || '127.0.0.1',
    publicOrigin,
    dbPath: join(dir, 'sijong.sqlite'),
    uploadDir: join(dir, 'images'),
    keyPath: join(dir, 'server.key'),
    teacherPassword: env.SIJONG_TEACHER_PASSWORD,
    secureCookies: publicOrigin.startsWith('https://'),
  };
}
