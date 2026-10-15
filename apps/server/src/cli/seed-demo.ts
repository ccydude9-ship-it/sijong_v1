import { seedDemo } from '../demo/seed';
import { isDirect, maintenance } from './common';
if (isDirect(import.meta.url))
  maintenance(async (store) => {
    const result = await seedDemo(store);
    console.log(
      result.created
        ? '학생 6명의 예시 수업을 준비했습니다.'
        : '기존 예시 수업을 그대로 사용합니다.',
    );
  }).catch(() => {
    console.error(
      '예시 수업을 준비하지 못했습니다. 서버를 종료하고 기존 수업 상태를 확인해 주세요.',
    );
    process.exitCode = 1;
  });
