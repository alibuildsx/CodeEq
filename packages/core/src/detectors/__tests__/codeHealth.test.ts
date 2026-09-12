import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectCodeHealthFindings } from '../codeHealth.js';

describe('detectCodeHealthFindings', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-health-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  describe('SYNTAX_ERROR', () => {
    it('detects syntax errors in broken TypeScript/JavaScript files with line numbers', async () => {
      await write(
        'src/broken.ts',
        'export function broken( {\n  const x = ;\n  return x\n}',
      );

      const findings = await detectCodeHealthFindings(tmpDir);
      const finding = findings.find((f) => f.code === 'SYNTAX_ERROR');

      expect(finding).toBeDefined();
      expect(finding?.category).toBe('code-health');
      expect(finding?.severity).toBe('high');
      expect(finding?.file).toBe('src/broken.ts');
      expect(finding?.line).toBeDefined();
    });

    it('does not flag clean source files with SYNTAX_ERROR', async () => {
      await write(
        'src/clean.ts',
        'export function add(a: number, b: number): number { return a + b; }',
      );

      const findings = await detectCodeHealthFindings(tmpDir);
      expect(findings.find((f) => f.code === 'SYNTAX_ERROR')).toBeUndefined();
    });
  });

  describe('UNRESOLVED_LOCAL_IMPORT', () => {
    it('detects broken relative imports when referenced file does not exist', async () => {
      await write(
        'src/components/Header.tsx',
        'import { UserButton } from "./MissingUserButton";\nexport const Header = () => null;',
      );

      const findings = await detectCodeHealthFindings(tmpDir);
      const finding = findings.find((f) => f.code === 'UNRESOLVED_LOCAL_IMPORT');

      expect(finding).toBeDefined();
      expect(finding?.file).toBe('src/components/Header.tsx');
      expect(finding?.evidence).toContain('./MissingUserButton');
      expect(finding?.deploymentImpact).toBe('blocking');
    });

    it('resolves valid relative imports with extensions and index files', async () => {
      await write('src/components/Header.tsx', 'import { Button } from "./Button";\nimport { utils } from "../lib";');
      await write('src/components/Button.tsx', 'export const Button = () => null;');
      await write('src/lib/index.ts', 'export const utils = {};');

      const findings = await detectCodeHealthFindings(tmpDir);
      expect(findings.find((f) => f.code === 'UNRESOLVED_LOCAL_IMPORT')).toBeUndefined();
    });

    it('resolves resource-query imports and JSX specifiers backed by TSX', async () => {
      await write(
        'src/app.tsx',
        'import Worker from "./worker.ts?worker&inline";\nimport View from "./View.jsx";',
      );
      await write('src/worker.ts', 'export default class Worker {}');
      await write('src/View.tsx', 'export default function View() { return null; }');

      const findings = await detectCodeHealthFindings(tmpDir);

      expect(findings.find((f) => f.code === 'UNRESOLVED_LOCAL_IMPORT')).toBeUndefined();
    });

    it('ignores import-looking text inside string and template literals', async () => {
      await write(
        'src/transformer.ts',
        'const fixture = `import "./not-a-real-module"`;\nconst snippet = "require(\\\"./also-not-real\\\")";',
      );

      const findings = await detectCodeHealthFindings(tmpDir);

      expect(findings.find((f) => f.code === 'UNRESOLVED_LOCAL_IMPORT')).toBeUndefined();
    });

    it('does not report unresolved imports from ordinary test directories', async () => {
      await write('test/integration.js', 'import missing from "./test-only-fixture.js";');
      await write('tests/unit.js', 'require("./missing-test-helper.js");');

      const findings = await detectCodeHealthFindings(tmpDir);

      expect(findings.find((f) => f.code === 'UNRESOLVED_LOCAL_IMPORT')).toBeUndefined();
    });
  });

  describe('HARDCODED_LOCALHOST_URL', () => {
    it('detects hardcoded localhost URLs in production source code', async () => {
      await write(
        'src/api.ts',
        'const API_BASE = "http://localhost:3000/api";\nexport const fetchData = () => fetch(API_BASE);',
      );

      const findings = await detectCodeHealthFindings(tmpDir);
      const finding = findings.find((f) => f.code === 'HARDCODED_LOCALHOST_URL');

      expect(finding).toBeDefined();
      expect(finding?.category).toBe('code-health');
      expect(finding?.severity).toBe('low');
      expect(finding?.evidence).toContain('http://localhost:3000/api');
    });

    it('does not flag localhost in test files or comment lines', async () => {
      await write('src/__tests__/api.test.ts', 'const URL = "http://localhost:3000";');
      await write('src/utils.ts', '// Default fallback is http://localhost:3000\nexport const x = 1;');

      const findings = await detectCodeHealthFindings(tmpDir);
      expect(findings.find((f) => f.code === 'HARDCODED_LOCALHOST_URL')).toBeUndefined();
    });
  });

  describe('UNFINISHED_CODE_MARKERS', () => {
    it('aggregates TODO and FIXME markers into a single finding', async () => {
      await write('src/a.ts', '// TODO: add auth\nexport const a = 1;');
      await write('src/b.ts', '// FIXME: memory leak\n// HACK: temporary fix\nexport const b = 2;');

      const findings = await detectCodeHealthFindings(tmpDir);
      const finding = findings.find((f) => f.code === 'UNFINISHED_CODE_MARKERS');

      expect(finding).toBeDefined();
      expect(finding?.category).toBe('code-health');
      expect(finding?.severity).toBe('low');
      expect(finding?.summary).toContain('3');
      expect(finding?.summary).toContain('2 files');
    });
  });

  describe('VERY_LARGE_SOURCE_FILE', () => {
    it('detects files that exceed the 600 line threshold', async () => {
      const longContent = Array.from({ length: 650 }, (_, i) => `const line${i} = ${i};`).join('\n');
      await write('src/hugeComponent.tsx', longContent);

      const findings = await detectCodeHealthFindings(tmpDir);
      const finding = findings.find((f) => f.code === 'VERY_LARGE_SOURCE_FILE');

      expect(finding).toBeDefined();
      expect(finding?.category).toBe('code-health');
      expect(finding?.severity).toBe('low');
      expect(finding?.file).toBe('src/hugeComponent.tsx');
    });

    it('does not flag large files in ordinary test directories', async () => {
      const longContent = Array.from({ length: 650 }, (_, i) => `const line${i} = ${i};`).join('\n');
      await write('test/large-suite.js', longContent);

      const findings = await detectCodeHealthFindings(tmpDir);

      expect(findings.find((f) => f.code === 'VERY_LARGE_SOURCE_FILE')).toBeUndefined();
    });
  });
});
