import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const coreDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(coreDir, '../../apps/web');

export default defineConfig({
  root: webDir,
  resolve: {
    alias: {
      '@codeeq/core': path.resolve(coreDir, 'src/index.ts'),
      '@': path.resolve(webDir, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
