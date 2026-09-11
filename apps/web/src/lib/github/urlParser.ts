import { InvalidGitHubUrlError } from '../errors';
import type { GitHubRepoIdentity } from './types';

// GitHub username/org rules: alphanumeric and hyphens (up to 39 chars)
const OWNER_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_]{0,38}$/;
// GitHub repository name rules: alphanumeric, hyphens, underscores, and dots (up to 100 chars)
const REPO_REGEX = /^[a-zA-Z0-9_.-]{1,100}$/;

export function parseGitHubRepoUrl(rawUrl: string): GitHubRepoIdentity {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new InvalidGitHubUrlError('Repository URL must be a non-empty string');
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new InvalidGitHubUrlError('Repository URL cannot be blank');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidGitHubUrlError(`Invalid URL format: "${trimmed}"`);
  }

  // Enforce HTTPS only
  if (parsed.protocol !== 'https:') {
    throw new InvalidGitHubUrlError(`Only HTTPS GitHub URLs are allowed. Received: "${parsed.protocol}"`);
  }

  // Enforce exact github.com hostname (no subdomains, no lookalikes, no IP addresses)
  if (parsed.hostname.toLowerCase() !== 'github.com') {
    throw new InvalidGitHubUrlError(`Only github.com is supported. Received host: "${parsed.hostname}"`);
  }

  // Enforce no port specification or credentials
  if (parsed.port) {
    throw new InvalidGitHubUrlError('Port numbers are not permitted in GitHub repository URLs');
  }
  if (parsed.username || parsed.password) {
    throw new InvalidGitHubUrlError('Credentials are not permitted in GitHub repository URLs');
  }

  // Path segments: split by '/' and filter out empty segments
  // e.g. /vercel/next.js/ -> ['vercel', 'next.js']
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (segments.length !== 2) {
    throw new InvalidGitHubUrlError(
      `Expected a repository URL format https://github.com/:owner/:repo, received: "${parsed.pathname}"`
    );
  }

  const [rawOwner, rawRepo] = segments;

  // Clean .git suffix from repository if present
  let repo = rawRepo;
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  const owner = rawOwner;

  if (!owner || !repo) {
    throw new InvalidGitHubUrlError('Owner and repository name must both be non-empty');
  }

  // Reject path traversal tokens
  if (owner === '.' || owner === '..' || repo === '.' || repo === '..') {
    throw new InvalidGitHubUrlError('Invalid owner or repository path token');
  }

  // Validate syntax
  if (!OWNER_REGEX.test(owner)) {
    throw new InvalidGitHubUrlError(`Invalid repository owner name: "${owner}"`);
  }

  if (!REPO_REGEX.test(repo)) {
    throw new InvalidGitHubUrlError(`Invalid repository name: "${repo}"`);
  }

  return {
    owner,
    repo,
  };
}
