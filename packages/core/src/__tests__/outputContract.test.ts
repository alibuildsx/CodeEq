import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from '../scanners/projectScanner.js';
import { generateMarkdownReport } from '../reports/markdownReport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_ROOT = path.resolve(__dirname, '../../test-fixtures');

describe('ScanResult Output Contract (schemaVersion 1.0)', () => {
  it('strictly adheres to schemaVersion 1.0 contract across all required fields and sub-objects', async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, 'security-problems');
    const result = await scanProject(fixtureDir);

    // Root contract
    expect(result.schemaVersion).toBe('1.0');
    expect(typeof result.scannedAt).toBe('string');
    expect(new Date(result.scannedAt).getTime()).not.toBeNaN();
    expect(typeof result.targetDir).toBe('string');
    expect(typeof result.healthScore).toBe('number');
    expect(['Ready', 'Needs attention', 'Blocked']).toContain(result.deploymentReadiness);

    // Health contract
    expect(result.health).toBeDefined();
    expect(typeof result.health.overall).toBe('number');
    expect(result.health.overall).toBeGreaterThanOrEqual(0);
    expect(result.health.overall).toBeLessThanOrEqual(100);

    const categories = result.health.categories;
    expect(categories).toBeDefined();
    for (const cat of ['security', 'configuration', 'codeHealth', 'dependencies', 'deployment'] as const) {
      expect(typeof categories[cat]).toBe('number');
      expect(categories[cat]).toBeGreaterThanOrEqual(0);
      expect(categories[cat]).toBeLessThanOrEqual(100);
    }

    // ProjectInfo contract
    const info = result.projectInfo;
    expect(info).toBeDefined();
    expect(typeof info.name).toBe('string');
    expect(typeof info.framework).toBe('string');
    expect(typeof info.language).toBe('string');
    expect(typeof info.packageManager).toBe('string');
    expect(typeof info.sourceFileCount).toBe('number');
    expect(info.sourceFileCount).toBeGreaterThanOrEqual(1);

    // Findings contract
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);

    for (const f of result.findings) {
      expect(typeof f.code).toBe('string');
      expect(['security', 'configuration', 'code-health', 'dependencies', 'deployment']).toContain(f.category);
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(f.severity);
      expect(['high', 'medium', 'low']).toContain(f.confidence);
      expect(typeof f.title).toBe('string');
      expect(typeof f.summary).toBe('string');
      expect(typeof f.whyItMatters).toBe('string');
      expect(typeof f.remediation).toBe('string');
      expect(['blocking', 'risk', 'none']).toContain(f.deploymentImpact);

      if (f.file !== undefined) {
        expect(typeof f.file).toBe('string');
        // Portable forward-slash relative path check
        expect(f.file).not.toContain('\\');
      }
      if (f.line !== undefined) {
        expect(typeof f.line).toBe('number');
        expect(f.line).toBeGreaterThanOrEqual(1);
      }
    }

    // JSON serialization contract: no non-serializable or undefined properties leaking
    const jsonStr = JSON.stringify(result);
    const roundTripped = JSON.parse(jsonStr);
    expect(roundTripped.schemaVersion).toBe('1.0');
    expect(roundTripped.findings).toHaveLength(result.findings.length);

    // Markdown contract
    const md = generateMarkdownReport(result);
    expect(md).toContain('# 🛡️ Project Health Report');
    expect(md).toContain('## Health Score');
    expect(md).toContain('| Category | Score |');
    expect(md).toContain('## Deployment Readiness');
  });
});
