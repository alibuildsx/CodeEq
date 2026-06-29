import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const coreDir = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(coreDir, '../cli');

export default defineConfig({
  root: cliDir,
  resolve: {
    alias: {
      '@codeeq/core': path.resolve(coreDir, 'src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
