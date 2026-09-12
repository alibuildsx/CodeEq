import { describe, expect, it } from 'vitest';
import { generateMarkdownReport } from '../markdownReport.js';
import type { ScanResult } from '../../types/index.js';

function result(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    schemaVersion: '1.0',
    targetDir: '/project',
    reportPath: '/project/PROJECT_HEALTH_REPORT.md',
    scannedAt: '2026-06-29T00:00:00.000Z',
    healthScore: 100,
    health: {
      overall: 100,
      categories: {
        security: 100,
        configuration: 100,
        codeHealth: 100,
        dependencies: 100,
        deployment: 100,
      },
    },
    deploymentReadiness: 'Ready',
    apiRoutes: [],
    findings: [],
    issues: [],
    projectInfo: {
      name: 'demo',
      packageManager: 'pnpm',
      framework: 'nextjs',
      language: 'typescript',
      scripts: {},
      dependencies: {},
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
      deploymentProvider: 'none',
      testingFrameworks: [],
      sourceFileCount: 10,
      apiRouteCount: 0,
    },
    ...overrides,
  };
}

describe('generateMarkdownReport v0.2 + M2 CP2', () => {
  it('renders every section with score, category breakdown, readiness, and API route details', () => {
    const markdown = generateMarkdownReport(result({
      healthScore: 90,
      health: {
        overall: 90,
        categories: {
          security: 100,
          configuration: 100,
          codeHealth: 100,
          dependencies: 100,
          deployment: 90,
        },
      },
      deploymentReadiness: 'Needs attention',
      apiRoutes: ['app/api/health/route.ts', 'pages/api/users.ts'],
      findings: [
        {
          code: 'MISSING_BUILD_SCRIPT',
          category: 'deployment',
          severity: 'medium',
          confidence: 'high',
          title: 'Missing build',
          summary: 'No build script found',
          whyItMatters: 'Deployment platforms need a build script',
          remediation: 'Add a build script',
          deploymentImpact: 'blocking',
        },
      ],
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
    expect(markdown).toContain('CodeEq v1.0');
    expect(markdown).toContain('**90 / 100**');
    expect(markdown).toContain('| Deployment | **90 / 100** |');
    expect(markdown).toContain('| Security | **100 / 100** |');
    expect(markdown).toContain('**Needs attention**');
    expect(markdown).toContain('**2 API routes found**');
    expect(markdown).toContain('`app/api/health/route.ts`');
    expect(markdown).toContain('`pages/api/users.ts`');

    // Finding V2 metadata in Markdown
    expect(markdown).toContain('**Category:** deployment');
    expect(markdown).toContain('**Confidence:** high');
    expect(markdown).toContain('**Deployment Impact:** blocking');
    expect(markdown).toContain('**Why it matters:** Deployment platforms need a build script');
    expect(markdown).toContain('**Remediation:** Add a build script');
  });

  it('renders Project Intelligence fields in the Project Info table', () => {
    const markdown = generateMarkdownReport(result({
      projectInfo: {
        name: 'full-stack-app',
        packageManager: 'pnpm',
        framework: 'nextjs',
        language: 'typescript',
        scripts: {},
        dependencies: {},
        router: 'hybrid',
        hasSrcFolder: true,
        appRouterPath: 'src/app',
        pagesRouterPath: 'src/pages',
        hasAppRouter: true,
        hasPagesRouter: true,
        hasEnv: true,
        hasEnvLocal: true,
        hasEnvExample: true,
        hasGitignore: true,
        hasVercelJson: true,
        usesSupabase: true,
        database: 'supabase',
        authProvider: 'supabase',
        deploymentProvider: 'vercel',
        testingFrameworks: ['vitest', 'playwright'],
        sourceFileCount: 42,
        apiRouteCount: 3,
      },
    }));

    expect(markdown).toContain('| **Router** | Hybrid (App + Pages) |');
    expect(markdown).toContain('| **Database** | supabase |');
    expect(markdown).toContain('| **Authentication** | supabase |');
    expect(markdown).toContain('| **Deployment** | vercel |');
    expect(markdown).toContain('| **Testing** | vitest, playwright |');
    expect(markdown).toContain('| **Source Files** | 42 |');
  });

  it('shows helpful next steps even when no issues are found', () => {
    const markdown = generateMarkdownReport(result());

    expect(markdown).toContain('Run CodeEq before deploying');
    expect(markdown).toContain('Add `.env.example` if backend or environment variables are introduced');
    expect(markdown).toContain('Use future CodeEq security scans before production');
  });
});
