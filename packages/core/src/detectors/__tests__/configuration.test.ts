import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectConfigurationFindings } from '../configuration.js';

describe('detectConfigurationFindings', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-cfg-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  it('detects PACKAGE_JSON_MISSING when package.json does not exist', async () => {
    const findings = await detectConfigurationFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'PACKAGE_JSON_MISSING');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('critical');
    expect(finding?.deploymentImpact).toBe('blocking');
  });

  it('detects PACKAGE_JSON_MALFORMED when package.json contains invalid JSON syntax', async () => {
    await write('package.json', '{ "name": "broken", invalid json }');

    const findings = await detectConfigurationFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'PACKAGE_JSON_MALFORMED');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('critical');
    expect(finding?.deploymentImpact).toBe('blocking');
  });

  it('detects MULTIPLE_LOCKFILES when multiple lockfiles exist', async () => {
    await write('package.json', JSON.stringify({ name: 'multi-pm', scripts: { build: 'tsc' } }));
    await write('package-lock.json', '{}');
    await write('pnpm-lock.yaml', 'lockfileVersion: 5.4');

    const findings = await detectConfigurationFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'MULTIPLE_LOCKFILES');

    expect(finding).toBeDefined();
    expect(finding?.evidence).toContain('package-lock.json');
    expect(finding?.evidence).toContain('pnpm-lock.yaml');
  });

  it('detects PACKAGE_MANAGER_MISMATCH when packageManager field does not match lockfile', async () => {
    await write('package.json', JSON.stringify({
      name: 'mismatch-app',
      packageManager: 'pnpm@9.0.0',
      scripts: { build: 'tsc' },
    }));
    await write('package-lock.json', '{}');

    const findings = await detectConfigurationFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'PACKAGE_MANAGER_MISMATCH');

    expect(finding).toBeDefined();
    expect(finding?.evidence).toContain('pnpm');
    expect(finding?.evidence).toContain('package-lock.json');
  });

  it('detects TYPESCRIPT_CONFIG_MISSING when TypeScript files exist without tsconfig', async () => {
    await write('package.json', JSON.stringify({ name: 'no-tsconfig', scripts: { build: 'tsc' } }));
    await write('src/index.ts', 'export const x = 1;');
    await write('src/app.tsx', 'export const App = () => null;');

    const findings = await detectConfigurationFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'TYPESCRIPT_CONFIG_MISSING');

    expect(finding).toBeDefined();
    expect(finding?.category).toBe('configuration');
    expect(finding?.severity).toBe('medium');
  });

  it('does not flag TYPESCRIPT_CONFIG_MISSING when tsconfig.json exists', async () => {
    await write('package.json', JSON.stringify({ name: 'with-tsconfig', scripts: { build: 'tsc' } }));
    await write('tsconfig.json', '{}');
    await write('src/index.ts', 'export const x = 1;');

    const findings = await detectConfigurationFindings(tmpDir);
    expect(findings.find((f) => f.code === 'TYPESCRIPT_CONFIG_MISSING')).toBeUndefined();
  });

  it('detects missing build script, missing start script, and missing next.config for Next.js', async () => {
    await write('package.json', JSON.stringify({
      name: 'next-incomplete',
      dependencies: { next: '^14.0.0' },
    }));

    const findings = await detectConfigurationFindings(tmpDir);
    const codes = findings.map((f) => f.code);

    expect(codes).toContain('MISSING_BUILD_SCRIPT');
    expect(codes).toContain('MISSING_START_SCRIPT');
    expect(codes).toContain('NEXTJS_MISSING_CONFIG');

    const buildFinding = findings.find((f) => f.code === 'MISSING_BUILD_SCRIPT');
    expect(buildFinding?.deploymentImpact).toBe('blocking');
  });

  it('does not require a build script for a source-shipping JavaScript library', async () => {
    await write('package.json', JSON.stringify({
      name: 'source-library',
      type: 'module',
      exports: './index.js',
    }));
    await write('index.js', 'export const value = 42;');

    const findings = await detectConfigurationFindings(tmpDir);

    expect(findings.find((f) => f.code === 'MISSING_BUILD_SCRIPT')).toBeUndefined();
  });
});
