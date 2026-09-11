import path from 'node:path';
import type { ScanResult } from '@codeeq/core';
import { describe, expect, it } from 'vitest';
import { sanitizeScanResult } from '../sanitizer';

describe('ScanResult Sanitizer', () => {
  const fakeRepoRoot = path.resolve('C:/Users/fake-user/AppData/Local/Temp/codeeq-scan-1234/repo');

  const mockScanResult: ScanResult = {
    schemaVersion: '1.0',
    targetDir: fakeRepoRoot,
    reportPath: path.join(fakeRepoRoot, 'codeeq-report.md'),
    scannedAt: '2026-09-11T08:00:00.000Z',
    healthScore: 85,
    deploymentReadiness: 'Ready',
    health: {
      overall: 85,
      categories: {
        security: 90,
        configuration: 80,
        codeHealth: 85,
        dependencies: 90,
        deployment: 80,
      },
    },
    projectInfo: {
      name: 'test-app',
      packageManager: 'pnpm',
      framework: 'nextjs',
      language: 'typescript',
      scripts: { build: 'next build' },
      dependencies: { next: '14.2.0' },
      router: 'app',
      hasSrcFolder: true,
      appRouterPath: 'src/app',
      pagesRouterPath: null,
      hasAppRouter: true,
      hasPagesRouter: false,
      hasEnv: false,
      hasEnvLocal: false,
      hasEnvExample: false,
      hasGitignore: true,
      hasVercelJson: false,
      usesSupabase: false,
      database: 'none',
      authProvider: 'none',
      deploymentProvider: 'vercel',
      testingFrameworks: ['vitest'],
      sourceFileCount: 10,
      apiRouteCount: 1,
    },
    findings: [
      {
        code: 'MISSING_ENV_EXAMPLE',
        category: 'configuration',
        severity: 'low',
        confidence: 'high',
        title: 'Missing .env.example',
        summary: `No environment template found in ${fakeRepoRoot}`,
        file: path.join(fakeRepoRoot, 'src', 'app', 'page.tsx'),
        line: 1,
        evidence: `Checked root: ${fakeRepoRoot}`,
        whyItMatters: 'Helps onboarding',
        remediation: 'Create .env.example',
        deploymentImpact: 'none',
      },
    ],
    apiRoutes: [path.join(fakeRepoRoot, 'src', 'app', 'api', 'scan', 'route.ts')],
    issues: [], // legacy alias
  };

  const mockRepo = {
    owner: 'testowner',
    name: 'testrepo',
    url: 'https://github.com/testowner/testrepo',
    defaultBranch: 'main',
  };

  it('produces a web-safe response omitting targetDir, reportPath, and issues', () => {
    const response = sanitizeScanResult(mockScanResult, mockRepo, fakeRepoRoot);

    expect(response.repository).toEqual(mockRepo);
    expect(response.scan.schemaVersion).toBe('1.0');
    expect(response.scan.healthScore).toBe(85);
    expect(response.scan.deploymentReadiness).toBe('Ready');

    const rawResponse = response as unknown as Record<string, unknown>;
    expect(rawResponse.targetDir).toBeUndefined();
    expect(rawResponse.reportPath).toBeUndefined();
    expect(rawResponse.issues).toBeUndefined();

    const scanRecord = response.scan as unknown as Record<string, unknown>;
    expect(scanRecord.targetDir).toBeUndefined();
    expect(scanRecord.reportPath).toBeUndefined();
    expect(scanRecord.issues).toBeUndefined();
  });

  it('sanitizes finding file paths and text references', () => {
    const response = sanitizeScanResult(mockScanResult, mockRepo, fakeRepoRoot);
    const finding = response.scan.findings[0];

    // File path must be project-relative with forward slashes
    expect(finding.file).toBe('src/app/page.tsx');
    expect(finding.file?.includes(fakeRepoRoot)).toBe(false);

    // Summary and evidence must not leak server temp root
    expect(finding.summary).not.toContain(fakeRepoRoot);
    expect(finding.evidence).not.toContain(fakeRepoRoot);
  });

  it('normalizes apiRoutes to project-relative forward-slash paths', () => {
    const response = sanitizeScanResult(mockScanResult, mockRepo, fakeRepoRoot);
    expect(response.scan.apiRoutes).toEqual(['src/app/api/scan/route.ts']);
  });
});
