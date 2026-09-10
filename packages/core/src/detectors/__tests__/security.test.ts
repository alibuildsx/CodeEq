import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectSecurityFindings } from '../security.js';

describe('detectSecurityFindings', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-sec-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  it('detects unignored .env, .env.local, and .env.production', async () => {
    await write('.env', 'PORT=3000');
    await write('.env.local', 'SECRET=xyz');
    await write('.env.production', 'API_KEY=123');
    await write('.gitignore', 'node_modules\n');

    const findings = await detectSecurityFindings(tmpDir);
    const codes = findings.map((f) => f.code);

    expect(codes).toContain('ENV_NOT_GITIGNORED');
    expect(codes).toContain('ENV_LOCAL_NOT_GITIGNORED');
    expect(codes).toContain('ENV_PRODUCTION_NOT_GITIGNORED');
  });

  it('detects GitHub tokens and redacts raw secrets in evidence', async () => {
    const fakeToken = 'ghp_' + 'A'.repeat(36);
    await write('src/config.ts', `const token = "${fakeToken}";`);

    const findings = await detectSecurityFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'HARDCODED_GITHUB_TOKEN');

    expect(finding).toBeDefined();
    expect(finding?.category).toBe('security');
    expect(finding?.severity).toBe('critical');
    expect(finding?.evidence).toBeDefined();
    // Raw secret must never be exposed!
    expect(finding?.evidence).not.toContain(fakeToken);
    expect(finding?.evidence).toContain('ghp_');
  });

  it('detects Stripe secret keys and redacts raw secrets in evidence', async () => {
    const fakeStripeKey = 'sk_live_' + '51Jz' + 'x'.repeat(24);
    await write('src/lib/stripe.ts', `const stripeSecret = "${fakeStripeKey}";`);

    const findings = await detectSecurityFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'HARDCODED_STRIPE_SECRET');

    expect(finding).toBeDefined();
    expect(finding?.evidence).not.toContain(fakeStripeKey);
    expect(finding?.evidence).toContain('sk_live_');
  });

  it('detects private key blocks safely', async () => {
    await write('src/certs/key.pem', '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----');

    const findings = await detectSecurityFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'HARDCODED_PRIVATE_KEY');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('critical');
    expect(finding?.evidence).toContain('Private key header block');
  });

  it('detects hardcoded database credentials and masks the password', async () => {
    await write(
      'src/db.ts',
      'const url = "postgres://admin_user:super_secret_password_123@db.prod.internal:5432/main";',
    );

    const findings = await detectSecurityFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'HARDCODED_DATABASE_URL_CREDENTIALS');

    expect(finding).toBeDefined();
    expect(finding?.evidence).not.toContain('super_secret_password_123');
    expect(finding?.evidence).toContain('admin_user:***@db.prod.internal:5432/main');
  });

  it('does not flag database URLs in test files or with placeholder credentials', async () => {
    await write(
      'src/__tests__/db.test.ts',
      'const testUrl = "postgres://postgres:postgres@localhost:5432/test";',
    );

    const findings = await detectSecurityFindings(tmpDir);
    expect(findings.find((f) => f.code === 'HARDCODED_DATABASE_URL_CREDENTIALS')).toBeUndefined();
  });

  it('detects suspicious NEXT_PUBLIC_ variables and does not expose secrets', async () => {
    await write('.env', 'NEXT_PUBLIC_DATABASE_PASSWORD=production_secret_value');

    const findings = await detectSecurityFindings(tmpDir);
    const finding = findings.find((f) => f.code === 'NEXT_PUBLIC_LIKELY_SECRET');

    expect(finding).toBeDefined();
    expect(finding?.evidence).toContain('NEXT_PUBLIC_DATABASE_PASSWORD');
    expect(finding?.evidence).not.toContain('production_secret_value');
  });
});
