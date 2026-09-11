import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectSecurityFindings } from '../security.js';

describe('No-Git / Extracted Archive Directory Scanning', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-no-git-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  it('extracted archive without .git: never emits ENV_FILE_TRACKED when git metadata is missing', async () => {
    await write('.env', 'PORT=3000\nDATABASE_URL=postgres://localhost:5432/db');
    await write('.gitignore', 'node_modules\n');

    const findings = await detectSecurityFindings(tmpDir);
    const codes = findings.map((f) => f.code);

    // .env is present and unignored, so ENV_NOT_GITIGNORED is truthful
    expect(codes).toContain('ENV_NOT_GITIGNORED');

    // The scanner must NEVER claim the file is git-tracked when there is no git repo!
    expect(codes).not.toContain('ENV_FILE_TRACKED');
    expect(codes).not.toContain('ENV_FILE_TRACKED_IN_GIT');
  });

  it('extracted archive without .git: properly ignored .env produces zero env security findings', async () => {
    await write('.env', 'SECRET=xyz');
    await write('.gitignore', 'node_modules\n.env\n');

    const findings = await detectSecurityFindings(tmpDir);
    const codes = findings.map((f) => f.code);

    expect(codes).not.toContain('ENV_NOT_GITIGNORED');
    expect(codes).not.toContain('ENV_FILE_TRACKED');
  });

  it('directory with .git: truthfully detects tracked .env files only when in git index', async () => {
    // If .git folder exists but no commit/ls-files output, does not emit ENV_FILE_TRACKED
    await write('.git/config', '[core]\n');
    await write('.env', 'PORT=3000');
    await write('.gitignore', '.env');

    const findings = await detectSecurityFindings(tmpDir);
    const codes = findings.map((f) => f.code);

    // Ignored in gitignore, and git ls-files won't return it because it wasn't added
    expect(codes).not.toContain('ENV_NOT_GITIGNORED');
    expect(codes).not.toContain('ENV_FILE_TRACKED');
  });
});
