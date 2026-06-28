import fs from 'node:fs/promises';
import path from 'node:path';
import type { Framework } from '../types/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FrameworkDetectionResult {
  framework: Framework;
  /** Human-readable label shown in the terminal summary */
  label: string;
}

// ─── Config file fingerprints ─────────────────────────────────────────────────

const NEXTJS_CONFIGS = [
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
  'next.config.cjs',
];

const VITE_CONFIGS = [
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mts',
  'vite.config.mjs',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function anyFileExists(dir: string, names: string[]): Promise<boolean> {
  for (const name of names) {
    if (await fileExists(path.join(dir, name))) return true;
  }
  return false;
}

// ─── Detector ─────────────────────────────────────────────────────────────────

/**
 * Detects the framework used in the project.
 * Priority: Next.js → Vite → React → Express → unknown.
 *
 * Uses both dependency names and config file presence for reliable detection.
 */
export async function detectFramework(
  targetDir: string,
  deps: Record<string, string>,
): Promise<FrameworkDetectionResult> {
  const depNames = Object.keys(deps);

  // ── Next.js ──
  if (
    depNames.includes('next') ||
    (await anyFileExists(targetDir, NEXTJS_CONFIGS))
  ) {
    return { framework: 'nextjs', label: 'Next.js' };
  }

  // ── Vite ──
  if (
    depNames.includes('vite') ||
    (await anyFileExists(targetDir, VITE_CONFIGS))
  ) {
    return { framework: 'vite', label: 'Vite' };
  }

  // ── React (without Vite / Next) ──
  if (depNames.includes('react') || depNames.includes('react-dom')) {
    return { framework: 'react', label: 'React' };
  }

  // ── Express ──
  if (depNames.includes('express')) {
    return { framework: 'express', label: 'Node/Express' };
  }

  return { framework: 'unknown', label: 'Unknown' };
}

// ─── Config presence helpers (used by issue detectors) ───────────────────────

export async function hasNextConfig(targetDir: string): Promise<boolean> {
  return anyFileExists(targetDir, NEXTJS_CONFIGS);
}
