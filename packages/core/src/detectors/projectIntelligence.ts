import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AuthProvider,
  DatabaseProvider,
  DeploymentProvider,
  RouterType,
  TestFramework,
} from '../types/index.js';

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

// ─── Router Detection ─────────────────────────────────────────────────────────

export function detectRouter(params: {
  hasAppRouter: boolean;
  hasPagesRouter: boolean;
}): RouterType {
  const { hasAppRouter, hasPagesRouter } = params;
  if (hasAppRouter && hasPagesRouter) return 'hybrid';
  if (hasAppRouter) return 'app';
  if (hasPagesRouter) return 'pages';
  return 'none';
}

// ─── Database Detection ───────────────────────────────────────────────────────

export async function detectDatabase(
  targetDir: string,
  deps: Record<string, string>,
): Promise<DatabaseProvider> {
  const depNames = Object.keys(deps);

  // Supabase
  if (
    depNames.some((d) => d.startsWith('@supabase/')) ||
    depNames.includes('supabase') ||
    (await fileExists(path.join(targetDir, 'supabase', 'config.toml')))
  ) {
    return 'supabase';
  }

  // Prisma
  if (
    depNames.includes('@prisma/client') ||
    depNames.includes('prisma') ||
    (await fileExists(path.join(targetDir, 'prisma', 'schema.prisma')))
  ) {
    return 'prisma';
  }

  // Drizzle
  if (
    depNames.includes('drizzle-orm') ||
    depNames.includes('drizzle-kit') ||
    (await anyFileExists(targetDir, [
      'drizzle.config.ts',
      'drizzle.config.js',
      'drizzle.config.json',
    ]))
  ) {
    return 'drizzle';
  }

  // MongoDB
  if (depNames.includes('mongodb') || depNames.includes('mongoose')) {
    return 'mongodb';
  }

  // Firebase
  if (
    depNames.includes('firebase') ||
    depNames.includes('firebase-admin') ||
    (await fileExists(path.join(targetDir, 'firebase.json')))
  ) {
    return 'firebase';
  }

  return 'none';
}

// ─── Authentication Provider Detection ────────────────────────────────────────

export async function detectAuthProvider(
  _targetDir: string,
  deps: Record<string, string>,
  database: DatabaseProvider,
): Promise<AuthProvider> {
  const depNames = Object.keys(deps);

  // Clerk
  if (
    depNames.some(
      (d) =>
        d === '@clerk/nextjs' ||
        d === '@clerk/clerk-react' ||
        d === '@clerk/backend' ||
        d === '@clerk/clerk-sdk-node',
    )
  ) {
    return 'clerk';
  }

  // NextAuth / Auth.js
  if (
    depNames.includes('next-auth') ||
    depNames.includes('@auth/core') ||
    depNames.includes('@auth/nextjs')
  ) {
    return 'nextauth';
  }

  // Supabase Auth
  if (
    depNames.some((d) => d.includes('auth-helpers')) ||
    depNames.some((d) => d.includes('auth-ui')) ||
    database === 'supabase'
  ) {
    return 'supabase';
  }

  // Firebase Auth
  if (
    depNames.includes('@firebase/auth') ||
    (depNames.includes('firebase') && database === 'firebase')
  ) {
    return 'firebase';
  }

  return 'none';
}

// ─── Deployment Provider Detection ────────────────────────────────────────────

export async function detectDeploymentProvider(
  targetDir: string,
  deps: Record<string, string>,
  hasVercelJson: boolean,
): Promise<DeploymentProvider> {
  const depNames = Object.keys(deps);

  // Vercel
  if (
    hasVercelJson ||
    (await fileExists(path.join(targetDir, 'vercel.json'))) ||
    (await fileExists(path.join(targetDir, '.vercel'))) ||
    depNames.some((d) => d.startsWith('@vercel/'))
  ) {
    return 'vercel';
  }

  // Netlify
  if (
    (await fileExists(path.join(targetDir, 'netlify.toml'))) ||
    (await fileExists(path.join(targetDir, '.netlify'))) ||
    depNames.some((d) => d.startsWith('@netlify/'))
  ) {
    return 'netlify';
  }

  return 'none';
}

// ─── Testing Framework Detection ──────────────────────────────────────────────

export async function detectTestingFrameworks(
  targetDir: string,
  deps: Record<string, string>,
): Promise<TestFramework[]> {
  const depNames = Object.keys(deps);
  const frameworks: TestFramework[] = [];

  // Vitest
  if (
    depNames.includes('vitest') ||
    (await anyFileExists(targetDir, [
      'vitest.config.ts',
      'vitest.config.js',
      'vitest.config.mts',
      'vitest.config.mjs',
    ]))
  ) {
    frameworks.push('vitest');
  }

  // Jest
  if (
    depNames.includes('jest') ||
    (await anyFileExists(targetDir, [
      'jest.config.js',
      'jest.config.ts',
      'jest.config.json',
      'jest.config.mjs',
      'jest.config.cjs',
    ]))
  ) {
    frameworks.push('jest');
  }

  // Playwright
  if (
    depNames.includes('@playwright/test') ||
    (await anyFileExists(targetDir, ['playwright.config.ts', 'playwright.config.js']))
  ) {
    frameworks.push('playwright');
  }

  // Cypress
  if (
    depNames.includes('cypress') ||
    (await anyFileExists(targetDir, ['cypress.config.ts', 'cypress.config.js', 'cypress.json']))
  ) {
    frameworks.push('cypress');
  }

  return frameworks;
}

import { shouldSkipDirectory } from '../analysis/exclusionPolicy.js';

// ─── Source File Counter ──────────────────────────────────────────────────────

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.mjs',
  '.cjs',
]);

const EXCLUDED_SUFFIXES = ['.d.ts', '.d.ts.map', '.js.map'];

export async function countSourceFiles(targetDir: string): Promise<number> {
  let count = 0;

  async function walk(current: string): Promise<void> {
    let names: string[];
    try {
      names = await fs.readdir(current);
    } catch {
      return;
    }

    await Promise.all(
      names.map(async (name) => {
        const fullPath = path.join(current, name);
        let stat: Awaited<ReturnType<typeof fs.stat>>;
        try {
          stat = await fs.stat(fullPath);
        } catch {
          return;
        }

        if (stat.isDirectory()) {
          if (!shouldSkipDirectory(name)) {
            await walk(fullPath);
          }
          return;
        }

        if (EXCLUDED_SUFFIXES.some((suffix) => name.endsWith(suffix))) return;

        const ext = path.extname(name);
        if (SOURCE_EXTENSIONS.has(ext)) {
          count++;
        }
      }),
    );
  }

  await walk(targetDir);
  return count;
}
