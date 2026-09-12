import path from 'node:path';

// ─── Directory Sets ───────────────────────────────────────────────────────────

/**
 * Directories that are generated, build output, or heavy vendor dependencies.
 * These are always skipped during project traversal and diagnostic analysis.
 */
export const GENERATED_OR_HEAVY_DIRS = new Set<string>([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.output',
  '.turbo',
  'coverage',
  '.cache',
]);

/**
 * Dedicated nested non-production directories containing committed fixtures,
 * samples, examples, or mocks.
 *
 * When nested inside a project, these directories MUST be excluded from normal
 * application-source diagnostics so intentional broken code does not pollute
 * parent project scans.
 *
 * When scanned directly as the scan root (e.g. targetDir is test-fixtures/broken-code),
 * their contents ARE analyzed normally.
 */
export const NESTED_NON_PRODUCTION_DIRS = new Set<string>([
  'test-fixtures',
  'fixtures',
  '__fixtures__',
  'examples',
  'playground',
  'samples',
  'mocks',
  '__mocks__',
]);

/**
 * Documentation file extensions that should not be analyzed as executable
 * application source code.
 */
export const DOC_EXTENSIONS = new Set<string>([
  '.md',
  '.mdx',
  '.txt',
  '.markdown',
]);

// ─── Path Normalization & Helpers ─────────────────────────────────────────────

/**
 * Normalizes any file or directory path to POSIX forward slashes, stripping trailing slashes.
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+$/, '');
}

/**
 * Returns true if a directory name is in the generated/heavy or nested non-production sets.
 * Used by directory walkers (e.g. collectScannableFiles, countSourceFiles) when deciding
 * whether to descend into a child directory.
 */
export function shouldSkipDirectory(dirName: string): boolean {
  return GENERATED_OR_HEAVY_DIRS.has(dirName) || NESTED_NON_PRODUCTION_DIRS.has(dirName);
}

/**
 * Returns true if any directory segment in the given relative path matches a generated/heavy directory.
 */
export function isGeneratedOrHeavyPath(relPath: string): boolean {
  const normalized = normalizePath(relPath);
  const segments = normalized.split('/');
  return segments.some((seg) => GENERATED_OR_HEAVY_DIRS.has(seg));
}

/**
 * Returns true if the given path (relative to the scan root) is inside a dedicated
 * nested non-production directory (e.g. test-fixtures, fixtures, __fixtures__,
 * examples, samples, mocks, __mocks__).
 *
 * IMPORTANT: This operates on RELATIVE paths from the scan root (`targetDir`).
 * If the scan root itself is a fixture (e.g. `packages/core/test-fixtures/broken-code`),
 * files inside that fixture have relative paths like `src/syntaxError.ts`.
 * Their relative directory segments do NOT contain `test-fixtures`, so this function
 * returns false and allows the direct scan to proceed normally.
 */
export function isNestedNonProductionPath(relPath: string, isDirectory = false): boolean {
  const normalized = normalizePath(relPath);
  const segments = normalized.split('/');
  const dirSegments = isDirectory ? segments : segments.slice(0, -1);
  return dirSegments.some((seg) => NESTED_NON_PRODUCTION_DIRS.has(seg));
}

/**
 * Returns true if the relative path represents a test file (inside `test`, `tests`,
 * or `__tests__`, or matching `*.(test|spec).*`). Test directories remain traversable
 * so source-file counts stay representative; detector-specific diagnostics skip them.
 */
export function isTestFile(relPath: string): boolean {
  const normalized = normalizePath(relPath);
  const fileName = path.posix.basename(normalized);
  const segments = normalized.split('/');
  const dirSegments = segments.slice(0, -1);

  if (dirSegments.some((seg) => seg === '__tests__' || seg === 'test' || seg === 'tests')) {
    return true;
  }

  if (/\.(test|spec)\.[a-zA-Z0-9]+$/.test(fileName)) {
    return true;
  }

  if (/^(vitest|jest|playwright)\.config\.[a-zA-Z0-9]+$/.test(fileName)) {
    return true;
  }

  if (/^(test|spec)-[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(fileName)) {
    return true;
  }

  return false;
}

/**
 * Returns true if the relative path represents documentation or non-code sample files.
 */
export function isDocFile(relPath: string): boolean {
  const normalized = normalizePath(relPath);
  const ext = path.posix.extname(normalized).toLowerCase();
  if (DOC_EXTENSIONS.has(ext)) return true;

  const fileName = path.posix.basename(normalized);
  if (fileName.endsWith('.example') || fileName.endsWith('.sample')) return true;

  const segments = normalized.split('/');
  const dirSegments = segments.slice(0, -1);
  if (dirSegments.some((seg) => seg === 'docs' || seg === 'documentation')) {
    return true;
  }

  return false;
}

/**
 * Convenience helper returning true if a file is either a test or documentation file.
 */
export function isTestOrDocFile(relPath: string): boolean {
  return isTestFile(relPath) || isDocFile(relPath);
}
