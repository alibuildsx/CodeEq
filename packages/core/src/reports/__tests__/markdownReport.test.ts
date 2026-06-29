import { describe, expect, it } from 'vitest';
import { generateMarkdownReport } from '../markdownReport.js';
import type { ScanResult } from '../../types/index.js';

function result(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    targetDir: '/project',
    reportPath: '/project/PROJECT_HEALTH_REPORT.md',
    scannedAt: '2026-06-29T00:00:00.000Z',
    healthScore: 100,
    deploymentReadiness: 'Ready',
    apiRoutes: [],
    issues: [],
    projectInfo: {
      name: 'demo',
      packageManager: 'pnpm',
      framework: 'nextjs',
      language: 'typescript',
      scripts: {},
      dependencies: {},
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
    },
    ...overrides,
  };
}

describe('generateMarkdownReport v0.2', () => {
  it('renders every v0.2 section with score, readiness, and API route details', () => {
    const markdown = generateMarkdownReport(result({
      healthScore: 90,
      deploymentReadiness: 'Needs attention',
      apiRoutes: ['app/api/health/route.ts', 'pages/api/users.ts'],
      issues: [{ code: 'MISSING_BUILD_SCRIPT', severity: 'medium', title: 'Missing build' }],
    }));

    for (const section of [
      'Project Info',
      'Health Score',
      'Deployment Readiness',
      'API Routes',
      'Issue Summary',
      'Issues',
      'Next Steps',
    ]) {
      expect(markdown).toContain(`## ${section}`);
    }
    expect(markdown).toContain('CodeEq v0.2');
    expect(markdown).toContain('**90 / 100**');
    expect(markdown).toContain('**Needs attention**');
    expect(markdown).toContain('**2 API routes found**');
    expect(markdown).toContain('`app/api/health/route.ts`');
    expect(markdown).toContain('`pages/api/users.ts`');
  });

  it('shows helpful next steps even when no issues are found', () => {
    const markdown = generateMarkdownReport(result());

    expect(markdown).toContain('Run CodeEq before deploying');
    expect(markdown).toContain('Add `.env.example` if backend or environment variables are introduced');
    expect(markdown).toContain('Use future CodeEq security scans before production');
  });
});
