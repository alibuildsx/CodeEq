import fs from 'node:fs/promises';
import path from 'node:path';
import { readPackageJson, mergeDependencies, detectPackageManager } from '../detectors/packageJson.js';
import { detectFramework, hasNextConfig } from '../detectors/framework.js';
import { detectFilePresence } from '../detectors/filePresence.js';
import { detectSupabase } from '../detectors/supabase.js';
import { detectEnvSafety } from '../detectors/envSafety.js';
import { detectApiRoutes } from '../detectors/apiRoutes.js';
import {
  detectRouter,
  detectDatabase,
  detectAuthProvider,
  detectDeploymentProvider,
  detectTestingFrameworks,
  countSourceFiles,
} from '../detectors/projectIntelligence.js';
import { calculateDeploymentReadiness, calculateHealthScore } from '../analysis/projectHealth.js';
import type { Finding, Framework, Language, ProjectInfo, ScanResult } from '../types/index.js';

// ─── Language detection ───────────────────────────────────────────────────────

async function detectLanguage(targetDir: string, deps: Record<string, string>): Promise<Language> {
  if (deps['typescript'] || deps['@types/node']) {
    return 'typescript';
  }

  const candidates = [
    'tsconfig.json',
    'tsconfig.base.json',
    'src/index.ts',
    'index.ts',
    'src/app.ts',
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(targetDir, candidate));
      return 'typescript';
    } catch {
      // continue
    }
  }
  return 'javascript';
}

// ─── Finding builders ─────────────────────────────────────────────────────────

