import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { AuthService } from '../auth/service';
import { isDirect, maintenance } from './common';
async function secret() {
  if (process.env.SIJONG_NEW_TEACHER_PASSWORD) return process.env.SIJONG_NEW_TEACHER_PASSWORD;
  if (!process.stdin.isTTY) {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    return input.trim();
  }
  process.stdout.write('새 선생님 비밀번호 (8자 이상, 입력 내용은 표시하지 않습니다): ');
  const silent = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output: silent, terminal: true });
  return await new Promise<string>((resolve) =>
    rl.question('', (value) => {
      rl.close();
      process.stdout.write('\n');
      resolve(value);
    }),
  );
}
if (isDirect(import.meta.url))
  secret()
    .then((password) =>
      maintenance((store, config) => {
        if (password.length < 8) throw Error('8자 이상 비밀번호가 필요합니다');
        const auth = new AuthService(store, { ...config, teacherPassword: password });
        auth.changeTeacherPassword(password);
        console.log('선생님 비밀번호를 설정하고 이전 접속을 해제했습니다.');
      }),
    )
    .catch(() => {
      console.error('비밀번호를 설정하지 못했습니다. 서버를 종료하고 8자 이상으로 입력해 주세요.');
      process.exitCode = 1;
    });
