import { spawn } from 'node:child_process';
const env = {
  ...process.env,
  SIJONG_PUBLIC_ORIGIN: process.env.SIJONG_PUBLIC_ORIGIN || 'http://127.0.0.1:5173',
};
const processes = [
  spawn(
    process.execPath,
    ['--env-file-if-exists=.env', '--import', 'tsx', '--watch', 'apps/server/src/main.ts'],
    { env, stdio: 'inherit' },
  ),
  spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'apps/web',
      '--config',
      'apps/web/vite.config.ts',
      '--port',
      '5173',
      '--strictPort',
    ],
    { env, stdio: 'inherit' },
  ),
];
let stopping = false;
function stop(code: number) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => stop(0));
for (const child of processes) {
  child.once('error', () => stop(1));
  child.once('exit', (code) => stop(code || 0));
}
