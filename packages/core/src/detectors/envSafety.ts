import fs from 'node:fs/promises';
import path from 'node:path';

// ─── Patterns ─────────────────────────────────────────────────────────────────

/**
 * NEXT_PUBLIC_ variable names containing these substrings are flagged
 * as "likely private secrets exposed to the browser".
 */
const SENSITIVE_NAME_TOKENS = [
  'SECRET',
  'SERVICE_ROLE',
  'PRIVATE',
  'TOKEN',
  'PASS',
  'PWD',
  'PASSWORD',
  'API_KEY',
  'APIKEY',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reads a file and returns its lines.  Returns [] if the file doesn't exist.
 */
async function readLines(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n');
  } catch {
    return [];
  }
}

/**
 * Checks whether a given pattern string (from .gitignore) matches a filename.
 * Handles leading slash, trailing slash, and simple glob-free patterns.
 * Intentionally simple — covers the 99 % case without pulling in a glob lib.
 */
function gitignoreMatchesFile(pattern: string, filename: string): boolean {
  // Strip leading slash
  const p = pattern.startsWith('/') ? pattern.slice(1) : pattern;
  // Strip trailing slash (directory pattern)
  const normalized = p.endsWith('/') ? p.slice(0, -1) : p;
  return normalized === filename;
}

// ─── Gitignore reader ─────────────────────────────────────────────────────────

/**
 * Returns the set of non-comment, non-blank gitignore patterns.
 */
async function readGitignorePatterns(targetDir: string): Promise<string[]> {
  const lines = await readLines(path.join(targetDir, '.gitignore'));
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

// ─── Env variable reader ──────────────────────────────────────────────────────

/**
 * Extracts variable names (keys) from a .env file.
 * Ignores comment lines and blank lines.
 */
function extractEnvKeys(lines: string[]): string[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && l.includes('='))
    .map((l) => l.split('=')[0]!.trim().replace(/^export\s+/, ''))
    .filter((key) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key));
}

// ─── Detector result ──────────────────────────────────────────────────────────

export interface EnvSafetyResult {
  /** .env not listed in .gitignore */
  envNotGitignored: boolean;
  /** .env.local not listed in .gitignore */
  envLocalNotGitignored: boolean;
  /** NEXT_PUBLIC_ vars whose names look like private secrets */
  suspiciousNextPublicVars: string[];
  /** Variable names used by env files but absent from .env.example */
  missingEnvExampleVars: string[];
}

// ─── Main detector ────────────────────────────────────────────────────────────

/**
 * Analyses .gitignore coverage for env files and scans env files
 * for NEXT_PUBLIC_ variables whose names suggest they are private secrets.
 */
export async function detectEnvSafety(
  targetDir: string,
  presence: { hasEnv: boolean; hasEnvLocal: boolean },
): Promise<EnvSafetyResult> {
  const patterns = await readGitignorePatterns(targetDir);

  // ── Gitignore coverage ──
  const envIgnored = patterns.some((p) =>
    gitignoreMatchesFile(p, '.env'),
  );
  const envLocalIgnored = patterns.some(
    (p) =>
      gitignoreMatchesFile(p, '.env.local') ||
      // Many templates use `.env*.local` or `.env*` as a catch-all
      p === '.env*.local' ||
      p === '.env*',
  );

  const envNotGitignored = presence.hasEnv && !envIgnored;
  const envLocalNotGitignored = presence.hasEnvLocal && !envLocalIgnored;

  // ── NEXT_PUBLIC_ scan ──
  const envFiles = ['.env', '.env.local', '.env.production', '.env.staging'];
  const suspiciousNextPublicVars: string[] = [];

  for (const envFile of envFiles) {
    const lines = await readLines(path.join(targetDir, envFile));
    const keys = extractEnvKeys(lines);

    for (const key of keys) {
      if (!key.startsWith('NEXT_PUBLIC_')) continue;
      const upperKey = key.toUpperCase();
      const isSuspicious = SENSITIVE_NAME_TOKENS.some((token) =>
        upperKey.includes(token),
      );
      if (isSuspicious && !suspiciousNextPublicVars.includes(key)) {
        suspiciousNextPublicVars.push(key);
      }
    }
  }

  let missingEnvExampleVars: string[] = [];
  try {
    await fs.access(path.join(targetDir, '.env.example'));
    const requiredKeys = new Set<string>();
    for (const envFile of ['.env', '.env.local']) {
      const keys = extractEnvKeys(await readLines(path.join(targetDir, envFile)));
      keys.forEach((key) => requiredKeys.add(key));
    }

    const exampleKeys = new Set(
      extractEnvKeys(await readLines(path.join(targetDir, '.env.example'))),
    );
    missingEnvExampleVars = [...requiredKeys]
      .filter((key) => !exampleKeys.has(key))
      .sort();
  } catch {
    // A missing example file is reported separately by the scanner.
  }

  return {
    envNotGitignored,
    envLocalNotGitignored,
    suspiciousNextPublicVars,
    missingEnvExampleVars,
  };
}
