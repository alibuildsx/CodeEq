import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectDependencyFindings, findNearestPackageManifest } from '../dependencies.js';

describe('detectDependencyFindings', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-dep-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  // ─── Single-Package Compatibility ───────────────────────────────────────────

  it('single package declared dependency: root package.json declares axios -> no finding', async () => {
    await write('package.json', JSON.stringify({
      name: 'single-app',
      dependencies: { axios: '^1.6.0' },
    }));
    await write('src/app.ts', 'import axios from "axios";');

    const findings = await detectDependencyFindings(tmpDir);
    expect(findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY')).toHaveLength(0);
  });

  it('single package undeclared dependency: root package.json does not declare axios -> UNDECLARED_DEPENDENCY', async () => {
    await write('package.json', JSON.stringify({
      name: 'single-app',
      dependencies: { react: '^18.0.0' },
    }));
    await write('src/app.ts', 'import axios from "axios";');

    const findings = await detectDependencyFindings(tmpDir);
    const undeclared = findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY');
    expect(undeclared).toHaveLength(1);
    expect(undeclared[0]?.evidence).toContain('axios');
    expect(undeclared[0]?.file).toBe('src/app.ts');
  });

  it('ignores dependency-looking text inside string and template literals', async () => {
    await write('package.json', JSON.stringify({ name: 'transformer' }));
    await write(
      'src/index.ts',
      'const source = `import value from "not-a-dependency"`;\nconst other = "require(\\\"also-not-a-dependency\\\")";',
    );

    const findings = await detectDependencyFindings(tmpDir);

    expect(findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY')).toHaveLength(0);
  });

  it('treats the owning package name as a valid self-reference', async () => {
    await write('package.json', JSON.stringify({ name: 'self-package', exports: './src/index.js' }));
    await write('src/feature.js', 'import self from "self-package";');

    const findings = await detectDependencyFindings(tmpDir);

    expect(findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY')).toHaveLength(0);
  });

  it('does not diagnose imports in ordinary test directories', async () => {
    await write('package.json', JSON.stringify({ name: 'tested-package' }));
    await write('test/integration.js', 'import helper from "test-only-helper";');
    await write('tests/unit.js', 'require("another-test-helper");');

    const findings = await detectDependencyFindings(tmpDir);

    expect(findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY')).toHaveLength(0);
  });

  // ─── Workspace Package Behavior ─────────────────────────────────────────────

  it('workspace package declared dependency: resolves from owning package manifest, not root', async () => {
    // Root monorepo manifest with no application dependencies
    await write('package.json', JSON.stringify({
      name: 'monorepo-root',
      private: true,
      devDependencies: { typescript: '^5.0.0' },
    }));

    // Workspace package manifest declaring zod
    await write('packages/core/package.json', JSON.stringify({
      name: '@my/core',
      dependencies: { zod: '^3.22.0' },
    }));
    await write('packages/core/src/index.ts', 'import { z } from "zod"; export const schema = z.string();');

    const findings = await detectDependencyFindings(tmpDir);
    expect(findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY')).toHaveLength(0);
  });

  it('workspace package undeclared dependency: flags missing dep in package manifest', async () => {
    await write('package.json', JSON.stringify({
      name: 'monorepo-root',
      private: true,
    }));

    await write('packages/core/package.json', JSON.stringify({
      name: '@my/core',
      dependencies: { zod: '^3.22.0' },
    }));
    // Imports axios, which is NOT declared in packages/core/package.json
    await write('packages/core/src/index.ts', 'import axios from "axios";');

    const findings = await detectDependencyFindings(tmpDir);
    const undeclared = findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY');
    expect(undeclared).toHaveLength(1);
    expect(undeclared[0]?.evidence).toContain('axios');
    expect(undeclared[0]?.file).toBe('packages/core/src/index.ts');
  });

  it('two workspace packages: each source tree uses its own owning package manifest', async () => {
    await write('package.json', JSON.stringify({
      name: 'monorepo-root',
      private: true,
    }));

    // packages/core declares zod
    await write('packages/core/package.json', JSON.stringify({
      name: '@my/core',
      dependencies: { zod: '^3.22.0' },
    }));
    await write('packages/core/src/index.ts', 'import { z } from "zod";');

    // packages/cli declares commander
    await write('packages/cli/package.json', JSON.stringify({
      name: '@my/cli',
      dependencies: { commander: '^12.0.0' },
    }));
    await write('packages/cli/src/index.ts', 'import { Command } from "commander";');

    const findings = await detectDependencyFindings(tmpDir);
    expect(findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY')).toHaveLength(0);
  });

  it('nested package: nearest manifest wins when manifests exist at multiple ancestor levels', async () => {
    await write('package.json', JSON.stringify({
      name: 'root',
      dependencies: { rootDep: '^1.0.0' },
    }));

    // Intermediate ancestor manifest
    await write('services/package.json', JSON.stringify({
      name: 'services-group',
      dependencies: { lodash: '^4.17.21' },
    }));

    // Deepest nearest owning package manifest
    await write('services/auth/package.json', JSON.stringify({
      name: 'auth-service',
      dependencies: { jsonwebtoken: '^9.0.0' },
    }));
    // Imports jsonwebtoken (declared in nearest) and lodash (NOT declared in nearest, only in parent)
    await write(
      'services/auth/src/token.ts',
      'import jwt from "jsonwebtoken";\nimport _ from "lodash";',
    );

    const findings = await detectDependencyFindings(tmpDir);
    const undeclared = findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY');

    // jsonwebtoken is declared in nearest manifest -> OK
    expect(undeclared.some((f) => f.evidence?.includes('jsonwebtoken'))).toBe(false);

    // lodash is not declared in nearest manifest -> flagged
    expect(undeclared.some((f) => f.evidence?.includes('lodash'))).toBe(true);
  });

  it('scoped dependency: preserves @scope/pkg/subpath -> @scope/pkg resolution', async () => {
    await write('packages/core/package.json', JSON.stringify({
      name: '@my/core',
      dependencies: { '@supabase/supabase-js': '^2.39.0' },
    }));
    await write('packages/core/src/client.ts', 'import { createClient } from "@supabase/supabase-js/dist/module";');

    const findings = await detectDependencyFindings(tmpDir);
    expect(findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY')).toHaveLength(0);
  });

  it('root boundary: manifest resolution must never travel above the scan root', async () => {
    // Create an external parent directory that has a package.json
    const outerDir = path.join(tmpDir, 'outer');
    const innerScanRoot = path.join(outerDir, 'inner');
    await fs.mkdir(innerScanRoot, { recursive: true });

    // Outer directory has package.json declaring secret-pkg
    await fs.writeFile(
      path.join(outerDir, 'package.json'),
      JSON.stringify({ name: 'outer', dependencies: { 'secret-pkg': '^1.0.0' } }),
    );

    // Inner directory has NO package.json and a source file importing secret-pkg
    const testFile = path.join(innerScanRoot, 'src', 'app.ts');
    await fs.mkdir(path.dirname(testFile), { recursive: true });
    await fs.writeFile(testFile, 'import { secret } from "secret-pkg";', 'utf-8');

    // findNearestPackageManifest called with innerScanRoot as scanRoot must return null, NOT outer
    const dirCache = new Map<string, string | null>();
    const manifest = await findNearestPackageManifest(testFile, innerScanRoot, dirCache);
    expect(manifest).toBeNull();
  });

  it('no package.json case: does not crash and avoids misleading findings', async () => {
    await write('src/app.ts', 'import axios from "axios";');

    const findings = await detectDependencyFindings(tmpDir);
    expect(findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY')).toHaveLength(0);
  });

  it('optionalDependencies: counts optionalDependencies as declared', async () => {
    await write('package.json', JSON.stringify({
      name: 'optional-dep-app',
      optionalDependencies: { fsevents: '^2.3.3' },
    }));
    await write('src/watcher.ts', 'import fsevents from "fsevents";');

    const findings = await detectDependencyFindings(tmpDir);
    expect(findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY')).toHaveLength(0);
  });

  it('ignores Node.js built-ins and relative/alias imports', async () => {
    await write('package.json', JSON.stringify({
      name: 'test-builtins',
      dependencies: {},
    }));
    await write(
      'src/index.ts',
      'import fs from "node:fs/promises";\nimport path from "path";\nimport { foo } from "./foo";\nimport { bar } from "@/components/bar";',
    );

    const findings = await detectDependencyFindings(tmpDir);
    expect(findings.filter((f) => f.code === 'UNDECLARED_DEPENDENCY')).toHaveLength(0);
  });

  it('detects DUPLICATE_DEPENDENCY_DECLARATION when a package is in both deps and devDeps', async () => {
    await write('package.json', JSON.stringify({
      name: 'test-dup',
      dependencies: { zod: '^3.20.0' },
      devDependencies: { zod: '^3.22.0' },
    }));

    const findings = await detectDependencyFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'DUPLICATE_DEPENDENCY_DECLARATION');

    expect(finding).toBeDefined();
    expect(finding?.category).toBe('dependencies');
    expect(finding?.severity).toBe('low');
    expect(finding?.evidence).toContain('zod');
  });
});
