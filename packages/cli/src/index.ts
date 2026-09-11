#!/usr/bin/env node

import path from 'node:path';
import { Command } from 'commander';
import type { ScanResult, Severity } from '@codeeq/core';
import { computeExitCode, executeScan, formatJsonOutput, resolveDefaultScanDirectory } from './scanCommand.js';






// ─── Version ──────────────────────────────────────────────────────────────────

const VERSION = '1.0.0';

// ─── Terminal colours (ANSI) ──────────────────────────────────────────────────

const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  green:   '\x1b[32m',
  orange:  '\x1b[38;5;208m',
};

// ─── Terminal summary renderer ────────────────────────────────────────────────

function severityColor(s: Severity): string {
  switch (s) {
    case 'critical': return c.red;
    case 'high':     return c.orange;
    case 'medium':   return c.yellow;
    case 'low':      return c.blue;
  }
}

function severityEmoji(s: Severity): string {
  switch (s) {
    case 'critical': return '🔴';
    case 'high':     return '🟠';
    case 'medium':   return '🟡';
    case 'low':      return '🔵';
  }
}

function frameworkLabel(f: string): string {
  switch (f) {
    case 'nextjs':  return 'Next.js';
    case 'vite':    return 'Vite';
    case 'react':   return 'React';
    case 'express': return 'Node/Express';
    default:        return 'Unknown';
  }
}

function padRight(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

function printSummary(result: ScanResult, reportWritten: boolean): void {
  const { projectInfo: info, reportPath } = result;
  const findings = result.findings ?? result.issues ?? [];

  const counts: Record<Severity, number> = {
    critical: findings.filter((i) => i.severity === 'critical').length,
    high:     findings.filter((i) => i.severity === 'high').length,
    medium:   findings.filter((i) => i.severity === 'medium').length,
    low:      findings.filter((i) => i.severity === 'low').length,
  };

  const stack = `${info.language === 'typescript' ? 'TypeScript' : 'JavaScript'} + ${info.packageManager}`;
  const framework = frameworkLabel(info.framework);
  const relReport = path.relative(process.cwd(), reportPath) || reportPath;

  const W = 45; // inner width of box

  const row = (label: string, value: string): string => {
    const inner = `  ${c.dim}${label}${c.reset}  ${c.bold}${value}${c.reset}`;
    // We can't measure ANSI length, so pad based on raw string lengths
    const rawInner = `  ${label}  ${value}`;
    const pad = ' '.repeat(Math.max(0, W - rawInner.length));
    return `│${inner}${pad}│`;
  };

  const divider = `├${'─'.repeat(W)}┤`;
  const top     = `┌${'─'.repeat(W)}┐`;
  const bottom  = `└${'─'.repeat(W)}┘`;

  const titleStr = '  🛡️  codeeq scan results';
  const titlePad = ' '.repeat(Math.max(0, W - '  🛡️  codeeq scan results'.length));

  console.log('');
  console.log(`${c.cyan}${top}${c.reset}`);
  console.log(`${c.cyan}│${c.reset}${c.bold}${titleStr}${titlePad}${c.reset}${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}${divider}${c.reset}`);
  console.log(`${c.cyan}${row('Project:  ', info.name)}${c.reset}`);
  console.log(`${c.cyan}${row('Framework:', framework)}${c.reset}`);
  console.log(`${c.cyan}${row('Stack:    ', stack)}${c.reset}`);
  console.log(`${c.cyan}${row('Score:    ', `${result.healthScore} / 100`)}${c.reset}`);
  console.log(`${c.cyan}${row('Readiness:', result.deploymentReadiness)}${c.reset}`);
  console.log(`${c.cyan}${divider}${c.reset}`);

  const severities: Severity[] = ['critical', 'high', 'medium', 'low'];
  for (const sev of severities) {
    const count = counts[sev];
    const emoji = severityEmoji(sev);
    const label = padRight(`${emoji} ${sev.charAt(0).toUpperCase() + sev.slice(1)}`, 14);
    const color = count > 0 ? severityColor(sev) : c.dim;
    const inner = `  ${color}${label}${c.reset}  ${c.bold}${count}${c.reset}`;
    const rawLen = `  ${label}  ${count}`.length;
    const pad = ' '.repeat(Math.max(0, W - rawLen));
    console.log(`${c.cyan}│${c.reset}${inner}${pad}${c.cyan}│${c.reset}`);
  }

  console.log(`${c.cyan}${divider}${c.reset}`);

  const reportLabel = 'Report:   ';
  const reportDisplay = reportWritten ? relReport : 'Not written (--no-write)';
  const reportVal = reportDisplay.length > W - reportLabel.length - 4
    ? '...' + reportDisplay.slice(-(W - reportLabel.length - 7))
    : reportDisplay;
  console.log(`${c.cyan}${row(reportLabel, reportVal)}${c.reset}`);
  console.log(`${c.cyan}${bottom}${c.reset}`);
  console.log('');
}

// ─── Scan command ─────────────────────────────────────────────────────────────

interface CliScanOptions {
  write: boolean;
  json?: boolean;
  report?: string;
}

async function runScan(directory: string, options: CliScanOptions): Promise<void> {
  const targetDir = path.resolve(directory);

  if (!options.json) {
    console.log(`\n${c.cyan}${c.bold}codeeq${c.reset} ${c.dim}v${VERSION}${c.reset}`);
    console.log(`${c.dim}Scanning: ${targetDir}${c.reset}\n`);
  }

  let execution: Awaited<ReturnType<typeof executeScan>>;
  try {
    execution = await executeScan(targetDir, {
      write: options.write,
      report: options.report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(options.json ? JSON.stringify({ error: message }) : `${c.red}✖ Scan failed: ${message}${c.reset}`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(formatJsonOutput(execution.result));
  } else {
    printSummary(execution.result, execution.reportWritten);
  }

  // Exit with non-zero code if deployment is blocked
  process.exitCode = computeExitCode(execution.result.deploymentReadiness);
}

// ─── Commander setup ──────────────────────────────────────────────────────────

const program = new Command();

program
  .name('codeeq')
  .description('Local-first project health scanner for vibe coders')
  .version(VERSION, '-v, --version', 'Output the current version');

program
  .command('scan [directory]')
  .description(
    'Scan a project directory and generate a health report. ' +
    'Defaults to the current working directory.',
  )
  .option('--no-write', 'Do not write a Markdown report')
  .option('--json', 'Print the scan result as JSON')
  .option('--report <path>', 'Write the Markdown report to a custom path')
  .action(async (directory: string | undefined, options: CliScanOptions) => {
    const defaultDirectory = resolveDefaultScanDirectory(process.cwd(), process.env['INIT_CWD']);
    await runScan(directory ?? defaultDirectory, options);
  });

program.parse(process.argv);
