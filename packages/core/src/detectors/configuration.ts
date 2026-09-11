import fs from 'node:fs/promises';
import path from 'node:path';
import type { Finding, Framework } from '../types/index.js';
import { readPackageJson, mergeDependencies } from './packageJson.js';
import { detectFramework, hasNextConfig } from './framework.js';
import { detectFilePresence } from './filePresence.js';
import { detectEnvSafety } from './envSafety.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ─── Lockfile Definitions ─────────────────────────────────────────────────────

const LOCKFILE_MANAGERS: Array<{ file: string; manager: 'npm' | 'pnpm' | 'yarn' | 'bun' }> = [
  { file: 'package-lock.json', manager: 'npm' },
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'bun.lock', manager: 'bun' },
];

// ─── Detector ─────────────────────────────────────────────────────────────────

export async function detectConfigurationFindings(
  targetDir: string,
  options?: {
    framework?: Framework;
    presence?: Awaited<ReturnType<typeof detectFilePresence>>;
    envSafety?: Awaited<ReturnType<typeof detectEnvSafety>>;
  },
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // ── 1. package.json presence & validity ──
  const pkgPath = path.join(targetDir, 'package.json');
  let rawPkg: string | null = null;
  let isMalformed = false;
  let parsedRawJson: Record<string, unknown> | null = null;

  try {
    rawPkg = await fs.readFile(pkgPath, 'utf-8');
    try {
      parsedRawJson = JSON.parse(rawPkg) as Record<string, unknown>;
    } catch {
      isMalformed = true;
    }
  } catch {
    // Missing package.json
  }

  if (rawPkg === null) {
    findings.push({
      code: 'PACKAGE_JSON_MISSING',
      category: 'configuration',
      severity: 'critical',
      confidence: 'high',
      title: 'package.json is missing',
      summary: 'No package.json file was found in the project root.',
      file: 'package.json',
      evidence: 'File does not exist: package.json',
      whyItMatters:
        'Node.js and web applications require package.json to define dependencies, scripts, and project metadata.',
      remediation: 'Initialize a package.json file using "npm init" or your package manager of choice.',
      deploymentImpact: 'blocking',
    });
  } else if (isMalformed) {
    findings.push({
      code: 'PACKAGE_JSON_MALFORMED',
      category: 'configuration',
      severity: 'critical',
      confidence: 'high',
      title: 'package.json contains invalid JSON syntax',
      summary: 'package.json could not be parsed as valid JSON.',
      file: 'package.json',
      evidence: 'JSON syntax error encountered while reading package.json',
      whyItMatters:
        'A malformed package.json prevents package managers, build tools, and deployment environments from running.',
      remediation: 'Fix the syntax error in package.json to make it valid JSON.',
      deploymentImpact: 'blocking',
    });
  }

  const pkg = await readPackageJson(targetDir);
  const deps = pkg ? mergeDependencies(pkg) : {};
  const scripts = pkg?.scripts ?? {};

  // ── 2. Multiple lockfiles ──
  const existingLockfiles: string[] = [];
  for (const { file } of LOCKFILE_MANAGERS) {
    if (await fileExists(path.join(targetDir, file))) {
      existingLockfiles.push(file);
    }
  }

  // Deduplicate bun.lock / bun.lockb representation if both present
  const uniqueLockfiles = [...new Set(existingLockfiles)];
  if (uniqueLockfiles.length > 1) {
    findings.push({
      code: 'MULTIPLE_LOCKFILES',
      category: 'configuration',
      severity: 'medium',
      confidence: 'high',
      title: 'Multiple package manager lockfiles found',
      summary: `Found ${uniqueLockfiles.length} conflicting lockfiles in the repository: ${uniqueLockfiles.join(', ')}.`,
      file: uniqueLockfiles[0],
      evidence: `Lockfiles present: ${uniqueLockfiles.join(', ')}`,
      whyItMatters:
        'Multiple lockfiles cause inconsistent dependency versions between developers, CI, and production deployments.',
      remediation:
        `Standardize on one package manager and delete conflicting lockfiles: keep only the intended lockfile.`,
      deploymentImpact: 'risk',
    });
  }

  // ── 3. packageManager mismatch ──
  const pmField = (pkg as { packageManager?: string })?.packageManager ?? (parsedRawJson?.['packageManager'] as string | undefined);
  if (pmField && uniqueLockfiles.length > 0) {
    const pmFieldNormalized = pmField.split('@')[0]!;
    const hasMatchingLockfile = uniqueLockfiles.some((l) => {
      const lockfileInfo = LOCKFILE_MANAGERS.find((m) => m.file === l);
      return lockfileInfo?.manager === pmFieldNormalized;
    });

    if (!hasMatchingLockfile) {
      findings.push({
        code: 'PACKAGE_MANAGER_MISMATCH',
        category: 'configuration',
        severity: 'medium',
        confidence: 'high',
        title: `packageManager field ("${pmFieldNormalized}") mismatches lockfile(s)`,
        summary: `package.json specifies "${pmField}" but no matching lockfile was found (found: ${uniqueLockfiles.join(', ')}).`,
        file: 'package.json',
        evidence: `packageManager: "${pmField}" vs lockfiles: "${uniqueLockfiles.join(', ')}"`,
        whyItMatters:
          'Mismatch between the declared packageManager and the lockfile can cause Corepack or deployment engines to fail or install mismatched dependencies.',
        remediation:
          `Align package.json "packageManager" with the actual lockfile (${uniqueLockfiles.join(', ')}) or regenerate the lockfile with ${pmFieldNormalized}.`,
        deploymentImpact: 'risk',
      });
    }
  }

  // ── 4. TypeScript configuration presence ──
  const hasTsConfig =
    (await fileExists(path.join(targetDir, 'tsconfig.json'))) ||
    (await fileExists(path.join(targetDir, 'tsconfig.base.json')));

  if (!hasTsConfig) {
    // Check if TypeScript files exist
    const tsCandidates = [
      'src/index.ts',
      'src/index.tsx',
      'src/app.ts',
      'src/app.tsx',
      'index.ts',
      'index.tsx',
    ];
    let foundTsFile: string | null = null;
    for (const candidate of tsCandidates) {
      if (await fileExists(path.join(targetDir, candidate))) {
        foundTsFile = candidate;
        break;
      }
    }

    if (foundTsFile) {
      findings.push({
        code: 'TYPESCRIPT_CONFIG_MISSING',
        category: 'configuration',
        severity: 'medium',
        confidence: 'high',
        title: 'TypeScript source files exist but tsconfig.json is missing',
        summary: `TypeScript files were detected (e.g. ${foundTsFile}) but no tsconfig.json was found in the project root.`,
        file: foundTsFile,
        evidence: `Found ${foundTsFile} but tsconfig.json does not exist`,
        whyItMatters:
          'Without tsconfig.json, compilers and IDEs use fallback defaults which often cause compilation and type checking failures in CI/CD.',
        remediation: 'Generate a tsconfig.json file using "npx tsc --init" or configure a framework-specific tsconfig.',
        deploymentImpact: 'risk',
      });
    }
  }

  // ── 5. Environment example checks ──
  const presence = options?.presence ?? (await detectFilePresence(targetDir));
  const envSafety =
    options?.envSafety ??
    (await detectEnvSafety(targetDir, {
      hasEnv: presence.hasEnv,
      hasEnvLocal: presence.hasEnvLocal,
    }));

  if ((presence.hasEnv || presence.hasEnvLocal) && !presence.hasEnvExample) {
    findings.push({
      code: 'ENV_NO_EXAMPLE',
      category: 'configuration',
      severity: 'medium',
      confidence: 'high',
      title: 'Environment files exist but .env.example is missing',
      summary: 'Environment files (.env / .env.local) exist but no .env.example template was found.',
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

  // ── 6. Build and start scripts ──
  if (pkg && !scripts['build']) {
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

  const frameworkResult = options?.framework
    ? { framework: options.framework }
    : await detectFramework(targetDir, deps);
  const framework = frameworkResult.framework;

  if (pkg && (framework === 'nextjs' || framework === 'express') && !scripts['start']) {
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

  // ── 7. Next.js config presence ──
  if (framework === 'nextjs') {
    const nextConfigExists = await hasNextConfig(targetDir);
    if (!nextConfigExists) {
      findings.push({
        code: 'NEXTJS_MISSING_CONFIG',
        category: 'configuration',
        severity: 'low',
        confidence: 'medium',
        title: 'Next.js project is missing a next.config file',
        summary: 'No next.config.js, .ts, .mjs, or .cjs was found in the project root.',
        file: 'next.config.js',
        evidence: 'next.config.(js|ts|mjs|cjs) not found',
        whyItMatters:
          'While not required, a next.config.js (or .ts/.mjs) is standard for Next.js projects and needed for custom configuration.',
        remediation: 'Create a next.config.js or next.config.ts in the project root.',
        deploymentImpact: 'none',
      });
    }
  }

  return findings;
}
