import path from 'node:path';
import type { Finding, ScanResult } from '@codeeq/core';
import type {
  RepositoryIdentityDto,
  RepositoryScanResponse,
  SanitizedScanDto,
} from './types';

function sanitizePath(p: string | undefined, repoRoot: string): string | undefined {
  if (!p) return undefined;
  let normalized = p;

  // If path is absolute or starts with repoRoot, make it relative
  if (path.isAbsolute(normalized) || normalized.startsWith(repoRoot)) {
    normalized = path.relative(repoRoot, normalized);
  }

  // Normalize all separators to forward slashes
  normalized = normalized.split(path.sep).join('/');
  normalized = normalized.split('\\').join('/');

  // Remove leading './' or '/'
  while (normalized.startsWith('./') || normalized.startsWith('/')) {
    normalized = normalized.replace(/^(\.\/|\/)/, '');
  }

  return normalized;
}

function sanitizeText(text: string | undefined, repoRoot: string): string | undefined {
  if (!text) return undefined;
  let sanitized = text;

  // Replace exact repoRoot and its forward-slash variant
  const forwardRoot = repoRoot.split(path.sep).join('/');
  sanitized = sanitized.split(repoRoot).join('.');
  sanitized = sanitized.split(forwardRoot).join('.');

  return sanitized;
}

function sanitizeFinding(finding: Finding, repoRoot: string): Finding {
  const sanitizedFile = sanitizePath(finding.file, repoRoot);

  return {
    code: finding.code,
    category: finding.category,
    severity: finding.severity,
    confidence: finding.confidence,
    title: finding.title,
    summary: sanitizeText(finding.summary, repoRoot) || finding.summary,
    ...(sanitizedFile ? { file: sanitizedFile } : {}),
    ...(finding.line !== undefined ? { line: finding.line } : {}),
    ...(finding.evidence ? { evidence: sanitizeText(finding.evidence, repoRoot) } : {}),
    whyItMatters: sanitizeText(finding.whyItMatters, repoRoot) || finding.whyItMatters,
    remediation: sanitizeText(finding.remediation, repoRoot) || finding.remediation,
    deploymentImpact: finding.deploymentImpact,
  };
}

export function sanitizeScanResult(
  result: ScanResult,
  repo: RepositoryIdentityDto,
  repoRoot: string
): RepositoryScanResponse {
  const sanitizedFindings = result.findings.map((f) => sanitizeFinding(f, repoRoot));

  const sanitizedApiRoutes = (result.apiRoutes || []).map((route) => {
    return sanitizePath(route, repoRoot) || route;
  });

  const scanDto: SanitizedScanDto = {
    schemaVersion: '1.0',
    projectInfo: result.projectInfo,
    health: result.health,
    healthScore: result.healthScore,
    deploymentReadiness: result.deploymentReadiness,
    findings: sanitizedFindings,
    apiRoutes: sanitizedApiRoutes,
    scannedAt: result.scannedAt,
  };

  return {
    repository: {
      owner: repo.owner,
      name: repo.name,
      url: repo.url,
      defaultBranch: repo.defaultBranch,
    },
    scan: scanDto,
  };
}
