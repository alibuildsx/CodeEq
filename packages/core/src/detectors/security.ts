import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Finding } from '../types/index.js';
import { collectScannableFiles, detectSupabase } from './supabase.js';
import { detectEnvSafety } from './envSafety.js';

const execFileAsync = promisify(execFile);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskToken(token: string, prefixLen = 8, suffixLen = 4): string {
  if (token.length <= prefixLen + suffixLen) {
    return token.slice(0, 4) + '...';
  }
  return token.slice(0, prefixLen) + '...' + token.slice(-suffixLen);
}

function isTestOrDocFile(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join('/');
  return (
    normalized.includes('__tests__/') ||
    normalized.includes('__mocks__/') ||
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('/test-fixtures/') ||
    normalized.includes('/fixtures/') ||
    normalized.startsWith('fixtures/') ||
    normalized.includes('/docs/') ||
    normalized.startsWith('docs/') ||
    normalized.includes('/examples/') ||
    normalized.startsWith('examples/') ||
    normalized.endsWith('.md') ||
    normalized.endsWith('.txt')
  );
}


// ─── Secret Patterns ──────────────────────────────────────────────────────────

const GITHUB_TOKEN_REGEX = /\b(ghp_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g;
const STRIPE_SECRET_REGEX = /\b((?:sk_live_|rk_live_)[0-9a-zA-Z]{24,})\b/g;
const PRIVATE_KEY_HEADER = /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/;
const DB_URL_REGEX = /\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/)([^:\/\s'"`]+):([^@\/\s'"`]+)@([^\s'"`]+)/gi;
const JWT_SECRET_REGEX = /(?:jwt_secret|jwt_token_secret|jwt_private_key)\s*[:=]\s*['"`]([A-Za-z0-9_\-+/=]{16,})['"`]/gi;

const COMMON_PLACEHOLDER_CREDENTIALS = new Set([
  'postgres:postgres',
  'user:password',
  'username:password',
  'root:root',
  'admin:admin',
  'test:test',
  'localhost',
]);

// ─── Git Tracking Check ───────────────────────────────────────────────────────

async function checkTrackedEnvFiles(targetDir: string): Promise<string[]> {
  try {
    await fs.access(path.join(targetDir, '.git'));
    const { stdout } = await execFileAsync('git', ['ls-files', '.env*'], {
      cwd: targetDir,
      timeout: 3000,
    });
    return stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.endsWith('.example'));
  } catch {
    return [];
  }
}

// ─── Detector ─────────────────────────────────────────────────────────────────

export async function detectSecurityFindings(
  targetDir: string,
  options?: {
    files?: string[];
    deps?: Record<string, string>;
  },
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const files = options?.files ?? (await collectScannableFiles(targetDir));
  const deps = options?.deps ?? {};

  // ── 1. Environment files safety ──
  const envFiles = [
    { name: '.env', code: 'ENV_NOT_GITIGNORED', title: '.env is not listed in .gitignore' },
    { name: '.env.local', code: 'ENV_LOCAL_NOT_GITIGNORED', title: '.env.local is not listed in .gitignore' },
    { name: '.env.production', code: 'ENV_PRODUCTION_NOT_GITIGNORED', title: '.env.production is not listed in .gitignore' },
  ];

  let gitignorePatterns: string[] = [];
  try {
    const raw = await fs.readFile(path.join(targetDir, '.gitignore'), 'utf-8');
    gitignorePatterns = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
  } catch {
    // No .gitignore file
  }

  function isIgnored(filename: string): boolean {
    return gitignorePatterns.some((pattern) => {
      const p = pattern.startsWith('/') ? pattern.slice(1) : pattern;
      const normalized = p.endsWith('/') ? p.slice(0, -1) : p;
      if (normalized === filename) return true;
      if (normalized === '.env*' && filename.startsWith('.env')) return true;
      if (normalized === '.env*.local' && filename.startsWith('.env') && filename.endsWith('.local')) return true;
      return false;
    });
  }

  for (const envFile of envFiles) {
    try {
      await fs.access(path.join(targetDir, envFile.name));
      if (!isIgnored(envFile.name)) {
        findings.push({
          code: envFile.code,
          category: 'security',
          severity: 'critical',
          confidence: 'high',
          title: envFile.title,
          summary: `${envFile.name} file is present but not ignored in .gitignore.`,
          file: '.gitignore',
          evidence: `${envFile.name} present in project root but missing from .gitignore patterns`,
          whyItMatters:
            `${envFile.name} commonly contains credentials and private secrets; committing it exposes them to version control.`,
          remediation:
            `Add "${envFile.name}" to .gitignore immediately and rotate any secrets that were previously committed.`,
          deploymentImpact: 'risk',
        });
      }
    } catch {
      // File does not exist
    }
  }

  // ── 2. Tracked env files in git ──
  const trackedEnvFiles = await checkTrackedEnvFiles(targetDir);
  for (const trackedFile of trackedEnvFiles) {
    const normalizedFile = trackedFile.split(path.sep).join('/');
    findings.push({
      code: 'ENV_FILE_TRACKED',
      category: 'security',
      severity: 'critical',
      confidence: 'high',
      title: `Environment file is tracked in Git repository: ${normalizedFile}`,
      summary: `"${normalizedFile}" appears to be committed or tracked in source control.`,
      file: normalizedFile,
      evidence: `Git tracking confirmed: ${normalizedFile}`,
      whyItMatters:
        'Committed environment files are permanently recorded in git history, accessible to anyone with repository access.',
      remediation:
        `Remove "${normalizedFile}" from git with "git rm --cached ${normalizedFile}", add it to .gitignore, and rotate secrets.`,
      deploymentImpact: 'risk',
    });
  }


  // ── 3. Supabase service role leak ──
  const supabaseResult = await detectSupabase(targetDir, deps);
  if (supabaseResult.serviceRoleLeaked) {
    findings.push({
      code: 'SUPABASE_SERVICE_ROLE_LEAKED',
      category: 'security',
      severity: 'critical',
      confidence: 'high',
      title: 'Supabase service_role key reference found in source files',
      summary: `Found "service_role" in: ${supabaseResult.leakFoundIn ?? 'unknown file'}.`,
      file: supabaseResult.leakFoundIn,
      evidence: 'Found reference to service_role assignment in source files',
      whyItMatters:
        'The service role key bypasses Row Level Security — never expose it client-side or commit it to source control.',
      remediation:
        'Remove the service role key from source code and restrict it to secure server-side environments.',
      deploymentImpact: 'risk',
    });
  }

  // ── 4. Suspicious NEXT_PUBLIC_ variables ──
  const envSafety = await detectEnvSafety(targetDir, {
    hasEnv: true,
    hasEnvLocal: true,
  });
  for (const varName of envSafety.suspiciousNextPublicVars) {
    findings.push({
      code: 'NEXT_PUBLIC_LIKELY_SECRET',
      category: 'security',
      severity: 'high',
      confidence: 'high',
      title: `NEXT_PUBLIC_ variable looks like a private secret: ${varName}`,
      summary: `"${varName}" is prefixed with NEXT_PUBLIC_ which exposes it to the browser bundle.`,
      file: '.env',
      evidence: `Variable name: ${varName}`,
      whyItMatters:
        'Variables prefixed with NEXT_PUBLIC_ are bundled into client-side JavaScript, exposing them to any visitor.',
      remediation:
        'Remove the NEXT_PUBLIC_ prefix and access this credential only from server-side code.',
      deploymentImpact: 'risk',
    });
  }

  // ── 5. File contents scan for hardcoded tokens & keys ──
  for (const filePath of files) {
    const relPath = path.relative(targetDir, filePath).split(path.sep).join('/');
    const isTest = isTestOrDocFile(relPath);

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      // Skip lines in tests or comments if they are not private keys
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
        continue;
      }

      // ── GitHub Token ──
      GITHUB_TOKEN_REGEX.lastIndex = 0;
      const ghMatch = GITHUB_TOKEN_REGEX.exec(line);
      if (ghMatch) {
        const rawToken = ghMatch[1]!;
        findings.push({
          code: 'HARDCODED_GITHUB_TOKEN',
          category: 'security',
          severity: 'critical',
          confidence: 'high',
          title: 'Hardcoded GitHub Personal Access Token detected',
          summary: 'A hardcoded GitHub personal access token was discovered in source code.',
          file: relPath,
          line: lineNum,
          evidence: `Token detected: ${maskToken(rawToken, 8, 4)}`,
          whyItMatters:
            'Committed GitHub tokens allow attackers to access private repositories, push unauthorized commits, or alter infrastructure.',
          remediation:
            'Revoke this token immediately in GitHub settings and load credentials from environment variables.',
          deploymentImpact: 'risk',
        });
      }

      // ── Stripe Secret ──
      STRIPE_SECRET_REGEX.lastIndex = 0;
      const stripeMatch = STRIPE_SECRET_REGEX.exec(line);
      if (stripeMatch) {
        const rawKey = stripeMatch[1]!;
        findings.push({
          code: 'HARDCODED_STRIPE_SECRET',
          category: 'security',
          severity: 'critical',
          confidence: 'high',
          title: 'Hardcoded Stripe live secret key detected',
          summary: 'A hardcoded Stripe live secret/restricted key was found in source code.',
          file: relPath,
          line: lineNum,
          evidence: `Key detected: ${maskToken(rawKey, 8, 4)}`,
          whyItMatters:
            'Stripe live secret keys allow full access to charge customers, refund payments, and read financial transaction data.',
          remediation:
            'Roll this API key in the Stripe dashboard immediately and migrate the key to secure server-side environment variables.',
          deploymentImpact: 'risk',
        });
      }

      // ── Private Key Block ──
      if (PRIVATE_KEY_HEADER.test(line)) {
        findings.push({
          code: 'HARDCODED_PRIVATE_KEY',
          category: 'security',
          severity: 'critical',
          confidence: 'high',
          title: 'Hardcoded private key block detected',
          summary: 'A PEM private key header block was found in the repository.',
          file: relPath,
          line: lineNum,
          evidence: 'Private key header block detected in source file',
          whyItMatters:
            'Private keys grant cryptographic authentication for SSH, TLS, or JWT signing. They should never be committed.',
          remediation:
            'Remove the private key, regenerate certificates or keypairs, and inject keys via secure secrets management.',
          deploymentImpact: 'risk',
        });
      }

      // ── Database connection URL with credentials (skip tests & examples) ──
      if (!isTest && !relPath.endsWith('.example')) {
        DB_URL_REGEX.lastIndex = 0;
        const dbMatch = DB_URL_REGEX.exec(line);
        if (dbMatch) {
          const [, proto, user, pass, host] = dbMatch;
          const userPass = `${user}:${pass}`;
          if (!COMMON_PLACEHOLDER_CREDENTIALS.has(userPass) && !host!.startsWith('localhost')) {
            findings.push({
              code: 'HARDCODED_DATABASE_URL_CREDENTIALS',
              category: 'security',
              severity: 'critical',
              confidence: 'high',
              title: 'Hardcoded database connection credentials found',
              summary: 'A database connection string with embedded username and password was detected.',
              file: relPath,
              line: lineNum,
              evidence: `Database URL detected: ${proto}${user}:***@${host}`,
              whyItMatters:
                'Hardcoded database credentials allow anyone with code access to connect directly to the database.',
              remediation:
                'Move DATABASE_URL to a server environment variable and rotate the exposed password.',
              deploymentImpact: 'risk',
            });
          }
        }
      }

      // ── JWT Secret Assignment ──
      if (!isTest) {
        JWT_SECRET_REGEX.lastIndex = 0;
        const jwtMatch = JWT_SECRET_REGEX.exec(line);
        if (jwtMatch) {
          const rawSecret = jwtMatch[1]!;
          findings.push({
            code: 'HARDCODED_JWT_SECRET',
            category: 'security',
            severity: 'high',
            confidence: 'high',
            title: 'Hardcoded JWT secret detected',
            summary: 'A hardcoded JWT signing secret was found assigned in source code.',
            file: relPath,
            line: lineNum,
            evidence: `JWT secret: ${maskToken(rawSecret, 6, 4)}`,
            whyItMatters:
              'A leaked JWT secret enables attackers to forge authentication tokens and impersonate any user.',
            remediation:
              'Store JWT secrets in secure server-only environment variables and rotate the existing secret.',
            deploymentImpact: 'risk',
          });
        }
      }
    }
  }

  return findings;
}
