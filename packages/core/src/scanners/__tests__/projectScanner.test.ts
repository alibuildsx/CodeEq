import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from '../projectScanner.js';

describe('scanProject v0.2 findings', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-scan-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  it('adds deployment, score, readiness, and API route data to a Next.js scan', async () => {
    await write('package.json', JSON.stringify({
      name: 'next-app',
      scripts: { build: 'next build' },
      dependencies: { next: '^16.0.0' },
    }));
    await write('tsconfig.json', '{}');
    await write('next.config.ts', 'export default {};');
    await write('.env.local', 'DATABASE_URL=private');
    await write('.gitignore', '.env*.local');
    await write('src/app/api/health/route.ts', 'export function GET() {}');

    const result = await scanProject(tmpDir);

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ENV_NO_EXAMPLE', severity: 'medium' }),
      expect.objectContaining({ code: 'MISSING_START_SCRIPT', severity: 'low' }),
    ]));
    expect(result.healthScore).toBe(85);
    expect(result.deploymentReadiness).toBe('Needs attention');
    expect(result.apiRoutes).toEqual(['src/app/api/health/route.ts']);
  });

  it('reports only missing variable names when .env.example is incomplete', async () => {
    await write('package.json', JSON.stringify({
      scripts: { build: 'tsc', start: 'node dist/index.js' },
      dependencies: { express: '^5.0.0' },
    }));
    await write('.env', 'DATABASE_URL=private-value\nPORT=3000\n');
    await write('.env.example', 'PORT=\n');
    await write('.gitignore', '.env\n');

    const result = await scanProject(tmpDir);
    const issue = result.issues.find((candidate) => candidate.code === 'ENV_EXAMPLE_MISSING_VARIABLES');

    expect(issue).toMatchObject({ severity: 'medium' });
    expect(issue?.detail).toContain('DATABASE_URL');
    expect(issue?.detail).not.toContain('private-value');
  });

  it('does not require a start script for a static Vite project', async () => {
    await write('package.json', JSON.stringify({
      scripts: { build: 'vite build' },
      devDependencies: { vite: '^7.0.0' },
    }));
    await write('tsconfig.base.json', '{}');

    const result = await scanProject(tmpDir);

    expect(result.projectInfo.language).toBe('typescript');
    expect(result.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_START_SCRIPT' }),
    ]));
  });
});
