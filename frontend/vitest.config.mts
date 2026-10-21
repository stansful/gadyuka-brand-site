import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // shared/ at the repository root (messages, API contracts) — tsconfig paths "@shared/*"
      '@shared': path.resolve(import.meta.dirname, '../shared'),
      'server-only': path.resolve(import.meta.dirname, 'test/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
