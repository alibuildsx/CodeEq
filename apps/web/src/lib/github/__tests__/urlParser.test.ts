import { describe, expect, it } from 'vitest';
import { parseGitHubRepoUrl } from '../urlParser';

describe('GitHub Repository URL Parser', () => {
  it('parses standard https github URLs', () => {
    const parsed = parseGitHubRepoUrl('https://github.com/vercel/next.js');
    expect(parsed).toEqual({ owner: 'vercel', repo: 'next.js' });
  });

  it('handles trailing slash', () => {
    const parsed = parseGitHubRepoUrl('https://github.com/vercel/next.js/');
    expect(parsed).toEqual({ owner: 'vercel', repo: 'next.js' });
  });

  it('handles .git suffix', () => {
    const parsed = parseGitHubRepoUrl('https://github.com/vercel/next.js.git');
    expect(parsed).toEqual({ owner: 'vercel', repo: 'next.js' });
  });

  it('handles .git suffix with trailing slash', () => {
    const parsed = parseGitHubRepoUrl('https://github.com/vercel/next.js.git/');
    expect(parsed).toEqual({ owner: 'vercel', repo: 'next.js' });
  });

  it('handles uppercase and mixed case names', () => {
    const parsed = parseGitHubRepoUrl('https://github.com/alibuildsx/CodeEq');
    expect(parsed).toEqual({ owner: 'alibuildsx', repo: 'CodeEq' });
  });

  it('handles repositories with dots, underscores, and hyphens', () => {
    const parsed = parseGitHubRepoUrl('https://github.com/my-org/my_repo.sub');
    expect(parsed).toEqual({ owner: 'my-org', repo: 'my_repo.sub' });
  });

  // ─── Rejection Cases ────────────────────────────────────────────────────────

  it('rejects non-HTTPS protocols (http, git, ssh)', () => {
    expect(() => parseGitHubRepoUrl('http://github.com/vercel/next.js')).toThrow();
    expect(() => parseGitHubRepoUrl('git://github.com/vercel/next.js')).toThrow();
    expect(() => parseGitHubRepoUrl('ssh://git@github.com/vercel/next.js')).toThrow();
    expect(() => parseGitHubRepoUrl('git@github.com:vercel/next.js.git')).toThrow();
  });

  it('rejects non-github.com hosts', () => {
    expect(() => parseGitHubRepoUrl('https://gitlab.com/vercel/next.js')).toThrow();
    expect(() => parseGitHubRepoUrl('https://bitbucket.org/vercel/next.js')).toThrow();
    expect(() => parseGitHubRepoUrl('https://example.com/vercel/next.js')).toThrow();
  });

  it('rejects lookalike and attacker domains', () => {
    expect(() => parseGitHubRepoUrl('https://github.com.attacker.com/vercel/next.js')).toThrow();
    expect(() => parseGitHubRepoUrl('https://notgithub.com/vercel/next.js')).toThrow();
    expect(() => parseGitHubRepoUrl('https://fake-github.com/vercel/next.js')).toThrow();
  });

  it('rejects IP addresses and localhost', () => {
    expect(() => parseGitHubRepoUrl('https://127.0.0.1/vercel/next.js')).toThrow();
    expect(() => parseGitHubRepoUrl('https://localhost/vercel/next.js')).toThrow();
    expect(() => parseGitHubRepoUrl('https://169.254.169.254/vercel/next.js')).toThrow();
  });

  it('rejects URLs missing owner or repo', () => {
    expect(() => parseGitHubRepoUrl('https://github.com')).toThrow();
    expect(() => parseGitHubRepoUrl('https://github.com/')).toThrow();
    expect(() => parseGitHubRepoUrl('https://github.com/vercel')).toThrow();
    expect(() => parseGitHubRepoUrl('https://github.com/vercel/')).toThrow();
  });

  it('rejects URLs with extra subpath navigation (tree, issues, blob)', () => {
    expect(() => parseGitHubRepoUrl('https://github.com/vercel/next.js/tree/canary')).toThrow();
    expect(() => parseGitHubRepoUrl('https://github.com/vercel/next.js/blob/main/README.md')).toThrow();
    expect(() => parseGitHubRepoUrl('https://github.com/vercel/next.js/issues/123')).toThrow();
    expect(() => parseGitHubRepoUrl('https://github.com/vercel/next.js/pull/456')).toThrow();
  });

  it('rejects URLs with path traversal attempts or illegal characters', () => {
    expect(() => parseGitHubRepoUrl('https://github.com/vercel/../other')).toThrow();
    expect(() => parseGitHubRepoUrl('https://github.com/ver cel/next.js')).toThrow();
    expect(() => parseGitHubRepoUrl('https://github.com/vercel/next<script>')).toThrow();
  });

  it('rejects non-string and empty inputs', () => {
    expect(() => parseGitHubRepoUrl('')).toThrow();
    expect(() => parseGitHubRepoUrl('   ')).toThrow();
    expect(() => parseGitHubRepoUrl(null as unknown as string)).toThrow();
    expect(() => parseGitHubRepoUrl(undefined as unknown as string)).toThrow();
  });
});
