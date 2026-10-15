import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
export function acquireDataLock(dbPath: string) {
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const path = `${dbPath}.lock`;
  function create() {
    writeFileSync(path, JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 });
  }
  try {
    create();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    let pid: number;
    try {
      pid = JSON.parse(readFileSync(path, 'utf8')).pid;
      if (!Number.isInteger(pid) || pid <= 0) throw Error();
    } catch {
      throw Error('데이터 잠금 파일을 확인해 주세요');
    }
    try {
      process.kill(pid, 0);
      throw Error('수업 데이터가 사용 중입니다. 서버를 먼저 종료해 주세요');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
    unlinkSync(path);
    create();
  }
  return () => {
    try {
      const current = JSON.parse(readFileSync(path, 'utf8'));
      if (current.pid === process.pid) unlinkSync(path);
    } catch {}
  };
}
