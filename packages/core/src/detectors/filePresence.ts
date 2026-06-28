import fs from 'node:fs/promises';
import path from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilePresenceResult {
  hasSrcFolder: boolean;
  /** Relative path of the app router folder found ("app" | "src/app"), or null. */
  appRouterPath: string | null;
  /** Relative path of the pages router folder found ("pages" | "src/pages"), or null. */
  pagesRouterPath: string | null;
  /** True when appRouterPath is not null */
  hasAppRouter: boolean;
  /** True when pagesRouterPath is not null */
  hasPagesRouter: boolean;
  hasEnv: boolean;
  hasEnvLocal: boolean;
  hasEnvExample: boolean;
  hasGitignore: boolean;
  hasVercelJson: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks candidate relative paths in priority order and returns the first one
 * that exists, or null if none do.
 */
async function firstExisting(
  targetDir: string,
  candidates: string[],
): Promise<string | null> {
  for (const rel of candidates) {
    if (await exists(path.join(targetDir, rel))) return rel;
  }
  return null;
}

// ─── Detector ─────────────────────────────────────────────────────────────────

/**
 * Checks for the presence of common project files and directories.
 *
 * App router detection checks: app/ then src/app/
 * Pages router detection checks: pages/ then src/pages/
 * All independent checks are parallelised.
 */
export async function detectFilePresence(
  targetDir: string,
): Promise<FilePresenceResult> {
  const [
    hasSrcFolder,
    appRouterPath,
    pagesRouterPath,
    hasEnv,
    hasEnvLocal,
    hasEnvExample,
    hasGitignore,
    hasVercelJson,
  ] = await Promise.all([
    exists(path.join(targetDir, 'src')),
    firstExisting(targetDir, ['app', 'src/app']),
    firstExisting(targetDir, ['pages', 'src/pages']),
    exists(path.join(targetDir, '.env')),
    exists(path.join(targetDir, '.env.local')),
    exists(path.join(targetDir, '.env.example')),
    exists(path.join(targetDir, '.gitignore')),
    exists(path.join(targetDir, 'vercel.json')),
  ]);

  return {
    hasSrcFolder,
    appRouterPath,
    pagesRouterPath,
    hasAppRouter: appRouterPath !== null,
    hasPagesRouter: pagesRouterPath !== null,
    hasEnv,
    hasEnvLocal,
    hasEnvExample,
    hasGitignore,
    hasVercelJson,
  };
}
