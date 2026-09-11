import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from '../../scanners/projectScanner.js';
import { generateMarkdownReport } from '../../reports/markdownReport.js';

describe('Comprehensive Secret Redaction and Non-Leakage', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-secret-leak-test-'));
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'secret-test', scripts: { build: 'tsc' } }),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  it('never leaks raw credentials in findings, JSON, or Markdown across all supported secret types', async () => {
    const fakeGithubPat = 'ghp_TESTSECRETGITHUBPAT1234567890ABCDEFGH';
    const fakeGithubFineGrained = 'github_pat_TESTSECRETFINEGRAINED1234567890';
    const fakeStripeKey = 'sk_live_TESTSECRETSTRIPELIVEKEY1234567890';
    const fakeDbPassword = 'super_secret_db_password_xyz999';
    const fakeJwtSecret = 'super_secret_jwt_signing_key_abc_12345';
    const fakeNextPublicSecret = 'production_database_password_98765';

    await write('.gitignore', 'node_modules\n');
    await write(
      '.env',
      `NEXT_PUBLIC_DATABASE_PASSWORD=${fakeNextPublicSecret}\nPORT=3000\n`,
    );
    await write(
      'src/tokens.ts',
      `export const gh = "${fakeGithubPat}";\nexport const ghFg = "${fakeGithubFineGrained}";\nexport const stripe = "${fakeStripeKey}";\n`,
    );
    await write(
      'src/db.ts',
      `export const dbUrl = "postgres://admin:${fakeDbPassword}@db.prod.example.com:5432/app";\n`,
    );
    await write(
      'src/auth.ts',
      `export const config = { jwt_secret: "${fakeJwtSecret}" };\n`,
    );
    await write(
      'src/certs/server.pem',
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0fakePrivateKeyBytesThatShouldNeverBeExposed...\n-----END RSA PRIVATE KEY-----\n',
    );

    const result = await scanProject(tmpDir);
    const jsonStr = JSON.stringify(result);
    const markdown = generateMarkdownReport(result);

    const secrets = [
      fakeGithubPat,
      fakeGithubFineGrained,
      fakeStripeKey,
      fakeDbPassword,
      fakeJwtSecret,
      fakeNextPublicSecret,
      '0fakePrivateKeyBytesThatShouldNeverBeExposed',
    ];

    for (const secret of secrets) {
      // Must not appear in JSON output
      expect(jsonStr).not.toContain(secret);

      // Must not appear in Markdown report
      expect(markdown).not.toContain(secret);

      // Must not appear in any individual finding field
      for (const finding of result.findings) {
        expect(finding.summary).not.toContain(secret);
        expect(finding.whyItMatters).not.toContain(secret);
        expect(finding.remediation).not.toContain(secret);
        if (finding.evidence) {
          expect(finding.evidence).not.toContain(secret);
        }
      }
    }

    // Verify appropriate findings were detected
    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('HARDCODED_GITHUB_TOKEN');
    expect(codes).toContain('HARDCODED_STRIPE_SECRET');
    expect(codes).toContain('HARDCODED_DATABASE_URL_CREDENTIALS');
    expect(codes).toContain('HARDCODED_JWT_SECRET');
    expect(codes).toContain('HARDCODED_PRIVATE_KEY');
    expect(codes).toContain('NEXT_PUBLIC_LIKELY_SECRET');
  });
});
