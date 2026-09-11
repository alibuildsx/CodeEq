import fs from 'node:fs/promises';
import path from 'node:path';
import type { Finding } from '../types/index.js';
import { readPackageJson, mergeDependencies } from './packageJson.js';
import { collectScannableFiles } from './supabase.js';

function isTestOrDocFile(relPath: string): boolean {
  const normalized = relPath.split(path.sep).join('/');
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
    normalized.includes('.sample.') ||
    normalized.endsWith('.sample') ||
    normalized.endsWith('.md') ||
    normalized.endsWith('.txt') ||
    normalized.endsWith('.example')
  );
}


const JS_TS_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.mjs',
  '.cjs',
]);

const PLACEHOLDER_PATTERNS = [
  /\b(YOUR_API_KEY|YOUR_SECRET_KEY|YOUR_TOKEN|replace-me|REPLACE_WITH_YOUR_[\w]+)\b/i,
  /\b(test@example\.com|user@example\.com)\b/i,
  /\bplaceholder_(?:key|value|token|secret)\b/i,
];

// ─── Detector ─────────────────────────────────────────────────────────────────

export async function detectVibeCodeFindings(
  targetDir: string,
  options?: {
    files?: string[];
  },
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const pkg = await readPackageJson(targetDir);
  const deps = pkg ? mergeDependencies(pkg) : {};
  const depNames = Object.keys(deps);

  // ── 1. Duplicate Auth Providers ──
  const authGroups: string[] = [];
  const matchingPackages: string[] = [];

  const clerkPackages = depNames.filter((d) => d.startsWith('@clerk/'));
  if (clerkPackages.length > 0) {
    authGroups.push('Clerk');
    matchingPackages.push(...clerkPackages);
  }

  const nextAuthPackages = depNames.filter((d) => d === 'next-auth' || d.startsWith('@auth/'));
  if (nextAuthPackages.length > 0) {
    authGroups.push('NextAuth / Auth.js');
    matchingPackages.push(...nextAuthPackages);
  }

  const supabaseAuthPackages = depNames.filter(
    (d) =>
      d === '@supabase/auth-helpers-nextjs' ||
      d === '@supabase/auth-helpers-react' ||
      d === '@supabase/ssr',
  );
  if (supabaseAuthPackages.length > 0) {
    authGroups.push('Supabase Auth');
    matchingPackages.push(...supabaseAuthPackages);
  }

  const firebaseAuthPackages = depNames.filter((d) => d === '@firebase/auth');
  if (firebaseAuthPackages.length > 0) {
    authGroups.push('Firebase Auth');
    matchingPackages.push(...firebaseAuthPackages);
  }

  if (authGroups.length >= 2) {
    findings.push({
      code: 'DUPLICATE_AUTH_PROVIDERS',
      category: 'code-health',
      severity: 'medium',
      confidence: 'medium',
      title: 'Possible duplicate authentication providers detected',
      summary: `Project includes dependencies for multiple authentication frameworks: ${authGroups.join(' and ')}.`,
      file: 'package.json',
      evidence: `Conflicting auth packages: ${matchingPackages.join(', ')}`,
      whyItMatters:
        'Vibe-coded repositories frequently accumulate multiple competing auth solutions when trying different tutorials or templates, leading to conflicting session state and redundant bundle bloat.',
      remediation: 'Consolidate authentication onto a single provider and uninstall unused auth packages.',
      deploymentImpact: 'risk',
    });
  }

  // ── Source files analysis ──
  const allFiles = options?.files ?? (await collectScannableFiles(targetDir));
  const sourceFiles = allFiles.filter((f) => JS_TS_EXTENSIONS.has(path.extname(f)));

  const supabaseClientFiles = new Set<string>();
  const apiClientFiles = new Set<string>();

  for (const filePath of sourceFiles) {
    const relPath = path.relative(targetDir, filePath).split(path.sep).join('/');
    if (isTestOrDocFile(relPath)) continue;

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    // ── 2. Multiple Supabase Clients ──
    if (
      content.includes('createClient(') ||
      content.includes('createBrowserClient(') ||
      content.includes('createServerClient(')
    ) {
      if (
        content.includes('@supabase/supabase-js') ||
        content.includes('@supabase/ssr') ||
        content.includes('@supabase/auth-helpers-nextjs')
      ) {
        supabaseClientFiles.add(relPath);
      }
    }

    // ── 3. Multiple API / Axios Clients ──
    if (content.includes('axios.create(') || content.includes('createApiClient(')) {
      apiClientFiles.add(relPath);
    }

    // ── 4. Placeholder / Mock Values (only in string literals) ──
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
        continue;
      }

      const stringLiteralRegex = /['"`]([^'"`\r\n]{3,})['"`]/g;
      let strMatch: RegExpExecArray | null;
      let foundOnLine = false;


      while (!foundOnLine && (strMatch = stringLiteralRegex.exec(line)) !== null) {
        const stringVal = strMatch[1]!;
        for (const pattern of PLACEHOLDER_PATTERNS) {
          const match = pattern.exec(stringVal);
          if (match) {
            findings.push({
              code: 'PLACEHOLDER_VALUE_LEFTOVER',
              category: 'code-health',
              severity: 'low',
              confidence: 'medium',
              title: `Placeholder or mock value found in source: "${match[1]}"`,
              summary: `File ${relPath}:${lineNum} contains template placeholder value "${match[1]}".`,
              file: relPath,
              line: lineNum,
              evidence: match[1],
              whyItMatters:
                'Template placeholder strings left in production code can lead to broken third-party integrations or invalid dummy communications.',
              remediation: 'Replace placeholder values with real configurations or environment variables.',
              deploymentImpact: 'none',
            });
            foundOnLine = true;
            break;
          }
        }
      }
    }
  }


  // Aggregate Multiple Supabase Clients
  if (supabaseClientFiles.size >= 2) {
    const fileList = [...supabaseClientFiles];
    findings.push({
      code: 'MULTIPLE_SUPABASE_CLIENTS',
      category: 'code-health',
      severity: 'low',
      confidence: 'medium',
      title: 'Multiple separate Supabase client instances detected',
      summary: `Found ${fileList.length} files initializing Supabase clients: ${fileList.join(', ')}.`,
      file: fileList[0],
      evidence: `Client instances created in: ${fileList.join(', ')}`,
      whyItMatters:
        'Initializing multiple separate Supabase clients can cause connection connection thrashing, inconsistent auth state, and duplicate session caches.',
      remediation: 'Centralize Supabase client initialization in a single shared module or context.',
      deploymentImpact: 'risk',
    });
  }

  // Aggregate Multiple API Clients
  if (apiClientFiles.size >= 2) {
    const fileList = [...apiClientFiles];
    findings.push({
      code: 'MULTIPLE_API_CLIENTS',
      category: 'code-health',
      severity: 'low',
      confidence: 'low',
      title: 'Multiple custom API client instances detected',
      summary: `Found ${fileList.length} files creating separate API client instances: ${fileList.join(', ')}.`,
      file: fileList[0],
      evidence: `API clients created in: ${fileList.join(', ')}`,
      whyItMatters:
        'Multiple HTTP/API client instances often lead to inconsistent request interceptors, mismatched timeout settings, and uncoordinated authentication headers.',
      remediation: 'Consolidate API requests onto a single configured client abstraction.',
      deploymentImpact: 'none',
    });
  }

  return findings;
}
