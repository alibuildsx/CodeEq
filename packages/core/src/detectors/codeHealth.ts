import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import type { Finding } from '../types/index.js';
import { collectScannableFiles } from './supabase.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function isTestOrDocFile(relPath: string): boolean {
  const normalized = relPath.split(path.sep).join('/');
  return (
    normalized.includes('__tests__/') ||
    normalized.includes('__mocks__/') ||
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.endsWith('.md') ||
    normalized.endsWith('.txt')
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

const IMPORT_CANDIDATE_SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.mjs',
  '.cjs',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
  '/index.mts',
  '/index.mjs',
  '/index.cjs',
];

const LOCALHOST_REGEX = /\b(https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^\s'"`)]*)?)/gi;
const IMPORT_REGEX = /(?:import\s+(?:[\w*\s{},]*from\s+)?|export\s+(?:[\w*\s{},]*from\s+)?|require\s*\(\s*)['"](\.[^'"]+)['"]/g;
const MARKER_REGEX = /\b(TODO|FIXME|HACK)\b/g;

// ─── Detector ─────────────────────────────────────────────────────────────────

export async function detectCodeHealthFindings(
  targetDir: string,
  options?: {
    files?: string[];
  },
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const allFiles = options?.files ?? (await collectScannableFiles(targetDir));
  const sourceFiles = allFiles.filter((f) => JS_TS_EXTENSIONS.has(path.extname(f)));

  let totalMarkers = 0;
  const markerFiles = new Set<string>();

  for (const filePath of sourceFiles) {
    const relPath = path.relative(targetDir, filePath).split(path.sep).join('/');
    const isTest = isTestOrDocFile(relPath);

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');

    // ── 1. Very large source file (> 600 lines) ──
    if (!isTest && lines.length > 600) {
      findings.push({
        code: 'VERY_LARGE_SOURCE_FILE',
        category: 'code-health',
        severity: 'low',
        confidence: 'medium',
        title: `Large source file detected (${lines.length} lines): ${relPath}`,
        summary: `File exceeds 600 lines of code (${lines.length} lines).`,
        file: relPath,
        evidence: `${lines.length} total lines`,
        whyItMatters:
          'Monolithic source files are harder to maintain, review, test, and refactor. Breaking them into smaller components improves maintainability.',
        remediation: 'Consider splitting this file into smaller, focused modules or sub-components.',
        deploymentImpact: 'none',
      });
    }

    // ── 2. Syntax / Parse errors (safe static parse via TypeScript compiler API) ──
    const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    const parseDiags = (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;
    if (parseDiags && parseDiags.length > 0) {
      // Report first error to avoid cascade
      const diag = parseDiags[0]!;
      const pos = ts.getLineAndCharacterOfPosition(sf, diag.start ?? 0);
      const lineNum = pos.line + 1;
      const message =
        typeof diag.messageText === 'string'
          ? diag.messageText
          : diag.messageText.messageText;

      findings.push({
        code: 'SYNTAX_ERROR',
        category: 'code-health',
        severity: 'high',
        confidence: 'high',
        title: `Syntax error in ${relPath}:${lineNum}`,
        summary: `Parse failure at line ${lineNum}: ${message}`,
        file: relPath,
        line: lineNum,
        evidence: message,
        whyItMatters:
          'Syntax errors prevent compilation, bundling, and type checking, causing immediate deployment and runtime failure.',
        remediation: `Fix the syntax error at ${relPath}:${lineNum}.`,
        deploymentImpact: 'blocking',
      });
    }

    // ── 3. Line-by-line inspection ──
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;
      const trimmed = line.trim();
      const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#');

      // ── Hardcoded localhost URL ──
      if (!isTest && !isComment && !relPath.includes('.config.')) {
        LOCALHOST_REGEX.lastIndex = 0;
        const match = LOCALHOST_REGEX.exec(line);
        if (match) {
          findings.push({
            code: 'HARDCODED_LOCALHOST_URL',
            category: 'code-health',
            severity: 'low',
            confidence: 'medium',
            title: `Hardcoded localhost URL in ${relPath}:${lineNum}`,
            summary: `Found hardcoded localhost address: "${match[1]}"`,
            file: relPath,
            line: lineNum,
            evidence: match[1],
            whyItMatters:
              'Hardcoded localhost URLs will fail in production deployments because the client browser or server cannot connect to localhost in the cloud.',
            remediation: 'Replace hardcoded localhost URLs with environment variables (e.g. process.env.API_URL or NEXT_PUBLIC_API_URL).',
            deploymentImpact: 'none',
          });
        }
      }

      // ── Unresolved local relative imports ──
      IMPORT_REGEX.lastIndex = 0;
      let importMatch: RegExpExecArray | null;
      while ((importMatch = IMPORT_REGEX.exec(line)) !== null) {
        const specifier = importMatch[1]!;
        if (specifier.startsWith('.')) {
          const baseDir = path.dirname(filePath);
          const targetBase = path.resolve(baseDir, specifier);
          let resolved = false;

          for (const suffix of IMPORT_CANDIDATE_SUFFIXES) {
            const candidate = (targetBase + suffix).split('/').join(path.sep);
            if (await fileExists(candidate)) {
              resolved = true;
              break;
            }
          }

          if (!resolved) {
            findings.push({
              code: 'UNRESOLVED_LOCAL_IMPORT',
              category: 'code-health',
              severity: 'high',
              confidence: 'high',
              title: `Unresolved local import in ${relPath}:${lineNum}`,
              summary: `Cannot find module "${specifier}" referenced from ${relPath}.`,
              file: relPath,
              line: lineNum,
              evidence: `Unresolved import: ${specifier}`,
              whyItMatters:
                'Broken relative imports prevent bundlers from completing the build and will crash during build or runtime.',
              remediation: `Verify the relative path "${specifier}" exists or update the import target.`,
              deploymentImpact: 'blocking',
            });
          }
        }
      }

      // ── Unfinished code markers (TODO/FIXME/HACK) ──
      if (!isTest) {
        MARKER_REGEX.lastIndex = 0;
        const matches = trimmed.match(MARKER_REGEX);
        if (matches) {
          totalMarkers += matches.length;
          markerFiles.add(relPath);
        }
      }
    }
  }

  // ── 4. Aggregate Unfinished Code Markers ──
  if (totalMarkers > 0) {
    findings.push({
      code: 'UNFINISHED_CODE_MARKERS',
      category: 'code-health',
      severity: 'low',
      confidence: 'high',
      title: `${totalMarkers} unfinished code marker(s) found`,
      summary: `Found ${totalMarkers} marker(s) (TODO/FIXME/HACK) across ${markerFiles.size} files.`,
      evidence: `${totalMarkers} markers across ${markerFiles.size} files`,
      whyItMatters:
        'Unfinished markers indicate incomplete features, temporary workarounds, or known technical debt that may affect production behavior.',
      remediation: 'Review and resolve pending TODO/FIXME comments before releasing to production.',
      deploymentImpact: 'none',
    });
  }

  return findings;
}
