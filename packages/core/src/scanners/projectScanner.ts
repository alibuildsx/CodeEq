import fs from 'node:fs/promises';
import path from 'node:path';
import { readPackageJson, mergeDependencies, detectPackageManager } from '../detectors/packageJson.js';
import { detectFramework } from '../detectors/framework.js';
import { detectFilePresence } from '../detectors/filePresence.js';
import { detectEnvSafety } from '../detectors/envSafety.js';
import { detectApiRoutes } from '../detectors/apiRoutes.js';
import { collectScannableFiles } from '../detectors/supabase.js';
import {
  detectRouter,
  detectDatabase,
  detectAuthProvider,
  detectDeploymentProvider,
  detectTestingFrameworks,
  countSourceFiles,
} from '../detectors/projectIntelligence.js';
import { detectSecurityFindings } from '../detectors/security.js';
import { detectConfigurationFindings } from '../detectors/configuration.js';
import { detectCodeHealthFindings } from '../detectors/codeHealth.js';
import { detectDependencyFindings } from '../detectors/dependencies.js';
import { detectVibeCodeFindings } from '../detectors/vibeCode.js';
import { calculateDeploymentReadiness, calculateHealthBreakdown } from '../analysis/projectHealth.js';
import type { Finding, Language, ProjectInfo, ScanResult } from '../types/index.js';

// ─── Language detection ───────────────────────────────────────────────────────

async function detectLanguage(
  targetDir: string,
  deps: Record<string, string>,
  files: string[],
): Promise<Language> {
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
  if (files.some((file) => ['.ts', '.tsx', '.mts', '.cts'].includes(path.extname(file).toLowerCase()))) {
    return 'typescript';
  }
  return 'javascript';
}

// ─── Main scanner ─────────────────────────────────────────────────────────────

/**
 * Scans the project at `targetDir` and returns a complete ScanResult.
 * This is the primary public API of the core package.
 */
export async function scanProject(targetDir: string): Promise<ScanResult> {
  const resolvedDir = path.resolve(targetDir);

  // ── Phase 1: gather raw data (parallelised where possible) ──
  const [pkg, presence, apiRoutes, sourceFileCount, scannableFiles] = await Promise.all([
    readPackageJson(resolvedDir),
    detectFilePresence(resolvedDir),
    detectApiRoutes(resolvedDir),
    countSourceFiles(resolvedDir),
    collectScannableFiles(resolvedDir),
  ]);

  const deps = pkg ? mergeDependencies(pkg) : {};
  const scripts = pkg?.scripts ?? {};
  const projectName = pkg?.name ?? '(unnamed)';

  const [packageManager, language, frameworkResult, envSafety] = await Promise.all([
    detectPackageManager(resolvedDir, pkg?.packageManager),
    detectLanguage(resolvedDir, deps, scannableFiles),
    detectFramework(resolvedDir, deps),
    detectEnvSafety(resolvedDir, {
      hasEnv: presence.hasEnv,
      hasEnvLocal: presence.hasEnvLocal,
    }),
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
    usesSupabase: database === 'supabase' || Object.keys(deps).some((d) => d.includes('supabase')),
    database,
    authProvider,
    deploymentProvider,
    testingFrameworks,
    sourceFileCount,
    apiRouteCount: apiRoutes.length,
  };

  // ── Phase 4: run modular diagnostic detectors in parallel ──
  const [
    securityFindings,
    configurationFindings,
    codeHealthFindings,
    dependencyFindings,
    vibeCodeFindings,
  ] = await Promise.all([
    detectSecurityFindings(resolvedDir, { files: scannableFiles, deps }),
    detectConfigurationFindings(resolvedDir, {
      framework: frameworkResult.framework,
      presence,
      envSafety,
    }),
    detectCodeHealthFindings(resolvedDir, { files: scannableFiles }),
    detectDependencyFindings(resolvedDir, { files: scannableFiles }),
    detectVibeCodeFindings(resolvedDir, { files: scannableFiles }),
  ]);

  // Combine findings
  const allFindings: Finding[] = [
    ...securityFindings,
    ...configurationFindings,
    ...codeHealthFindings,
    ...dependencyFindings,
    ...vibeCodeFindings,
  ];

  // Deduplicate identical finding codes on the same file & line
  const uniqueFindings: Finding[] = [];
  const seenKeys = new Set<string>();
  for (const finding of allFindings) {
    const key = `${finding.code}|${finding.file ?? ''}|${finding.line ?? 0}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueFindings.push(finding);
    }
  }

  // ── Phase 5: sort findings by severity ──
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  uniqueFindings.sort((a, b) => severityOrder[a.severity]! - severityOrder[b.severity]!);

  const reportPath = path.join(resolvedDir, 'PROJECT_HEALTH_REPORT.md');
  const health = calculateHealthBreakdown(uniqueFindings);
  const deploymentReadiness = calculateDeploymentReadiness(uniqueFindings);

  return {
    schemaVersion: '1.0',
    targetDir: resolvedDir,
    projectInfo,
    findings: uniqueFindings,
    issues: uniqueFindings,
    health,
    healthScore: health.overall,
    deploymentReadiness,
    apiRoutes,
    reportPath,
    scannedAt: new Date().toISOString(),
  };
}
