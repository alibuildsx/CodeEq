import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectApiRoutes } from '../apiRoutes.js';

describe('detectApiRoutes', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-api-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function create(relativePath: string): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, 'export {};', 'utf-8');
  }

  it('finds supported App Router and Pages Router JavaScript and TypeScript API routes', async () => {
    await Promise.all([
      create('app/api/health/route.ts'),
      create('app/api/users/[id]/route.tsx'),
      create('src/app/api/session/route.ts'),
      create('src/app/api/upload/route.tsx'),
      create('pages/api/index.ts'),
      create('src/pages/api/users/[id].ts'),
      create('app/api/javascript/route.js'),
      create('src/pages/api/legacy.js'),
      create('app/not-api/route.ts'),
      create('pages/not-api.ts'),
    ]);

    await expect(detectApiRoutes(tmpDir)).resolves.toEqual([
      'app/api/health/route.ts',
      'app/api/javascript/route.js',
      'app/api/users/[id]/route.tsx',
      'pages/api/index.ts',
      'src/app/api/session/route.ts',
      'src/app/api/upload/route.tsx',
      'src/pages/api/legacy.js',
      'src/pages/api/users/[id].ts',
    ]);
  });
});
