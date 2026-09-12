import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from '../projectScanner.js';

describe('scanProject M2 CP2 diagnostic engine', () => {
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

  it('adds deployment, score, category breakdown, readiness, Project Intelligence, and API route data to a Next.js scan', async () => {
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

    // Health and category scores check
    expect(result.healthScore).toBe(97);
    expect(result.health.overall).toBe(97);
    expect(result.health.categories).toEqual({
      security: 100,
      configuration: 92, // 100 - 8 (medium: ENV_NO_EXAMPLE)
      codeHealth: 100,
      dependencies: 100,
      deployment: 89,   // 100 - 3 (low: MISSING_START_SCRIPT) - 8 (risk: ENV_NO_EXAMPLE)
    });

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
      authProvider: 'none',
      deploymentProvider: 'none',
      testingFrameworks: ['vitest'],
      sourceFileCount: 3, // next.config.ts + route.ts + page.tsx
      apiRouteCount: 1,
    });

    // JSON serialization verification
    const jsonStr = JSON.stringify(result);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.health.categories.configuration).toBe(92);
    expect(parsed.findings).toHaveLength(result.findings.length);
    expect(parsed.projectInfo.router).toBe('app');
  });

  it('blocks readiness when a blocking finding like MISSING_BUILD_SCRIPT is present', async () => {
    await write('package.json', JSON.stringify({
      name: 'no-build-app',
      devDependencies: { vite: '^5.0.0' },
      scripts: {},
    }));
    await write('src/index.js', 'console.log("ready")');

    const result = await scanProject(tmpDir);
    expect(result.findings.some((f) => f.code === 'MISSING_BUILD_SCRIPT')).toBe(true);
    // Semantic fix verified: MISSING_BUILD_SCRIPT is blocking, so readiness is Blocked
    expect(result.deploymentReadiness).toBe('Blocked');
  });

  it('runs the comprehensive diagnostic engine across all 5 categories simultaneously', async () => {
    await write('package.json', JSON.stringify({
      name: 'vibe-project',
      dependencies: {
        '@clerk/nextjs': '^5.0.0',
        'next-auth': '^4.0.0', // Vibe heuristic: DUPLICATE_AUTH_PROVIDERS
        zod: '^3.0.0',
      },
      devDependencies: {
        zod: '^3.2.0', // Dependency: DUPLICATE_DEPENDENCY_DECLARATION
      },
      scripts: { build: 'next build', start: 'next start' },
    }));
    await write('tsconfig.json', '{}');
    await write('next.config.js', 'module.exports = {};');
    await write('package-lock.json', '{}');
    await write('pnpm-lock.yaml', 'lockfileVersion: 5.4'); // Config: MULTIPLE_LOCKFILES
    await write('.env', 'DATABASE_URL=postgres://\n'); // Security: ENV_NOT_GITIGNORED
    await write('.gitignore', 'node_modules\n');
    await write('src/broken.ts', 'import axios from "axios";\nconst x = ;\nexport default x;'); // CodeHealth: SYNTAX_ERROR, Dep: UNDECLARED_DEPENDENCY

    const result = await scanProject(tmpDir);
    const codes = result.findings.map((f) => f.code);

    // Verify all 5 categories are represented
    expect(codes).toContain('ENV_NOT_GITIGNORED');                 // Security
    expect(codes).toContain('MULTIPLE_LOCKFILES');                // Configuration
    expect(codes).toContain('SYNTAX_ERROR');                      // Code Health
    expect(codes).toContain('UNDECLARED_DEPENDENCY');             // Dependencies
    expect(codes).toContain('DUPLICATE_DEPENDENCY_DECLARATION');  // Dependencies
    expect(codes).toContain('DUPLICATE_AUTH_PROVIDERS');          // Vibe Code

    // Category scores should reflect deductions in each category
    expect(result.health.categories.security).toBeLessThan(100);
    expect(result.health.categories.configuration).toBeLessThan(100);
    expect(result.health.categories.codeHealth).toBeLessThan(100);
    expect(result.health.categories.dependencies).toBeLessThan(100);
    expect(result.deploymentReadiness).toBe('Blocked');
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

  it('detects TypeScript from nested source files without a root tsconfig or TypeScript dependency', async () => {
    await write('package.json', JSON.stringify({
      name: 'nested-typescript',
      scripts: { build: 'custom-build' },
    }));
    await write('packages/feature/src/deep/module.tsx', 'export function Feature() { return null; }');

    const result = await scanProject(tmpDir);

    expect(result.projectInfo.language).toBe('typescript');
  });

  it('stops immediately when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('audit cancellation'));

    await expect(scanProject(tmpDir, { signal: controller.signal })).rejects.toThrow(
      'audit cancellation',
    );
  });
});
