#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { scanProject, generateMarkdownReport } from '@project-safety/core';
import type { ScanResult, Severity } from '@project-safety/core';

// ─── Version ──────────────────────────────────────────────────────────────────

const VERSION = '0.1.0';

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

function printSummary(result: ScanResult): void {
  const { projectInfo: info, issues, reportPath } = result;

  const counts: Record<Severity, number> = {
    critical: issues.filter((i) => i.severity === 'critical').length,
    high:     issues.filter((i) => i.severity === 'high').length,
    medium:   issues.filter((i) => i.severity === 'medium').length,
    low:      issues.filter((i) => i.severity === 'low').length,
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

  const titleStr = '  🛡️  project-safety scan results';
  const titlePad = ' '.repeat(Math.max(0, W - '  🛡️  project-safety scan results'.length));

  console.log('');
  console.log(`${c.cyan}${top}${c.reset}`);
  console.log(`${c.cyan}│${c.reset}${c.bold}${titleStr}${titlePad}${c.reset}${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}${divider}${c.reset}`);
  console.log(`${c.cyan}${row('Project:  ', info.name)}${c.reset}`);
  console.log(`${c.cyan}${row('Framework:', framework)}${c.reset}`);
  console.log(`${c.cyan}${row('Stack:    ', stack)}${c.reset}`);
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
  const reportVal = relReport.length > W - reportLabel.length - 4
    ? '...' + relReport.slice(-(W - reportLabel.length - 7))
    : relReport;
  console.log(`${c.cyan}${row(reportLabel, reportVal)}${c.reset}`);
  console.log(`${c.cyan}${bottom}${c.reset}`);
  console.log('');
}

// ─── Scan command ─────────────────────────────────────────────────────────────

async function runScan(directory: string): Promise<void> {
  const targetDir = path.resolve(directory);

  console.log(`\n${c.cyan}${c.bold}project-safety${c.reset} ${c.dim}v${VERSION}${c.reset}`);
  console.log(`${c.dim}Scanning: ${targetDir}${c.reset}\n`);

  let result: ScanResult;
  try {
    result = await scanProject(targetDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${c.red}✖ Scan failed: ${message}${c.reset}`);
    process.exit(1);
  }

  // Write Markdown report
  const report = generateMarkdownReport(result);
  try {
    await fs.writeFile(result.reportPath, report, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${c.red}✖ Failed to write report: ${message}${c.reset}`);
    process.exit(1);
  }

  // Print terminal summary
  printSummary(result);

  // Exit with non-zero code if any critical issues found
  const hasCritical = result.issues.some((i) => i.severity === 'critical');
  if (hasCritical) {
    process.exit(1);
  }
}

// ─── Commander setup ──────────────────────────────────────────────────────────

const program = new Command();

program
  .name('project-safety')
  .description('Local-first project health scanner for vibe coders')
  .version(VERSION, '-v, --version', 'Output the current version');

program
  .command('scan [directory]')
  .description(
    'Scan a project directory and generate a health report. ' +
    'Defaults to the current working directory.',
  )
  .action(async (directory: string | undefined) => {
    await runScan(directory ?? process.cwd());
  });

program.parse(process.argv);
