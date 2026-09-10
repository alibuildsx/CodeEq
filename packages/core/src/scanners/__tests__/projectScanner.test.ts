import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from '../projectScanner.js';

describe('scanProject M2 CP1 findings and intelligence', () => {
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

  it('adds deployment, score, readiness, Project Intelligence, and API route data to a Next.js scan', async () => {
    await write('package.json', JSON.stringify({
      name: 'next-app',
      packageManager: 'pnpm@9.0.0',
      scripts: { build: 'next build' },
      dependencies: {
        next: '^16.0.0',
        '@supabase/supabase-js': '^2.39.0',
      },
      devDependencies: {
        vitest: '^1.0.0',
      },
    }));
    await write('tsconfig.json', '{}');
    await write('next.config.ts', 'export default {};');
    await write('.env.local', 'DATABASE_URL=private');
    await write('.gitignore', '.env*.local');
    await write('src/app/api/health/route.ts', 'export function GET() {}');
    await write('src/app/page.tsx', 'export default function Page() {}');

    const result = await scanProject(tmpDir);

    // Schema version check
    expect(result.schemaVersion).toBe('1.0');

    // Findings check
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'ENV_NO_EXAMPLE',
        category: 'configuration',
        severity: 'medium',
        confidence: 'high',
        deploymentImpact: 'risk',
        whyItMatters: expect.any(String),
        remediation: expect.any(String),
      }),
      expect.objectContaining({
        code: 'MISSING_START_SCRIPT',
        category: 'deployment',
        severity: 'low',
        confidence: 'high',
        deploymentImpact: 'risk',
        whyItMatters: expect.any(String),
        remediation: expect.any(String),
      }),
    ]));

    // Backwards compatibility alias check
    expect(result.issues).toBe(result.findings);

    // Health and readiness calculations
    expect(result.healthScore).toBe(85);
    expect(result.deploymentReadiness).toBe('Needs attention');
    expect(result.apiRoutes).toEqual(['src/app/api/health/route.ts']);

    // Project Intelligence checks
    expect(result.projectInfo).toMatchObject({
      name: 'next-app',
      framework: 'nextjs',
      language: 'typescript',
      packageManager: 'pnpm',
      router: 'app',
      database: 'supabase',
      authProvider: 'supabase',
      deploymentProvider: 'none',
      testingFrameworks: ['vitest'],
      sourceFileCount: 3, // next.config.ts + route.ts + page.tsx
      apiRouteCount: 1,
    });

    // JSON serialization verification
    const jsonStr = JSON.stringify(result);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.findings).toHaveLength(result.findings.length);
    expect(parsed.projectInfo.router).toBe('app');
  });

  it('reports only missing variable names in evidence/summary when .env.example is incomplete', async () => {
    await write('package.json', JSON.stringify({
      scripts: { build: 'tsc', start: 'node dist/index.js' },
      dependencies: { express: '^5.0.0' },
    }));
    await write('.env', 'DATABASE_URL=private-value\nPORT=3000\n');
    await write('.env.example', 'PORT=\n');
    await write('.gitignore', '.env\n');

    const result = await scanProject(tmpDir);
    const finding = result.findings.find((candidate) => candidate.code === 'ENV_EXAMPLE_MISSING_VARIABLES');

    expect(finding).toBeDefined();
    expect(finding).toMatchObject({
      category: 'configuration',
      severity: 'medium',
      confidence: 'high',
      deploymentImpact: 'risk',
    });
    expect(finding?.summary).toContain('DATABASE_URL');
    expect(finding?.evidence).toContain('DATABASE_URL');
    // Ensure raw credentials are never leaked
    expect(finding?.evidence).not.toContain('private-value');
    expect(finding?.summary).not.toContain('private-value');
  });

  it('does not require a start script for a static Vite project and counts source files accurately', async () => {
    await write('package.json', JSON.stringify({
      scripts: { build: 'vite build' },
      devDependencies: { vite: '^7.0.0', '@playwright/test': '^1.40.0' },
    }));
    await write('tsconfig.base.json', '{}');
    await write('src/main.ts', 'console.log("vite")');

    const result = await scanProject(tmpDir);

    expect(result.projectInfo.language).toBe('typescript');
    expect(result.projectInfo.framework).toBe('vite');
    expect(result.projectInfo.router).toBe('none');
    expect(result.projectInfo.testingFrameworks).toEqual(['playwright']);
    expect(result.projectInfo.sourceFileCount).toBe(1);
    expect(result.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_START_SCRIPT' }),
    ]));
  });
});
