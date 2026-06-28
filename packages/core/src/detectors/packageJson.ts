import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { PackageManager } from '../types/index.js';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const PackageJsonSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  scripts: z.record(z.string()).optional().default({}),
  dependencies: z.record(z.string()).optional().default({}),
  devDependencies: z.record(z.string()).optional().default({}),
  peerDependencies: z.record(z.string()).optional().default({}),
});

export type ParsedPackageJson = z.infer<typeof PackageJsonSchema>;

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Reads and validates package.json in the given directory.
 * Returns null if the file is missing or malformed.
 */
export async function readPackageJson(
  targetDir: string,
): Promise<ParsedPackageJson | null> {
  const pkgPath = path.join(targetDir, 'package.json');
  try {
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const json = JSON.parse(raw) as unknown;
    const result = PackageJsonSchema.safeParse(json);
    if (!result.success) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

/**
 * Merges prod + dev + peer dependencies into a single flat map.
 */
export function mergeDependencies(pkg: ParsedPackageJson): Record<string, string> {
  return {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };
}

// ─── Package manager detection ────────────────────────────────────────────────

/**
 * Detects the package manager by checking for lockfiles in the target directory.
 * Order of priority: bun → pnpm → yarn → npm → unknown.
 */
export async function detectPackageManager(
  targetDir: string,
): Promise<PackageManager> {
  const checks: Array<[string, PackageManager]> = [
    ['bun.lockb', 'bun'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
  ];

  for (const [lockfile, manager] of checks) {
    try {
      await fs.access(path.join(targetDir, lockfile));
      return manager;
    } catch {
      // not found, continue
    }
  }
  return 'unknown';
}
