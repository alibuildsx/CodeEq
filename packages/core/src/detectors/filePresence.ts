import fs from 'node:fs/promises';
import path from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilePresenceResult {
  hasSrcFolder: boolean;
  hasAppFolder: boolean;
  hasPagesFolder: boolean;
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

// ─── Detector ─────────────────────────────────────────────────────────────────

/**
 * Checks for the presence of common project files and directories.
 * All checks are independent and parallelised.
 */
export async function detectFilePresence(
  targetDir: string,
): Promise<FilePresenceResult> {
  const [
    hasSrcFolder,
    hasAppFolder,
    hasPagesFolder,
    hasEnv,
    hasEnvLocal,
    hasEnvExample,
    hasGitignore,
    hasVercelJson,
  ] = await Promise.all([
    exists(path.join(targetDir, 'src')),
    exists(path.join(targetDir, 'app')),
    exists(path.join(targetDir, 'pages')),
    exists(path.join(targetDir, '.env')),
    exists(path.join(targetDir, '.env.local')),
    exists(path.join(targetDir, '.env.example')),
    exists(path.join(targetDir, '.gitignore')),
    exists(path.join(targetDir, 'vercel.json')),
  ]);

  return {
    hasSrcFolder,
    hasAppFolder,
    hasPagesFolder,
    hasEnv,
    hasEnvLocal,
    hasEnvExample,
    hasGitignore,
    hasVercelJson,
  };
}
