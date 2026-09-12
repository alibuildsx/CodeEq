import { FrontendScanError } from '../errors';

// GitHub username/org rules: alphanumeric and hyphens, 1-39 chars
const OWNER_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_]{0,38}$/;
// GitHub repository name rules: alphanumeric, hyphens, underscores, dots, 1-100 chars
const REPO_REGEX = /^[a-zA-Z0-9_.-]{1,100}$/;

/**
 * Normalizes user input repository strings (either full HTTPS GitHub URLs or owner/repo shorthand)
 * into a canonical HTTPS GitHub repository URL: `https://github.com/owner/repo`.
 *
 * Enforces strict validation on both formats and rejects invalid shorthand, extra path segments,
 * non-HTTPS protocols, non-GitHub domains, or traversal tokens.
 */
export function normalizeRepositoryInput(rawInput: string): string {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new FrontendScanError('INVALID_GITHUB_URL', 'Please enter a GitHub repository URL', 400);
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new FrontendScanError('INVALID_GITHUB_URL', 'Please enter a GitHub repository URL', 400);
  }

  // Case 1: Full URL (contains protocol or domain scheme)
  if (trimmed.includes('://') || trimmed.startsWith('//') || trimmed.toLowerCase().startsWith('github.com/')) {
    let urlToParse = trimmed;
    if (urlToParse.toLowerCase().startsWith('github.com/')) {
      urlToParse = `https://${urlToParse}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(urlToParse);
    } catch {
      throw new FrontendScanError('INVALID_GITHUB_URL', `Invalid repository URL format: "${trimmed}"`, 400);
    }

    if (parsed.protocol !== 'https:') {
      throw new FrontendScanError('INVALID_GITHUB_URL', 'Only HTTPS GitHub URLs are supported', 400);
    }

    if (parsed.hostname.toLowerCase() !== 'github.com') {
      throw new FrontendScanError('INVALID_GITHUB_URL', 'Only github.com repositories are supported', 400);
    }

    if (parsed.port) {
      throw new FrontendScanError('INVALID_GITHUB_URL', 'Port numbers are not permitted in repository URLs', 400);
    }

    if (parsed.username || parsed.password) {
      throw new FrontendScanError('INVALID_GITHUB_URL', 'Credentials are not permitted in repository URLs', 400);
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length !== 2) {
      throw new FrontendScanError(
        'INVALID_GITHUB_URL',
        `Expected repository URL format https://github.com/owner/repo, received extra segments: "${parsed.pathname}"`,
        400
      );
    }

    const [rawOwner, rawRepo] = segments;
    let repo = rawRepo;
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }

    if (!rawOwner || !repo || rawOwner === '.' || rawOwner === '..' || repo === '.' || repo === '..') {
      throw new FrontendScanError('INVALID_GITHUB_URL', 'Invalid owner or repository path in URL', 400);
    }

    if (!OWNER_REGEX.test(rawOwner)) {
      throw new FrontendScanError('INVALID_GITHUB_URL', `Invalid repository owner name: "${rawOwner}"`, 400);
    }

    if (!REPO_REGEX.test(repo)) {
      throw new FrontendScanError('INVALID_GITHUB_URL', `Invalid repository name: "${repo}"`, 400);
    }

    return `https://github.com/${rawOwner}/${repo}`;
  }

  // Case 2: Shorthand owner/repo format
  // Must not contain query, hash, or backslashes
  if (trimmed.includes('?') || trimmed.includes('#') || trimmed.includes('\\') || trimmed.includes(' ')) {
    throw new FrontendScanError('INVALID_GITHUB_URL', 'Repository shorthand contains invalid characters', 400);
  }

  const parts = trimmed.split('/');
  if (parts.length === 1) {
    throw new FrontendScanError(
      'INVALID_GITHUB_URL',
      'Please enter both owner and repository name (e.g. owner/repo or https://github.com/owner/repo)',
      400
    );
  }

  if (parts.length !== 2) {
    throw new FrontendScanError(
      'INVALID_GITHUB_URL',
      'Extra path segments are not permitted. Use owner/repo or https://github.com/owner/repo',
      400
    );
  }

  const [rawOwner, rawRepo] = parts;
  let repo = rawRepo;
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  if (!rawOwner || !repo || rawOwner === '.' || rawOwner === '..' || repo === '.' || repo === '..') {
    throw new FrontendScanError('INVALID_GITHUB_URL', 'Invalid owner or repository path token', 400);
  }

  if (!OWNER_REGEX.test(rawOwner)) {
    throw new FrontendScanError('INVALID_GITHUB_URL', `Invalid repository owner name: "${rawOwner}"`, 400);
  }

  if (!REPO_REGEX.test(repo)) {
    throw new FrontendScanError('INVALID_GITHUB_URL', `Invalid repository name: "${repo}"`, 400);
  }

  return `https://github.com/${rawOwner}/${repo}`;
}
