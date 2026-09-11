import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from '../scanners/projectScanner.js';
import { generateMarkdownReport } from '../reports/markdownReport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_ROOT = path.resolve(__dirname, '../../test-fixtures');

describe('Canonical Fixture Pack Acceptance', () => {
  it('healthy-nextjs: produces 0 findings, 100 overall score, and Ready status', async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, 'healthy-nextjs');
    const result = await scanProject(fixtureDir);

    expect(result.schemaVersion).toBe('1.0');
    expect(result.findings).toHaveLength(0);
    expect(result.healthScore).toBe(100);
    expect(result.health.overall).toBe(100);
    expect(result.health.categories).toEqual({
      security: 100,
      configuration: 100,
      codeHealth: 100,
      dependencies: 100,
      deployment: 100,
    });
    expect(result.deploymentReadiness).toBe('Ready');
    expect(result.projectInfo.framework).toBe('nextjs');
    expect(result.projectInfo.router).toBe('app');
    expect(result.apiRoutes).toContain('src/app/api/health/route.ts');

    const md = generateMarkdownReport(result);
    expect(md).toContain('Ready');
    expect(md).toContain('100 / 100');
  });

  it('security-problems: detects secrets and unignored env, redacting all raw credentials', async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, 'security-problems');
    const result = await scanProject(fixtureDir);

    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('HARDCODED_GITHUB_TOKEN');
    expect(codes).toContain('HARDCODED_STRIPE_SECRET');
    expect(codes).toContain('HARDCODED_DATABASE_URL_CREDENTIALS');
    expect(codes).toContain('NEXT_PUBLIC_LIKELY_SECRET');
    expect(codes).toContain('ENV_NOT_GITIGNORED');

    expect(result.deploymentReadiness).toBe('Blocked');
    expect(result.health.categories.security).toBeLessThanOrEqual(50);

    // CRITICAL: Raw secrets must never be exposed
    const rawTokens = [
      'ghp_FAKEGITHUBTOKENVAL0123456789ABCDEFGH',
      'sk_live_FAKESTRIPEKEYVAL9876543210ABCDEF',
      'super_secret_fake_pass',
      'fake_unsafe_super_secret_val',
    ];

    const json = JSON.stringify(result);
    const md = generateMarkdownReport(result);

    for (const raw of rawTokens) {
      expect(json).not.toContain(raw);
      expect(md).not.toContain(raw);
      for (const finding of result.findings) {
        expect(finding.evidence).not.toContain(raw);
        expect(finding.summary).not.toContain(raw);
        expect(finding.whyItMatters).not.toContain(raw);
        expect(finding.remediation).not.toContain(raw);
      }
    }
  });

  it('configuration-problems: detects multiple lockfiles, packageManager mismatch, missing build, missing env example', async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, 'configuration-problems');
    const result = await scanProject(fixtureDir);

    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('MULTIPLE_LOCKFILES');
    expect(codes).toContain('PACKAGE_MANAGER_MISMATCH');
    expect(codes).toContain('MISSING_BUILD_SCRIPT');
    expect(codes).toContain('ENV_NO_EXAMPLE');

    // MISSING_BUILD_SCRIPT has deploymentImpact: 'blocking', so readiness is Blocked
    expect(result.deploymentReadiness).toBe('Blocked');
    expect(result.health.categories.configuration).toBeLessThan(100);
    expect(result.health.categories.deployment).toBeLessThan(100);
  });

  it('broken-code: detects syntax errors, unresolved relative imports, and localhost URLs', async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, 'broken-code');
    const result = await scanProject(fixtureDir);

    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('SYNTAX_ERROR');
    expect(codes).toContain('UNRESOLVED_LOCAL_IMPORT');
    expect(codes).toContain('HARDCODED_LOCALHOST_URL');

    expect(result.deploymentReadiness).toBe('Blocked');
    expect(result.health.categories.codeHealth).toBeLessThan(80);

    const syntaxFinding = result.findings.find((f) => f.code === 'SYNTAX_ERROR');
    expect(syntaxFinding?.file).toBe('src/syntaxError.ts');
    expect(syntaxFinding?.deploymentImpact).toBe('blocking');

    const importFinding = result.findings.find((f) => f.code === 'UNRESOLVED_LOCAL_IMPORT');
    expect(importFinding?.file).toBe('src/brokenImport.ts');
    expect(importFinding?.deploymentImpact).toBe('blocking');
  });

  it('dependency-problems: detects undeclared package imports and duplicate declarations', async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, 'dependency-problems');
    const result = await scanProject(fixtureDir);

    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('UNDECLARED_DEPENDENCY');
    expect(codes).toContain('DUPLICATE_DEPENDENCY_DECLARATION');

    // Undeclared dependency is high severity and blocking deployment impact
    expect(result.deploymentReadiness).toBe('Blocked');
    expect(result.health.categories.dependencies).toBeLessThan(100);

    const undeclared = result.findings.find((f) => f.code === 'UNDECLARED_DEPENDENCY');
    expect(undeclared?.evidence).toContain('axios');
  });

  it('messy-vibe-project: detects duplicate auth providers, multiple Supabase clients, and leftover placeholders', async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, 'messy-vibe-project');
    const result = await scanProject(fixtureDir);

    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('DUPLICATE_AUTH_PROVIDERS');
    expect(codes).toContain('MULTIPLE_SUPABASE_CLIENTS');
    expect(codes).toContain('PLACEHOLDER_VALUE_LEFTOVER');

    // Vibe heuristics have medium/low severity and risk/none deployment impact -> Needs attention
    expect(result.deploymentReadiness).toBe('Needs attention');

    const authFinding = result.findings.find((f) => f.code === 'DUPLICATE_AUTH_PROVIDERS');
    expect(authFinding?.evidence).toContain('@clerk/nextjs');
    expect(authFinding?.evidence).toContain('next-auth');

    const supabaseFinding = result.findings.find((f) => f.code === 'MULTIPLE_SUPABASE_CLIENTS');
    expect(supabaseFinding?.evidence).toContain('src/lib/supabaseClient.ts');
    expect(supabaseFinding?.evidence).toContain('src/utils/supabaseServer.ts');
  });
});
