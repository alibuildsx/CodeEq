import fs from 'node:fs/promises';
import path from 'node:path';
import { shouldSkipDirectory } from '../analysis/exclusionPolicy.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * File extensions scanned for secrets.
 * Includes .json as requested (but lockfiles are excluded via EXCLUDED_DIRS).
 */
const SCANNABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.mjs',
  '.cjs',
  '.cts',
  '.json',
  '.pem',
  '.key',
  '.cert',
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
]);

/**
 * Filenames that are always excluded even if they have a scannable extension.
 * Catches lockfiles that don't live in excluded dirs.
 */
const EXCLUDED_FILENAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
]);

/**
 * File name suffixes that are always excluded.
 * .d.ts and .d.ts.map are TypeScript declaration / map files generated during
 * compilation — they are not user-authored source and should not be scanned.
 */
const EXCLUDED_SUFFIXES = ['.d.ts', '.d.ts.map', '.js.map'];

// ─── Regex patterns ───────────────────────────────────────────────────────────

/**
 * Matches `service_role` in contexts that look like real credential exposure:
 * - env var assignments: SUPABASE_KEY=eyJ...service_role...
 * - string literals assigned to variables: const key = '...service_role...'
 * This is case-sensitive (Supabase tokens are always lowercase).
 */
const SERVICE_ROLE_ASSIGNMENT = /(?:=|:\s*)['"` ]?[A-Za-z0-9+/=._-]*service_role[A-Za-z0-9+/=._-]*/;

/**
 * Lines starting with these patterns are skipped (they are code/comments,
 * not credential values).
 */
const SKIP_LINE_PREFIXES = [
  '//',   // single-line comment
  '*',    // JSDoc / block comment line
  '#',    // shell/env comment
  'import', // import statement
  'export', // export statement
  'const SERVICE_ROLE', // our own constant definition
  '/\\b',  // regex literal start
];

// ─── File walker ──────────────────────────────────────────────────────────────

/**
 * Recursively collects all scannable file paths under `dir`,
 * honouring the exclusion lists.
 */
async function collectScannableFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let names: string[];
    try {
      names = await fs.readdir(current);
    } catch {
      return; // unreadable directory — skip silently
    }

    await Promise.all(
      names.map(async (name) => {
        const fullPath = path.join(current, name);
        let stat: Awaited<ReturnType<typeof fs.lstat>>;
        try {
          stat = await fs.lstat(fullPath);
        } catch {
          return; // broken symlink or race condition — skip
        }

        if (stat.isSymbolicLink()) return;

        if (stat.isDirectory()) {
          if (!shouldSkipDirectory(name)) {
            await walk(fullPath);
          }
          return;
        }

        if (EXCLUDED_FILENAMES.has(name)) return;
        if (EXCLUDED_SUFFIXES.some((suffix) => name.endsWith(suffix))) return;

        const ext = path.extname(name);
        // Also catch dotfiles like .env, .env.local (no extension → ext is '')
        const isDotEnv = name.startsWith('.env');
        if (SCANNABLE_EXTENSIONS.has(ext) || isDotEnv) {
          results.push(fullPath);
        }
      }),
    );
  }

  await walk(dir);
  return results;
}

// ─── Supabase detector ────────────────────────────────────────────────────────

export interface SupabaseDetectionResult {
  usesSupabase: boolean;
  /** True if `service_role` text was found in any source file */
  serviceRoleLeaked: boolean;
  /** Path of first file where the leak was detected, if any */
  leakFoundIn?: string;
}

/**
 * Detects Supabase usage (via deps) and scans source files for leaked
 * service-role key text.
 */
export async function detectSupabase(
  targetDir: string,
  deps: Record<string, string>,
  options?: {
    files?: string[];
  },
): Promise<SupabaseDetectionResult> {
  const depNames = Object.keys(deps);
  const usesSupabase =
    depNames.some((d) => d.startsWith('@supabase/')) ||
    depNames.includes('supabase');

  const files = options?.files ?? (await collectScannableFiles(targetDir));

  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        // Skip empty lines and comment/code-pattern lines
        if (line.length === 0) continue;
        if (SKIP_LINE_PREFIXES.some((p) => line.startsWith(p))) continue;
        // Only flag lines that look like assignments containing service_role
        if (SERVICE_ROLE_ASSIGNMENT.test(line)) {
          return {
            usesSupabase,
            serviceRoleLeaked: true,
            leakFoundIn: path.relative(targetDir, filePath),
          };
        }
      }
    } catch {
      // binary or unreadable file — skip
    }
  }

  return { usesSupabase, serviceRoleLeaked: false };
}

// ─── Re-export walker for use by other detectors ─────────────────────────────

export { collectScannableFiles };
