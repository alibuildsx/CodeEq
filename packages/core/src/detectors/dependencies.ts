import fs from 'node:fs/promises';
import path from 'node:path';
import type { Finding } from '../types/index.js';
import { readPackageJson } from './packageJson.js';
import { collectScannableFiles } from './supabase.js';
import {
  normalizePath,
  isNestedNonProductionPath,
  isTestOrDocFile,
} from '../analysis/exclusionPolicy.js';

// ─── Node.js Built-ins ────────────────────────────────────────────────────────

const NODE_BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

const JS_TS_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.mjs',
  '.cjs',
]);

const IMPORT_REQUIRE_REGEX = /(?:import\s+(?:[\w*\s{},]*from\s+)?|export\s+(?:[\w*\s{},]*from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g;

async function getTsConfigAliases(targetDir: string): Promise<string[]> {
  const aliases: string[] = [];
  for (const configName of ['tsconfig.json', 'jsconfig.json']) {
    try {
      const raw = await fs.readFile(path.join(targetDir, configName), 'utf-8');
      const parsed = JSON.parse(raw);
      const paths = parsed.compilerOptions?.paths;
      if (paths && typeof paths === 'object') {
        for (const key of Object.keys(paths)) {
          const prefix = key.replace(/\/\*$/, '').replace(/\*$/, '');
          if (prefix) aliases.push(prefix);
        }
      }
    } catch {
      // Ignore parse or access failure
    }
  }
  return aliases;
}

function getPackageName(specifier: string, aliases: string[] = []): string | null {
  if (specifier.startsWith('node:')) return null;
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('\\')) return null;
  if (specifier.startsWith('@/') || specifier.startsWith('~/') || specifier.startsWith('#') || specifier.startsWith('$')) return null;

  for (const alias of aliases) {
    if (specifier === alias || specifier.startsWith(alias + '/')) {
      return null;
    }
  }

  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return specifier;
  }

  const firstSegment = specifier.split('/')[0]!;
  if (NODE_BUILTINS.has(firstSegment)) return null;
  return firstSegment;
}

// ─── Detector ─────────────────────────────────────────────────────────────────

export async function detectDependencyFindings(
  targetDir: string,
  options?: {
    files?: string[];
  },
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const pkg = await readPackageJson(targetDir);
  const aliases = await getTsConfigAliases(targetDir);


  const prodDeps = pkg?.dependencies ?? {};
  const devDeps = pkg?.devDependencies ?? {};
  const peerDeps = pkg?.peerDependencies ?? {};

  const allDeclaredDeps = new Set<string>([
    ...Object.keys(prodDeps),
    ...Object.keys(devDeps),
    ...Object.keys(peerDeps),
  ]);

  // ── 1. Duplicate dependency declarations ──
  const prodKeys = Object.keys(prodDeps);
  const devKeys = new Set(Object.keys(devDeps));
  for (const dep of prodKeys) {
    if (devKeys.has(dep)) {
      findings.push({
        code: 'DUPLICATE_DEPENDENCY_DECLARATION',
        category: 'dependencies',
        severity: 'low',
        confidence: 'high',
        title: `Dependency declared in both dependencies and devDependencies: "${dep}"`,
        summary: `"${dep}" is declared in both dependencies (${prodDeps[dep]}) and devDependencies (${devDeps[dep]}).`,
        file: 'package.json',
        evidence: `Duplicate dependency: ${dep}`,
        whyItMatters:
          'Listing a dependency in both sections creates version ambiguity and may result in unexpected build or runtime resolutions.',
        remediation: `Remove "${dep}" from devDependencies if it is required in production, or vice versa.`,
        deploymentImpact: 'none',
      });
    }
  }

  // ── 2. Undeclared external dependencies ──
  // If package.json is missing or has no declared dependencies, skip reporting undeclared dependencies
  // to avoid cascading noise when package.json is already flagged as missing.
  if (!pkg) {
    return findings;
  }

  const allFiles = options?.files ?? (await collectScannableFiles(targetDir));
  const sourceFiles = allFiles.filter((f) => JS_TS_EXTENSIONS.has(path.extname(f)));

  const reportedMissing = new Set<string>();

  for (const filePath of sourceFiles) {
    const relPath = normalizePath(path.relative(targetDir, filePath));
    // Skip nested non-production directories and test/doc files for undeclared imports
    if (isNestedNonProductionPath(relPath) || isTestOrDocFile(relPath)) {
      continue;
    }

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      IMPORT_REQUIRE_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = IMPORT_REQUIRE_REGEX.exec(line)) !== null) {
        const specifier = match[1]!;
        const pkgName = getPackageName(specifier, aliases);
        if (pkgName && !allDeclaredDeps.has(pkgName) && !reportedMissing.has(pkgName)) {
          reportedMissing.add(pkgName);
          findings.push({
            code: 'UNDECLARED_DEPENDENCY',
            category: 'dependencies',
            severity: 'high',
            confidence: 'high',
            title: `Undeclared external package imported: "${pkgName}"`,
            summary: `Module "${pkgName}" is imported in ${relPath} but not listed in package.json dependencies.`,
            file: relPath,
            line: lineNum,
            evidence: `Imported "${pkgName}" is absent from package.json dependencies`,
            whyItMatters:
              'Undeclared dependencies work locally only if cached in node_modules, but will fail with ModuleNotFoundError in clean CI and production environments.',
            remediation: `Add "${pkgName}" to your package.json dependencies using your package manager.`,
            deploymentImpact: 'blocking',
          });
        }
      }
    }
  }

  return findings;
}
