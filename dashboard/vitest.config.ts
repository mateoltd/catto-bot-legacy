import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    include: ['__tests__/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./__tests__/setup.ts'],
    testTimeout: 10000,
  },
});
