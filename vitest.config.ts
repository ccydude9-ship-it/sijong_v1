import { defineConfig } from 'vitest/config';
export default defineConfig({test:{projects:[{test:{name:'server',environment:'node',include:['tests/domain/**/*.test.ts','tests/server/**/*.test.ts'],fileParallelism:false}},{test:{name:'web',environment:'jsdom',include:['tests/web/**/*.test.tsx'],setupFiles:['tests/helpers/setup-web.ts']}}]}});