function buildFindings(params: {
  presence: Awaited<ReturnType<typeof detectFilePresence>>;
  envSafety: Awaited<ReturnType<typeof detectEnvSafety>>;
  supabase: Awaited<ReturnType<typeof detectSupabase>>;
  scripts: Record<string, string>;
  framework: Framework;
  nextConfigExists: boolean;
}): Finding[] {
  const { presence, envSafety, supabase, scripts, framework, nextConfigExists } = params;
  const findings: Finding[] = [];

  // ── critical ──────────────────────────────────────────────────────────────

  if (envSafety.envNotGitignored) {
    findings.push({
      code: 'ENV_NOT_GITIGNORED',
      category: 'security',
      severity: 'critical',
      confidence: 'high',
      title: '.env is not listed in .gitignore',
      summary: '.env file is present but not ignored in .gitignore.',
      file: '.gitignore',
      evidence: '.env present in project root but missing from .gitignore patterns',
      whyItMatters:
        '.env commonly contains credentials and private API keys; committing it exposes them to version control.',
      remediation:
        'Add ".env" to .gitignore immediately and rotate any secrets that were previously committed.',
      deploymentImpact: 'risk',
    });
  }

  if (envSafety.envLocalNotGitignored) {
    findings.push({
      code: 'ENV_LOCAL_NOT_GITIGNORED',
      category: 'security',
      severity: 'critical',
      confidence: 'high',
      title: '.env.local is not listed in .gitignore',
      summary: '.env.local file is present but not ignored in .gitignore.',
      file: '.gitignore',
      evidence: '.env.local present in project root but missing from .gitignore patterns',
      whyItMatters:
        '.env.local commonly contains credentials and should not be committed.',
      remediation:
        'Add .env.local to .gitignore and ensure any exposed secrets are rotated.',
      deploymentImpact: 'risk',
    });
  }

  if (supabase.serviceRoleLeaked) {
    findings.push({
      code: 'SUPABASE_SERVICE_ROLE_LEAKED',
      category: 'security',
      severity: 'critical',
      confidence: 'high',
      title: 'Supabase service_role key reference found in source files',
      summary: `Found "service_role" in: ${supabase.leakFoundIn ?? 'unknown file'}.`,
      file: supabase.leakFoundIn,
      evidence: 'Found reference to service_role assignment in source files',
      whyItMatters:
        'The service role key bypasses Row Level Security — never expose it client-side or commit it to source control.',
      remediation:
        'Remove the service role key from source code and restrict it to secure server-side environments.',
      deploymentImpact: 'risk',
    });
  }

  // ── high ──────────────────────────────────────────────────────────────────

  for (const varName of envSafety.suspiciousNextPublicVars) {
    findings.push({
      code: 'NEXT_PUBLIC_LIKELY_SECRET',
      category: 'security',
      severity: 'high',
      confidence: 'high',
      title: `NEXT_PUBLIC_ variable looks like a private secret: ${varName}`,
      summary: `"${varName}" is prefixed with NEXT_PUBLIC_ which exposes it to the browser bundle.`,
      file: '.env',
      evidence: `Variable name: ${varName}`,
      whyItMatters:
        'Variables prefixed with NEXT_PUBLIC_ are bundled into client-side JavaScript, exposing them to any visitor.',
      remediation:
        'Remove the NEXT_PUBLIC_ prefix and access this credential only from server-side code.',
      deploymentImpact: 'risk',
    });
  }

  // ── medium ────────────────────────────────────────────────────────────────

  if ((presence.hasEnv || presence.hasEnvLocal) && !presence.hasEnvExample) {
    findings.push({
      code: 'ENV_NO_EXAMPLE',
      category: 'configuration',
      severity: 'medium',
      confidence: 'high',
      title: 'Environment files exist but .env.example is missing',
      summary:
        'Environment files (.env / .env.local) exist but no .env.example template was found.',
      file: '.env.example',
      evidence: 'Environment files present; .env.example missing',
      whyItMatters:
        'Missing .env.example makes onboarding difficult and increases the risk of misconfigured deployments.',
      remediation:
        'Create an .env.example containing the required variable names with placeholder or empty values. Do not include real secrets.',
      deploymentImpact: 'risk',
    });
  }

  if (presence.hasEnvExample && envSafety.missingEnvExampleVars.length > 0) {
    findings.push({
      code: 'ENV_EXAMPLE_MISSING_VARIABLES',
      category: 'configuration',
      severity: 'medium',
      confidence: 'high',
      title: '.env.example is missing required variable names',
      summary: `Add these variable names to .env.example: ${envSafety.missingEnvExampleVars.join(', ')}.`,
      file: '.env.example',
      evidence: `Missing in .env.example: ${envSafety.missingEnvExampleVars.join(', ')}`,
      whyItMatters:
        'When required variables are not documented in .env.example, new developer setups and CI/CD pipelines can fail.',
      remediation: `Add these variable names to .env.example: ${envSafety.missingEnvExampleVars.join(', ')}.`,
      deploymentImpact: 'risk',
    });
  }

  if (!scripts['build']) {
    findings.push({
      code: 'MISSING_BUILD_SCRIPT',
      category: 'deployment',
      severity: 'medium',
      confidence: 'high',
      title: 'package.json is missing a "build" script',
      summary: 'package.json does not define a "build" script.',
      file: 'package.json',
      evidence: 'scripts.build is undefined',
      whyItMatters:
        'Most deployment platforms (Vercel, Netlify, Railway) look for a "build" script. Add one to package.json.',
      remediation: 'Add a "build" script to package.json.',
      deploymentImpact: 'blocking',
    });
  }

  // ── low ───────────────────────────────────────────────────────────────────

  if ((framework === 'nextjs' || framework === 'express') && !scripts['start']) {
    findings.push({
      code: 'MISSING_START_SCRIPT',
      category: 'deployment',
      severity: 'low',
      confidence: 'high',
      title: 'package.json is missing a "start" script',
      summary: 'package.json is missing a "start" script.',
      file: 'package.json',
      evidence: 'scripts.start is undefined',
      whyItMatters:
        'Non-static Node and Next.js deployments commonly require a "start" script to launch the production server.',
      remediation:
        'Add a "start" script to package.json (e.g. "next start" or "node dist/index.js").',
      deploymentImpact: 'risk',
    });
  }

  if (framework === 'nextjs' && !nextConfigExists) {
    findings.push({
      code: 'NEXTJS_MISSING_CONFIG',
      category: 'configuration',
      severity: 'low',
      confidence: 'medium',
      title: 'Next.js project is missing a next.config file',
      summary:
        'No next.config.js, .ts, .mjs, or .cjs was found in the project root.',
      file: 'next.config.js',
      evidence: 'next.config.(js|ts|mjs|cjs) not found',
      whyItMatters:
        'While not required, a next.config.js (or .ts/.mjs) is standard for Next.js projects and needed for custom configuration.',
      remediation:
        'Create a next.config.js or next.config.ts in the project root.',
      deploymentImpact: 'none',
    });
  }

  return findings;
}

