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
import { collectModuleSpecifiers, parseSourceFile } from '../analysis/moduleSpecifiers.js';

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
  '.cts',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function isSameOrDescendant(childDir: string, parentDir: string): boolean {
  const rel = path.relative(path.resolve(parentDir), path.resolve(childDir));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// ─── Manifest Resolution & Caching ────────────────────────────────────────────

export interface ManifestData {
  manifestPath: string;
  manifestDir: string;
  declaredDeps: Set<string>;
  aliases: string[];
  packageName?: string;
}

/**
 * Resolves the nearest package.json manifest for a source file by walking upward
 * from the file's directory and stopping at scanRoot (inclusive).
 * Never traverses above scanRoot.
 */
export async function findNearestPackageManifest(
  filePath: string,
  scanRoot: string,
  dirCache: Map<string, string | null>,
): Promise<string | null> {
  const resolvedScanRoot = path.resolve(scanRoot);
  const resolvedFilePath = path.resolve(filePath);
  let currentDir = path.dirname(resolvedFilePath);

  const visitedDirs: string[] = [];

  while (isSameOrDescendant(currentDir, resolvedScanRoot)) {
    if (dirCache.has(currentDir)) {
      const cached = dirCache.get(currentDir)!;
      for (const d of visitedDirs) {
        dirCache.set(d, cached);
      }
      return cached;
    }

    visitedDirs.push(currentDir);

    const candidateManifest = path.join(currentDir, 'package.json');
    try {
      const stat = await fs.stat(candidateManifest);
      if (stat.isFile()) {
        for (const d of visitedDirs) {
          dirCache.set(d, candidateManifest);
        }
        return candidateManifest;
      }
    } catch {
      // package.json does not exist in currentDir
    }

    // Stop once we have reached the scan root. Never traverse above scanRoot.
    if (path.resolve(currentDir).toLowerCase() === resolvedScanRoot.toLowerCase()) {
      break;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  // Not found within scan root boundary
  for (const d of visitedDirs) {
    dirCache.set(d, null);
  }
  return null;
}

export async function getManifestData(
  manifestPath: string,
  scanRoot: string,
  manifestCache: Map<string, ManifestData | null>,
): Promise<ManifestData | null> {
  if (manifestCache.has(manifestPath)) {
    return manifestCache.get(manifestPath)!;
  }

  const manifestDir = path.dirname(manifestPath);
  const pkg = await readPackageJson(manifestDir);
  if (!pkg) {
    manifestCache.set(manifestPath, null);
    return null;
  }

  const declaredDeps = new Set<string>([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);

  const aliases = new Set<string>();
  const manifestAliases = await getTsConfigAliases(manifestDir);
  for (const a of manifestAliases) aliases.add(a);

  if (path.resolve(manifestDir).toLowerCase() !== path.resolve(scanRoot).toLowerCase()) {
    const rootAliases = await getTsConfigAliases(scanRoot);
    for (const a of rootAliases) aliases.add(a);
  }

  const data: ManifestData = {
    manifestPath,
    manifestDir,
    declaredDeps,
    aliases: Array.from(aliases),
    packageName: pkg.name,
  };

  manifestCache.set(manifestPath, data);
  return data;
}

// ─── Detector ─────────────────────────────────────────────────────────────────

export async function detectDependencyFindings(
  targetDir: string,
  options?: {
    files?: string[];
    signal?: AbortSignal;
  },
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const rootPkg = await readPackageJson(targetDir);

  // ── 1. Duplicate dependency declarations in root manifest ──
  if (rootPkg) {
    const prodDeps = rootPkg.dependencies ?? {};
    const devDeps = rootPkg.devDependencies ?? {};
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
  }

  // ── 2. Undeclared external dependencies with nearest-manifest ownership ──
  const allFiles = options?.files ?? (await collectScannableFiles(targetDir, { signal: options?.signal }));
  const sourceFiles = allFiles.filter((f) => JS_TS_EXTENSIONS.has(path.extname(f)));

  const dirCache = new Map<string, string | null>();
  const manifestCache = new Map<string, ManifestData | null>();
  const reportedMissing = new Set<string>();

  for (const filePath of sourceFiles) {
    options?.signal?.throwIfAborted();
    const relPath = normalizePath(path.relative(targetDir, filePath));
    // Skip nested non-production directories and test/doc files for undeclared imports
    if (isNestedNonProductionPath(relPath) || isTestOrDocFile(relPath)) {
      continue;
    }

    const manifestPath = await findNearestPackageManifest(filePath, targetDir, dirCache);
    if (!manifestPath) {
      // If no package.json exists between the file and scan root, declaration context
      // cannot be established. Skip to avoid false positives.
      continue;
    }

    const manifestData = await getManifestData(manifestPath, targetDir, manifestCache);
    if (!manifestData) {
      // Malformed or missing package manifest. Skip.
      continue;
    }

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const sourceFile = parseSourceFile(filePath, content);
    for (const reference of collectModuleSpecifiers(sourceFile)) {
      const pkgName = getPackageName(reference.value.replace(/[?#].*$/, ''), manifestData.aliases);
      const dedupeKey = `${manifestData.manifestPath}:${pkgName}`;
      if (
        pkgName &&
        pkgName !== manifestData.packageName &&
        !manifestData.declaredDeps.has(pkgName) &&
        !reportedMissing.has(dedupeKey)
      ) {
          reportedMissing.add(dedupeKey);
          findings.push({
            code: 'UNDECLARED_DEPENDENCY',
            category: 'dependencies',
            severity: 'high',
            confidence: 'high',
            title: `Undeclared external package imported: "${pkgName}"`,
            summary: `Module "${pkgName}" is imported in ${relPath} but not listed in package.json dependencies.`,
            file: relPath,
            line: reference.line,
            evidence: `Imported "${pkgName}" is absent from package.json dependencies`,
            whyItMatters:
              'Undeclared dependencies work locally only if cached in node_modules, but will fail with ModuleNotFoundError in clean CI and production environments.',
            remediation: `Add "${pkgName}" to your package.json dependencies using your package manager.`,
            deploymentImpact: 'blocking',
          });
      }
    }
  }

  return findings;
}
