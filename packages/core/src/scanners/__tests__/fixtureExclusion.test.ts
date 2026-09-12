import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from '../projectScanner.js';

describe('Nested Fixture, Example, and Mock Exclusion Policy', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-exclusion-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  it('parent project scan: ignores intentionally broken code inside nested test-fixtures', async () => {
    // Parent project root
    await write(
      'package.json',
      JSON.stringify({
        name: 'parent-project',
        scripts: { build: 'tsc' },
        dependencies: { react: '^19.0.0' },
      }),
    );
    await write('tsconfig.json', '{}');
    await write('.gitignore', 'node_modules\n');
    // Valid parent source
    await write('src/index.ts', 'export const message = "hello world";');

    // Nested fixture with intentional syntax error, broken import, and leaked credential
    await write(
      'test-fixtures/broken-project/src/broken.ts',
      'const invalid = ;;; // syntax error\nimport { missing } from "./does-not-exist";\nconst token = "ghp_123456789012345678901234567890123456";',
    );

    const result = await scanProject(tmpDir);

    // Parent scan must NOT contain findings originating from test-fixtures
    const fixtureFindings = result.findings.filter((f) =>
      f.file?.includes('test-fixtures'),
    );
    expect(fixtureFindings).toHaveLength(0);

    // Specifically verify no SYNTAX_ERROR or UNRESOLVED_LOCAL_IMPORT leaked
    expect(result.findings.some((f) => f.code === 'SYNTAX_ERROR')).toBe(false);
    expect(result.findings.some((f) => f.code === 'UNRESOLVED_LOCAL_IMPORT')).toBe(false);
    expect(result.findings.some((f) => f.code === 'HARDCODED_GITHUB_TOKEN')).toBe(false);

    // Source file count should only count parent source (src/index.ts), not fixture files
    expect(result.projectInfo.sourceFileCount).toBe(1);
    expect(result.deploymentReadiness).not.toBe('Blocked');
  });

  it('direct fixture scan: scanning the fixture directory directly DOES detect its broken code', async () => {
    const fixtureDir = path.join(tmpDir, 'test-fixtures', 'broken-project');

    // Setup fixture directly
    await write(
      'test-fixtures/broken-project/package.json',
      JSON.stringify({
        name: 'broken-project-fixture',
        scripts: { build: 'tsc' },
      }),
    );
    await write(
      'test-fixtures/broken-project/src/syntaxError.ts',
      'const bad = ;;;',
    );
    await write(
      'test-fixtures/broken-project/src/brokenImport.ts',
      'import { notFound } from "./nonExistentModule";',
    );

    // Scan the fixture DIRECTLY
    const result = await scanProject(fixtureDir);

    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('SYNTAX_ERROR');
    expect(codes).toContain('UNRESOLVED_LOCAL_IMPORT');
    expect(result.deploymentReadiness).toBe('Blocked');
  });

  it('normal application source: broken code in src/ continues to produce expected findings', async () => {
    await write(
      'package.json',
      JSON.stringify({
        name: 'app-with-errors',
        scripts: { build: 'tsc' },
      }),
    );
    await write('tsconfig.json', '{}');
    await write('.gitignore', 'node_modules\n');
    // Broken code in real source directory
    await write('src/broken.ts', 'const x = ;;;');
    await write('src/badImport.ts', 'import { missing } from "./missing";');

    const result = await scanProject(tmpDir);

    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('SYNTAX_ERROR');
    expect(codes).toContain('UNRESOLVED_LOCAL_IMPORT');
    expect(result.deploymentReadiness).toBe('Blocked');
  });

  it('nested examples: sample/demo code does not produce undeclared dep or localhost warnings for parent', async () => {
    await write(
      'package.json',
      JSON.stringify({
        name: 'library-with-examples',
        scripts: { build: 'tsc' },
        dependencies: { lodash: '^4.17.21' },
      }),
    );
    await write('tsconfig.json', '{}');
    await write('.gitignore', 'node_modules\n');
    await write('src/index.ts', 'import _ from "lodash"; export default _;');

    // Nested examples folder with localhost and undeclared import
    await write(
      'examples/basic/demo.ts',
      'import axios from "axios";\nconst url = "http://localhost:3000/api";',
    );

    const result = await scanProject(tmpDir);

    const exampleFindings = result.findings.filter((f) =>
      f.file?.includes('examples'),
    );
    expect(exampleFindings).toHaveLength(0);
    expect(result.findings.some((f) => f.code === 'UNDECLARED_DEPENDENCY')).toBe(false);
    expect(result.findings.some((f) => f.code === 'HARDCODED_LOCALHOST_URL')).toBe(false);
  });

  it('nested mocks: mock directories do not trigger placeholder/vibe false positives', async () => {
    await write(
      'package.json',
      JSON.stringify({
        name: 'app-with-mocks',
        scripts: { build: 'tsc' },
      }),
    );
    await write('tsconfig.json', '{}');
    await write('.gitignore', 'node_modules\n');
    await write('src/index.ts', 'export const ok = true;');

    // Nested mocks with placeholder pattern
    await write(
      'mocks/handlers.ts',
      'export const mockUser = { email: "user@example.com", token: "YOUR_API_KEY" };',
    );
    await write(
      '__mocks__/service.ts',
      'export const dummyToken = "replace-me";',
    );

    const result = await scanProject(tmpDir);

    const placeholderFindings = result.findings.filter((f) =>
      f.code === 'PLACEHOLDER_VALUE_LEFTOVER',
    );
    expect(placeholderFindings).toHaveLength(0);
  });

  it('cross-platform: handles Windows-style backslashes and POSIX relative paths consistently', async () => {
    await write(
      'package.json',
      JSON.stringify({
        name: 'cross-platform-test',
        scripts: { build: 'tsc' },
      }),
    );
    await write('tsconfig.json', '{}');
    await write('.gitignore', 'node_modules\n');
    await write('src/index.ts', 'export const ok = true;');

    // Write nested samples with deliberate syntax errors
    await write(
      'samples/bad/syntax.ts',
      'const broken = ;;;',
    );

    const result = await scanProject(tmpDir);

    expect(result.findings.some((f) => f.code === 'SYNTAX_ERROR')).toBe(false);
    expect(result.findings.filter((f) => f.file?.includes('samples'))).toHaveLength(0);
  });
});
