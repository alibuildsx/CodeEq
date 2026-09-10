import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectDependencyFindings } from '../dependencies.js';

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

  it('detects UNDECLARED_DEPENDENCY when an external import is missing from package.json', async () => {
    await write('package.json', JSON.stringify({
      name: 'test-pkg',
      dependencies: { react: '^18.0.0' },
    }));
    await write('src/index.ts', 'import axios from "axios";\nimport { debounce } from "lodash/debounce";');

    const findings = await detectDependencyFindings(tmpDir);
    const codes = findings.map((f) => f.code);

    expect(codes).toContain('UNDECLARED_DEPENDENCY');
    const axiosFinding = findings.find((f) => f.evidence?.includes('axios'));
    expect(axiosFinding).toBeDefined();
    expect(axiosFinding?.category).toBe('dependencies');
    expect(axiosFinding?.severity).toBe('high');
    expect(axiosFinding?.deploymentImpact).toBe('blocking');

    const lodashFinding = findings.find((f) => f.evidence?.includes('lodash'));
    expect(lodashFinding).toBeDefined();
  });

  it('handles scoped packages properly in UNDECLARED_DEPENDENCY', async () => {
    await write('package.json', JSON.stringify({
      name: 'test-scoped',
      dependencies: {},
    }));
    await write('src/index.ts', 'import { client } from "@supabase/supabase-js/dist/module";');

    const findings = await detectDependencyFindings(tmpDir);
    const finding = findings.find((f) => f.evidence?.includes('@supabase/supabase-js'));

    expect(finding).toBeDefined();
    expect(finding?.code).toBe('UNDECLARED_DEPENDENCY');
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
