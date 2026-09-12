import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { computeExitCode, executeScan } from '../scanCommand.js';

describe('CLI Exit Code Policy', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-exit-code-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  it('computes exit code 0 for Ready and Needs attention, and 1 for Blocked', () => {
    expect(computeExitCode('Ready')).toBe(0);
    expect(computeExitCode('Needs attention')).toBe(0);
    expect(computeExitCode('Blocked')).toBe(1);
  });

  it('returns exit code 0 for a clean healthy project (Ready)', async () => {
    const fixtureDir = path.resolve(__dirname, '../../../core/test-fixtures/healthy-nextjs');
    const execution = await executeScan(fixtureDir, { write: false });
    expect(execution.result.deploymentReadiness).toBe('Ready');
    expect(computeExitCode(execution.result.deploymentReadiness)).toBe(0);
  });

  it('returns exit code 0 for a project with only warnings/risks (Needs attention)', async () => {
    const fixtureDir = path.resolve(__dirname, '../../../core/test-fixtures/messy-vibe-project');
    const execution = await executeScan(fixtureDir, { write: false });
    expect(execution.result.deploymentReadiness).toBe('Needs attention');
    expect(computeExitCode(execution.result.deploymentReadiness)).toBe(0);
  });

  it('returns exit code 1 for a project with blocking issues (Blocked)', async () => {
    const fixtureDir = path.resolve(__dirname, '../../../core/test-fixtures/broken-code');
    const execution = await executeScan(fixtureDir, { write: false });
    expect(execution.result.deploymentReadiness).toBe('Blocked');
    expect(computeExitCode(execution.result.deploymentReadiness)).toBe(1);
  });

  it('returns exit code 1 for a project with missing build script (medium severity + blocking impact)', async () => {
    const fixtureDir = path.resolve(__dirname, '../../../core/test-fixtures/configuration-problems');
    const execution = await executeScan(fixtureDir, { write: false });
    expect(execution.result.deploymentReadiness).toBe('Blocked');
    expect(computeExitCode(execution.result.deploymentReadiness)).toBe(1);
  });

});
