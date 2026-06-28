import fs from 'node:fs/promises';
import path from 'node:path';
import { readPackageJson, mergeDependencies, detectPackageManager } from '../detectors/packageJson.js';
import { detectFramework, hasNextConfig } from '../detectors/framework.js';
import { detectFilePresence } from '../detectors/filePresence.js';
import { detectSupabase } from '../detectors/supabase.js';
import { detectEnvSafety } from '../detectors/envSafety.js';
import type { Issue, ProjectInfo, ScanResult, Language } from '../types/index.js';

// ─── Language detection ───────────────────────────────────────────────────────

async function detectLanguage(targetDir: string): Promise<Language> {
  try {
    await fs.access(path.join(targetDir, 'tsconfig.json'));
    return 'typescript';
  } catch {
    // No tsconfig — check for .ts files in common locations
    const candidates = ['src/index.ts', 'index.ts', 'src/app.ts'];
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
}

// ─── Issue builders ───────────────────────────────────────────────────────────

function buildIssues(params: {
  presence: Awaited<ReturnType<typeof detectFilePresence>>;
  envSafety: Awaited<ReturnType<typeof detectEnvSafety>>;
  supabase: Awaited<ReturnType<typeof detectSupabase>>;
  scripts: Record<string, string>;
  isNextJs: boolean;
  nextConfigExists: boolean;
}): Issue[] {
  const { presence, envSafety, supabase, scripts, isNextJs, nextConfigExists } = params;
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

  if (presence.hasEnv && !presence.hasEnvExample) {
    issues.push({
      code: 'ENV_NO_EXAMPLE',
      severity: 'high',
      title: '.env exists but .env.example is missing',
      detail:
        'Without an .env.example, collaborators have no way to know which environment variables are required. Create an .env.example with all keys (but no real values).',
    });
  }

  for (const varName of envSafety.suspiciousNextPublicVars) {
    issues.push({
      code: 'NEXT_PUBLIC_LIKELY_SECRET',
      severity: 'high',
      title: `NEXT_PUBLIC_ variable looks like a private secret: ${varName}`,
      detail: `"${varName}" is prefixed with NEXT_PUBLIC_ which exposes it to the browser bundle. If this is a private key or token, use a server-side environment variable instead.`,
    });
  }

  // ── medium ────────────────────────────────────────────────────────────────

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

  if (isNextJs && !nextConfigExists) {
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
  const [pkg, packageManager, presence, language] = await Promise.all([
    readPackageJson(resolvedDir),
    detectPackageManager(resolvedDir),
    detectFilePresence(resolvedDir),
    detectLanguage(resolvedDir),
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
    ...presence,
    usesSupabase: supabase.usesSupabase,
  };

  // ── Phase 3: collect issues ──
  const issues = buildIssues({
    presence,
    envSafety,
    supabase,
    scripts,
    isNextJs: frameworkResult.framework === 'nextjs',
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

  return {
    targetDir: resolvedDir,
    projectInfo,
    issues,
    reportPath,
    scannedAt: new Date().toISOString(),
  };
}
