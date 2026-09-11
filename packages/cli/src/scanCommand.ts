import fs from 'node:fs/promises';
import path from 'node:path';
import { generateMarkdownReport, scanProject } from '@codeeq/core';
import type { ScanResult } from '@codeeq/core';

export interface ScanCommandOptions {
  write: boolean;
  report?: string;
}

export interface ScanExecution {
  result: ScanResult;
  reportWritten: boolean;
}

export function resolveDefaultScanDirectory(
  processCwd: string,
  invokingCwd?: string,
): string {
  return path.resolve(invokingCwd ?? processCwd);
}

function resolveReportPath(targetDir: string, requestedPath?: string): string {
  if (!requestedPath) return path.join(targetDir, 'PROJECT_HEALTH_REPORT.md');
  return path.isAbsolute(requestedPath)
    ? path.normalize(requestedPath)
    : path.resolve(targetDir, requestedPath);
}

export async function executeScan(
  directory: string,
  options: ScanCommandOptions,
): Promise<ScanExecution> {
  const targetDir = path.resolve(directory);
  const scanned = await scanProject(targetDir);
  const result: ScanResult = {
    ...scanned,
    reportPath: resolveReportPath(targetDir, options.report),
  };

  if (!options.write) {
    return { result, reportWritten: false };
  }

  await fs.mkdir(path.dirname(result.reportPath), { recursive: true });
  await fs.writeFile(result.reportPath, generateMarkdownReport(result), 'utf-8');
  return { result, reportWritten: true };
}

export function formatJsonOutput(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function computeExitCode(readiness: ScanResult['deploymentReadiness']): number {
  return readiness === 'Blocked' ? 1 : 0;
}

