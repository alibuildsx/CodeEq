import fs from 'node:fs/promises';
import path from 'node:path';
import { readPackageJson, mergeDependencies, detectPackageManager } from '../detectors/packageJson.js';
import { detectFramework, hasNextConfig } from '../detectors/framework.js';
import { detectFilePresence } from '../detectors/filePresence.js';
import { detectSupabase } from '../detectors/supabase.js';
import { detectEnvSafety } from '../detectors/envSafety.js';
import { detectApiRoutes } from '../detectors/apiRoutes.js';
import { calculateDeploymentReadiness, calculateHealthScore } from '../analysis/projectHealth.js';
import type { Framework, Issue, ProjectInfo, ScanResult, Language } from '../types/index.js';

// ─── Language detection ───────────────────────────────────────────────────────

async function detectLanguage(targetDir: string): Promise<Language> {
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

// ─── Issue builders ───────────────────────────────────────────────────────────

function buildIssues(params: {
  presence: Awaited<ReturnType<typeof detectFilePresence>>;
  envSafety: Awaited<ReturnType<typeof detectEnvSafety>>;
  supabase: Awaited<ReturnType<typeof detectSupabase>>;
  scripts: Record<string, string>;
  framework: Framework;
  nextConfigExists: boolean;
}): Issue[] {
  const { presence, envSafety, supabase, scripts, framework, nextConfigExists } = params;
  const issues: Issue[] = [];

  // ── critical ──────────────────────────────────────────────────────────────

  if (envSafety.envNotGitignored) {
    issues.push({
      code: 'ENV_NOT_GITIGNORED',
      severity: 'critical',
      title: '.env is not listed in .gitignore',
      detail:
        'Your .env file could be committed to source control, exposing secrets. Add ".env" to .gitignore immediately.',
    });
  }

  if (envSafety.envLocalNotGitignored) {
    issues.push({
      code: 'ENV_LOCAL_NOT_GITIGNORED',
      severity: 'critical',
      title: '.env.local is not listed in .gitignore',
      detail:
        'Your .env.local file could be committed to source control. Add ".env.local" to .gitignore.',
    });
  }

  if (supabase.serviceRoleLeaked) {
    issues.push({
      code: 'SUPABASE_SERVICE_ROLE_LEAKED',
      severity: 'critical',
      title: 'Supabase service_role key reference found in source files',
      detail: `Found "service_role" in: ${supabase.leakFoundIn ?? 'unknown file'}. The service role key bypasses Row Level Security — never expose it client-side or commit it to source control.`,
    });
  }

  // ── high ──────────────────────────────────────────────────────────────────

  for (const varName of envSafety.suspiciousNextPublicVars) {
    issues.push({
      code: 'NEXT_PUBLIC_LIKELY_SECRET',
      severity: 'high',
      title: `NEXT_PUBLIC_ variable looks like a private secret: ${varName}`,
      detail: `"${varName}" is prefixed with NEXT_PUBLIC_ which exposes it to the browser bundle. If this is a private key or token, use a server-side environment variable instead.`,
    });
  }

  // ── medium ────────────────────────────────────────────────────────────────

  if ((presence.hasEnv || presence.hasEnvLocal) && !presence.hasEnvExample) {
    issues.push({
      code: 'ENV_NO_EXAMPLE',
      severity: 'medium',
      title: 'Environment files exist but .env.example is missing',
      detail:
        'Create an .env.example containing the required variable names with placeholder or empty values. Do not include real secrets.',
    });
  }

  if (presence.hasEnvExample && envSafety.missingEnvExampleVars.length > 0) {
    issues.push({
      code: 'ENV_EXAMPLE_MISSING_VARIABLES',
      severity: 'medium',
      title: '.env.example is missing required variable names',
      detail: `Add these variable names to .env.example: ${envSafety.missingEnvExampleVars.join(', ')}.`,
    });
  }

  if (!scripts['build']) {
    issues.push({
      code: 'MISSING_BUILD_SCRIPT',
      severity: 'medium',
      title: 'package.json is missing a "build" script',
      detail:
        'Most deployment platforms (Vercel, Netlify, Railway) look for a "build" script. Add one to package.json.',
    });
  }

  // ── low ───────────────────────────────────────────────────────────────────

  if ((framework === 'nextjs' || framework === 'express') && !scripts['start']) {
    issues.push({
      code: 'MISSING_START_SCRIPT',
      severity: 'low',
      title: 'package.json is missing a "start" script',
      detail:
        'Non-static Node and Next.js deployments commonly require a "start" script to launch the production server.',
    });
  }

  if (framework === 'nextjs' && !nextConfigExists) {
    issues.push({
      code: 'NEXTJS_MISSING_CONFIG',
      severity: 'low',
      title: 'Next.js project is missing a next.config file',
      detail:
        'While not required, a next.config.js (or .ts/.mjs) is standard for Next.js projects and needed for custom configuration.',
    });
  }

  return issues;
}

// ─── Main scanner ─────────────────────────────────────────────────────────────

/**
 * Scans the project at `targetDir` and returns a complete ScanResult.
 * This is the primary public API of the core package.
 */
export async function scanProject(targetDir: string): Promise<ScanResult> {
  const resolvedDir = path.resolve(targetDir);

  // ── Phase 1: gather raw data (parallelised where possible) ──
  const [pkg, packageManager, presence, language, apiRoutes] = await Promise.all([
    readPackageJson(resolvedDir),
    detectPackageManager(resolvedDir),
    detectFilePresence(resolvedDir),
    detectLanguage(resolvedDir),
    detectApiRoutes(resolvedDir),
  ]);

  const deps = pkg ? mergeDependencies(pkg) : {};
  const scripts = pkg?.scripts ?? {};
  const projectName = pkg?.name ?? '(unnamed)';

  const [frameworkResult, supabase, envSafety, nextConfigExists] =
    await Promise.all([
      detectFramework(resolvedDir, deps),
      detectSupabase(resolvedDir, deps),
      detectEnvSafety(resolvedDir, {
        hasEnv: presence.hasEnv,
        hasEnvLocal: presence.hasEnvLocal,
      }),
      hasNextConfig(resolvedDir),
    ]);

  // ── Phase 2: build ProjectInfo ──
  const projectInfo: ProjectInfo = {
    name: projectName,
    packageManager,
    framework: frameworkResult.framework,
    language,
    scripts,
    dependencies: deps,
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
  };

  // ── Phase 3: collect issues ──
  const issues = buildIssues({
    presence,
    envSafety,
    supabase,
    scripts,
    framework: frameworkResult.framework,
    nextConfigExists,
  });

  // ── Phase 4: sort issues by severity ──
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  issues.sort((a, b) => severityOrder[a.severity]! - severityOrder[b.severity]!);

  const reportPath = path.join(resolvedDir, 'PROJECT_HEALTH_REPORT.md');
  const healthScore = calculateHealthScore(issues);
  const deploymentReadiness = calculateDeploymentReadiness(issues);

  return {
    targetDir: resolvedDir,
    projectInfo,
    issues,
    healthScore,
    deploymentReadiness,
    apiRoutes,
    reportPath,
    scannedAt: new Date().toISOString(),
  };
}
