import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectFilePresence } from '../filePresence.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-files-test-'));
}

async function mkdir(dir: string, rel: string): Promise<void> {
  await fs.mkdir(path.join(dir, rel), { recursive: true });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('detectFilePresence — router detection', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects root-level app/ as App Router', async () => {
    await mkdir(tmpDir, 'app');
    const result = await detectFilePresence(tmpDir);
    expect(result.appRouterPath).toBe('app');
    expect(result.hasAppRouter).toBe(true);
    expect(result.pagesRouterPath).toBeNull();
    expect(result.hasPagesRouter).toBe(false);
  });

  it('detects src/app/ as App Router', async () => {
    await mkdir(tmpDir, 'src/app');
    const result = await detectFilePresence(tmpDir);
    expect(result.appRouterPath).toBe('src/app');
    expect(result.hasAppRouter).toBe(true);
    expect(result.pagesRouterPath).toBeNull();
    expect(result.hasPagesRouter).toBe(false);
  });

  it('prefers root app/ over src/app/ when both exist', async () => {
    await mkdir(tmpDir, 'app');
    await mkdir(tmpDir, 'src/app');
    const result = await detectFilePresence(tmpDir);
    expect(result.appRouterPath).toBe('app');
  });

  it('detects root-level pages/ as Pages Router', async () => {
    await mkdir(tmpDir, 'pages');
    const result = await detectFilePresence(tmpDir);
    expect(result.pagesRouterPath).toBe('pages');
    expect(result.hasPagesRouter).toBe(true);
    expect(result.appRouterPath).toBeNull();
    expect(result.hasAppRouter).toBe(false);
  });

  it('detects src/pages/ as Pages Router', async () => {
    await mkdir(tmpDir, 'src/pages');
    const result = await detectFilePresence(tmpDir);
    expect(result.pagesRouterPath).toBe('src/pages');
    expect(result.hasPagesRouter).toBe(true);
    expect(result.appRouterPath).toBeNull();
    expect(result.hasAppRouter).toBe(false);
  });

  it('reports no router when neither app nor pages folder exists', async () => {
    const result = await detectFilePresence(tmpDir);
    expect(result.appRouterPath).toBeNull();
    expect(result.pagesRouterPath).toBeNull();
    expect(result.hasAppRouter).toBe(false);
    expect(result.hasPagesRouter).toBe(false);
  });
});
