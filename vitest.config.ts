import path from 'node:path';
import { defineConfig } from 'vitest/config';

process.env.DATABASE_URL = 'file:./test.db';
process.env.DEMO_MODE = 'true';
process.env.AUTH_PROVIDER = 'demo';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd()),
    },
  },
  test: {
    environment: 'node',
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    globalSetup: ['./tests/setup/database.ts'],
  },
});
