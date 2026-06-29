import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectEnvSafety } from '../envSafety.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-env-test-'));
}

async function write(dir: string, filename: string, content: string): Promise<void> {
  await fs.writeFile(path.join(dir, filename), content, 'utf-8');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('detectEnvSafety', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('flags .env as not gitignored when .gitignore is missing', async () => {
    await write(tmpDir, '.env', 'SECRET=abc');
    const result = await detectEnvSafety(tmpDir, { hasEnv: true, hasEnvLocal: false });
    expect(result.envNotGitignored).toBe(true);
  });

  it('does not flag .env when it is listed in .gitignore', async () => {
    await write(tmpDir, '.env', 'SECRET=abc');
    await write(tmpDir, '.gitignore', '# secrets\n.env\n');
    const result = await detectEnvSafety(tmpDir, { hasEnv: true, hasEnvLocal: false });
    expect(result.envNotGitignored).toBe(false);
  });

  it('flags .env.local as not gitignored', async () => {
    await write(tmpDir, '.env.local', 'SECRET=abc');
    await write(tmpDir, '.gitignore', '.env\n');
    const result = await detectEnvSafety(tmpDir, { hasEnv: false, hasEnvLocal: true });
    expect(result.envLocalNotGitignored).toBe(true);
  });

  it('does not flag .env.local when covered by .env* wildcard', async () => {
    await write(tmpDir, '.env.local', 'SECRET=abc');
    await write(tmpDir, '.gitignore', '.env*\n');
    const result = await detectEnvSafety(tmpDir, { hasEnv: false, hasEnvLocal: true });
    expect(result.envLocalNotGitignored).toBe(false);
  });

  it('detects suspicious NEXT_PUBLIC_ variable names', async () => {
    await write(tmpDir, '.env', 'NEXT_PUBLIC_SECRET_KEY=exposed_value\n');
    const result = await detectEnvSafety(tmpDir, { hasEnv: true, hasEnvLocal: false });
    expect(result.suspiciousNextPublicVars).toContain('NEXT_PUBLIC_SECRET_KEY');
  });

  it('does not flag safe NEXT_PUBLIC_ variable names', async () => {
    await write(tmpDir, '.env', 'NEXT_PUBLIC_SITE_URL=https://example.com\n');
    const result = await detectEnvSafety(tmpDir, { hasEnv: true, hasEnvLocal: false });
    expect(result.suspiciousNextPublicVars).toHaveLength(0);
  });

  it('lists env variable names missing from .env.example without exposing values', async () => {
    await write(tmpDir, '.env', '# database\nDATABASE_URL=postgres://private\nSHARED=value\n');
    await write(tmpDir, '.env.local', '\nexport LOCAL_TOKEN=very-secret\nSHARED=override\n');
    await write(tmpDir, '.env.example', '# documented\nSHARED=\n');

    const result = await detectEnvSafety(tmpDir, { hasEnv: true, hasEnvLocal: true });

    expect(result.missingEnvExampleVars).toEqual(['DATABASE_URL', 'LOCAL_TOKEN']);
    expect(JSON.stringify(result)).not.toContain('postgres://private');
    expect(JSON.stringify(result)).not.toContain('very-secret');
  });
});