// ─── Main scanner ─────────────────────────────────────────────────────────────

/**
 * Scans the project at `targetDir` and returns a complete ScanResult.
 * This is the primary public API of the core package.
 */
export async function scanProject(targetDir: string): Promise<ScanResult> {
  const resolvedDir = path.resolve(targetDir);

  // ── Phase 1: gather raw data (parallelised where possible) ──
  const [pkg, presence, apiRoutes, sourceFileCount] = await Promise.all([
    readPackageJson(resolvedDir),
    detectFilePresence(resolvedDir),
    detectApiRoutes(resolvedDir),
    countSourceFiles(resolvedDir),
  ]);

  const deps = pkg ? mergeDependencies(pkg) : {};
  const scripts = pkg?.scripts ?? {};
  const projectName = pkg?.name ?? '(unnamed)';

  const [packageManager, language, frameworkResult, supabase, envSafety, nextConfigExists] =
    await Promise.all([
      detectPackageManager(resolvedDir, pkg?.packageManager),
      detectLanguage(resolvedDir, deps),
      detectFramework(resolvedDir, deps),
      detectSupabase(resolvedDir, deps),
      detectEnvSafety(resolvedDir, {
        hasEnv: presence.hasEnv,
        hasEnvLocal: presence.hasEnvLocal,
      }),
      hasNextConfig(resolvedDir),
    ]);

  // ── Phase 2: Project Intelligence ──
  const router = detectRouter({
    hasAppRouter: presence.hasAppRouter,
    hasPagesRouter: presence.hasPagesRouter,
  });

  const [database, deploymentProvider, testingFrameworks] = await Promise.all([
    detectDatabase(resolvedDir, deps),
    detectDeploymentProvider(resolvedDir, deps, presence.hasVercelJson),
    detectTestingFrameworks(resolvedDir, deps),
  ]);

  const authProvider = await detectAuthProvider(resolvedDir, deps, database);

  // ── Phase 3: build ProjectInfo ──
  const projectInfo: ProjectInfo = {
    name: projectName,
    packageManager,
    framework: frameworkResult.framework,
    language,
    scripts,
    dependencies: deps,
    router,
    hasSrcFolder: presence.hasSrcFolder,
    appRouterPath: presence.appRouterPath,
    pagesRouterPath: presence.pagesRouterPath,
    hasAppRouter: presence.hasAppRouter,
    hasPagesRouter: presence.hasPagesRouter,
    hasEnv: presence.hasEnv,
    hasEnvLocal: presence.hasEnvLocal,
    hasEnvExample: presence.hasEnvExample,
    hasGitignore: presence.hasGitignore,
    hasVercelJson: presence.hasVercelJson,
    usesSupabase: supabase.usesSupabase,
    database,
    authProvider,
    deploymentProvider,
    testingFrameworks,
    sourceFileCount,
    apiRouteCount: apiRoutes.length,
  };

  // ── Phase 4: collect findings ──
  const findings = buildFindings({
    presence,
    envSafety,
    supabase,
    scripts,
    framework: frameworkResult.framework,
    nextConfigExists,
  });

  // ── Phase 5: sort findings by severity ──
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  findings.sort((a, b) => severityOrder[a.severity]! - severityOrder[b.severity]!);

  const reportPath = path.join(resolvedDir, 'PROJECT_HEALTH_REPORT.md');
  const healthScore = calculateHealthScore(findings);
  const deploymentReadiness = calculateDeploymentReadiness(findings);

  return {
    schemaVersion: '1.0',
    targetDir: resolvedDir,
    projectInfo,
    findings,
    issues: findings,
    healthScore,
    deploymentReadiness,
    apiRoutes,
    reportPath,
    scannedAt: new Date().toISOString(),
  };
}
