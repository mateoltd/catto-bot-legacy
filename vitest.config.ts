import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '#root': path.resolve(__dirname, './src'),
      '#structures': path.resolve(__dirname, './src/structures'),
      '#commands': path.resolve(__dirname, './src/commands'),
      '#listeners': path.resolve(__dirname, './src/listeners'),
      '#routes': path.resolve(__dirname, './src/routes'),
      '#preconditions': path.resolve(__dirname, './src/preconditions'),
      '#lib': path.resolve(__dirname, './src/lib'),
      '#modules': path.resolve(__dirname, './src/modules'),
      '#config': path.resolve(__dirname, './src/config.ts'),
    },
  },
  test: {
    include: ['scripts/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      include: [
        'scripts/lib/**/*.ts',
        'src/routes/**/*.ts',
        'src/lib/dtos/**/*.ts',
        'src/lib/storage/**/*.ts',
        'src/lib/cache/**/*.ts',
        'src/lib/utils/ogFetcher.ts',
        'src/modules/moderation/services/**/*.ts',
      ],
      exclude: ['scripts/lib/**/*.test.ts', 'tests/**/*.test.ts'],
    },
  },
});
