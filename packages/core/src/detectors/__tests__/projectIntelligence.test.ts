import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  countSourceFiles,
  detectAuthProvider,
  detectDatabase,
  detectDeploymentProvider,
  detectRouter,
  detectTestingFrameworks,
} from '../projectIntelligence.js';
import { detectPackageManager } from '../packageJson.js';

describe('Project Intelligence', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-intel-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  describe('detectRouter', () => {
    it('detects App Router', () => {
      expect(detectRouter({ hasAppRouter: true, hasPagesRouter: false })).toBe('app');
    });

    it('detects Pages Router', () => {
      expect(detectRouter({ hasAppRouter: false, hasPagesRouter: true })).toBe('pages');
    });

    it('detects Hybrid Router', () => {
      expect(detectRouter({ hasAppRouter: true, hasPagesRouter: true })).toBe('hybrid');
    });

    it('detects None when neither is present', () => {
      expect(detectRouter({ hasAppRouter: false, hasPagesRouter: false })).toBe('none');
    });
  });

  describe('detectDatabase', () => {
    it('detects Supabase from dependencies', async () => {
      expect(await detectDatabase(tmpDir, { '@supabase/supabase-js': '^2.0.0' })).toBe('supabase');
    });

    it('detects Prisma from dependencies', async () => {
      expect(await detectDatabase(tmpDir, { '@prisma/client': '^5.0.0' })).toBe('prisma');
    });

    it('detects Prisma from schema file', async () => {
      await write('prisma/schema.prisma', 'datasource db {}');
      expect(await detectDatabase(tmpDir, {})).toBe('prisma');
    });

    it('detects Drizzle from dependencies', async () => {
      expect(await detectDatabase(tmpDir, { 'drizzle-orm': '^0.30.0' })).toBe('drizzle');
    });

    it('detects Drizzle from config file', async () => {
      await write('drizzle.config.ts', 'export default {}');
      expect(await detectDatabase(tmpDir, {})).toBe('drizzle');
    });

    it('detects MongoDB from dependencies', async () => {
      expect(await detectDatabase(tmpDir, { mongoose: '^8.0.0' })).toBe('mongodb');
    });

    it('detects Firebase from dependencies', async () => {
      expect(await detectDatabase(tmpDir, { firebase: '^10.0.0' })).toBe('firebase');
    });

    it('returns none when no database indicators are found', async () => {
      expect(await detectDatabase(tmpDir, {})).toBe('none');
    });
  });

  describe('detectAuthProvider', () => {
    it('detects Clerk from dependencies', async () => {
      expect(await detectAuthProvider(tmpDir, { '@clerk/nextjs': '^5.0.0' }, 'none')).toBe('clerk');
    });

    it('detects NextAuth from dependencies', async () => {
      expect(await detectAuthProvider(tmpDir, { 'next-auth': '^4.0.0' }, 'none')).toBe('nextauth');
    });

    it('detects Auth.js from dependencies', async () => {
      expect(await detectAuthProvider(tmpDir, { '@auth/core': '^0.18.0' }, 'none')).toBe('nextauth');
    });

    it('detects Supabase Auth from explicit auth helper packages, not database usage alone', async () => {
      expect(await detectAuthProvider(tmpDir, { '@supabase/auth-helpers-nextjs': '^0.8.0' }, 'none')).toBe('supabase');
      expect(await detectAuthProvider(tmpDir, { '@supabase/supabase-js': '^2.0.0' }, 'supabase')).toBe('none');
    });

    it('detects Firebase Auth only from the explicit auth package', async () => {
      expect(await detectAuthProvider(tmpDir, { '@firebase/auth': '^1.0.0' }, 'none')).toBe('firebase');
      expect(await detectAuthProvider(tmpDir, { firebase: '^10.0.0' }, 'firebase')).toBe('none');
    });

    it('returns none when no auth provider is found', async () => {
      expect(await detectAuthProvider(tmpDir, {}, 'none')).toBe('none');
    });
  });

  describe('detectDeploymentProvider', () => {
    it('detects Vercel from vercel.json or presence flag', async () => {
      expect(await detectDeploymentProvider(tmpDir, {}, true)).toBe('vercel');
      await write('vercel.json', '{}');
      expect(await detectDeploymentProvider(tmpDir, {}, false)).toBe('vercel');
    });

    it('detects Netlify from netlify.toml', async () => {
      await write('netlify.toml', '[build]');
      expect(await detectDeploymentProvider(tmpDir, {}, false)).toBe('netlify');
    });

    it('detects Netlify from dependencies', async () => {
      expect(await detectDeploymentProvider(tmpDir, { '@netlify/functions': '^2.0.0' }, false)).toBe('netlify');
    });

    it('returns none when no deployment provider is identified', async () => {
      expect(await detectDeploymentProvider(tmpDir, {}, false)).toBe('none');
    });
  });

  describe('detectTestingFrameworks', () => {
    it('detects Vitest from dependencies', async () => {
      expect(await detectTestingFrameworks(tmpDir, { vitest: '^1.0.0' })).toEqual(['vitest']);
    });

    it('detects Jest and Playwright when both are present', async () => {
      expect(await detectTestingFrameworks(tmpDir, { jest: '^29.0.0', '@playwright/test': '^1.40.0' })).toEqual([
        'jest',
        'playwright',
      ]);
    });

    it('detects Cypress from config file', async () => {
      await write('cypress.config.ts', 'export default {}');
      expect(await detectTestingFrameworks(tmpDir, {})).toEqual(['cypress']);
    });

    it('returns empty array when no test frameworks are found', async () => {
      expect(await detectTestingFrameworks(tmpDir, {})).toEqual([]);
    });
  });

  describe('detectPackageManager', () => {
    it('detects packageManager from package.json if lockfile is absent', async () => {
      await write('package.json', JSON.stringify({
        name: 'test-pm',
        packageManager: 'pnpm@9.1.0',
      }));

      expect(await detectPackageManager(tmpDir)).toBe('pnpm');
    });

    it('prefers existing lockfile over packageManager if lockfile is present', async () => {
      await write('package.json', JSON.stringify({
        name: 'test-pm',
        packageManager: 'yarn@1.22.0',
      }));
      await write('pnpm-lock.yaml', 'lockfileVersion: 5.4');

      expect(await detectPackageManager(tmpDir)).toBe('pnpm');
    });

    it('detects bun.lock', async () => {
      await write('bun.lock', '');
      expect(await detectPackageManager(tmpDir)).toBe('bun');
    });
  });

  describe('countSourceFiles', () => {
    it('counts valid source files and ignores node_modules, .git, dist, build, etc.', async () => {
      await write('src/index.ts', 'console.log(1)');
      await write('src/components/Button.tsx', 'export const Button = () => null');
      await write('src/utils/math.js', 'module.exports = {}');
      await write('src/types.d.ts', 'export type X = string;'); // declaration file - ignored
      await write('src/utils/math.js.map', '{}'); // sourcemap - ignored
      await write('node_modules/pkg/index.js', '...'); // ignored dir
      await write('.git/HEAD', '...'); // ignored dir
      await write('dist/index.js', '...'); // ignored dir
      await write('build/index.js', '...'); // ignored dir
      await write('.next/server.js', '...'); // ignored dir
      await write('coverage/lcov.info', '...'); // ignored dir

      const count = await countSourceFiles(tmpDir);
      expect(count).toBe(3);
    });

    it('does not follow directory symlinks outside the scan root', async () => {
      const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-outside-'));
      try {
        await fs.writeFile(path.join(outside, 'outside.ts'), 'export const outside = true;');
        await fs.symlink(outside, path.join(tmpDir, 'linked'), 'junction');

        expect(await countSourceFiles(tmpDir)).toBe(0);
      } finally {
        await fs.rm(outside, { recursive: true, force: true });
      }
    });
  });
});
