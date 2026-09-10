import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeScan, formatJsonOutput, resolveDefaultScanDirectory } from '../scanCommand.js';

describe('scan command execution', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-cli-test-'));
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'cli-fixture',
      scripts: { build: 'tsc' },
    }));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('does not write a Markdown report when writing is disabled', async () => {
    const execution = await executeScan(tmpDir, { write: false });

    expect(execution.reportWritten).toBe(false);
    await expect(fs.access(path.join(tmpDir, 'PROJECT_HEALTH_REPORT.md'))).rejects.toThrow();
  });

  it('writes a custom report path relative to the scanned project', async () => {
    const execution = await executeScan(tmpDir, {
      write: true,
      report: 'reports/CODEEQ_REPORT.md',
    });

    expect(execution.result.reportPath).toBe(path.join(tmpDir, 'reports', 'CODEEQ_REPORT.md'));
    await expect(fs.readFile(execution.result.reportPath, 'utf-8')).resolves.toContain('CodeEq v0.2');
  });

  it('formats a machine-readable JSON result conforming to schemaVersion 1.0', async () => {
    const execution = await executeScan(tmpDir, { write: false });
    const output = formatJsonOutput(execution.result);

    expect(JSON.parse(output)).toMatchObject({
      schemaVersion: '1.0',
      healthScore: expect.any(Number),
      health: {
        overall: expect.any(Number),
        categories: expect.objectContaining({
          security: expect.any(Number),
          configuration: expect.any(Number),
          codeHealth: expect.any(Number),
          dependencies: expect.any(Number),
          deployment: expect.any(Number),
        }),
      },
      deploymentReadiness: expect.any(String),
      findings: expect.any(Array),
      projectInfo: expect.objectContaining({
        router: expect.any(String),
        sourceFileCount: expect.any(Number),
      }),
      apiRoutes: [],
    });
  });

  it('uses the invoking directory when a package script changes the process cwd', () => {
    const invokingDir = path.join(tmpDir, 'invoking-project');

    expect(resolveDefaultScanDirectory(tmpDir, invokingDir)).toBe(path.resolve(invokingDir));
    expect(resolveDefaultScanDirectory(tmpDir)).toBe(path.resolve(tmpDir));
  });
});
