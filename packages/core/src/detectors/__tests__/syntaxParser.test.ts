import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectCodeHealthFindings } from '../codeHealth.js';

describe('Syntax Parser Multi-Dialect Support', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-parser-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  it('correctly parses valid code across all supported JS/TS dialects without syntax errors', async () => {
    // Valid TS with generics
    await write('src/typed.ts', 'export function identity<T>(value: T): T { return value; }');

    // Valid TSX with JSX element and generic
    await write(
      'src/component.tsx',
      'import React from "react";\nexport const Item = <T,>({ data }: { data: T }) => <div>{String(data)}</div>;',
    );

    // Valid JS
    await write('src/plain.js', 'function add(a, b) { return a + b; }\nmodule.exports = { add };');

    // Valid JSX
    await write('src/element.jsx', 'export function Tag() { return <span className="active">tag</span>; }');

    // Valid ESM (.mjs / .mts)
    await write('src/esmModule.mjs', 'export const pi = 3.14159;');
    await write('src/tsEsmModule.mts', 'export const e: number = 2.71828;');

    // Valid CJS (.cjs)
    await write('src/common.cjs', 'const path = require("path");\nmodule.exports = path.sep;');

    const findings = await detectCodeHealthFindings(tmpDir);
    const syntaxErrors = findings.filter((f) => f.code === 'SYNTAX_ERROR');

    expect(syntaxErrors).toHaveLength(0);
  });

  it('detects syntax errors in malformed files across dialects without crashing', async () => {
    await write('src/brokenTs.ts', 'const invalidTs = ;;;');
    await write('src/brokenTsx.tsx', 'export const Bad = () => <div><span>unclosed; };');
    await write('src/brokenJs.js', 'function bad( { return; }');

    const findings = await detectCodeHealthFindings(tmpDir);
    const syntaxErrors = findings.filter((f) => f.code === 'SYNTAX_ERROR');

    expect(syntaxErrors.length).toBeGreaterThanOrEqual(2);
    for (const err of syntaxErrors) {
      expect(err.category).toBe('code-health');
      expect(err.severity).toBe('high');
      expect(err.deploymentImpact).toBe('blocking');
      expect(err.line).toBeDefined();
      expect(err.evidence).toBeDefined();
    }
  });
});
