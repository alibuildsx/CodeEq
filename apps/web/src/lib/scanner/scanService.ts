import { scanProject } from '@codeeq/core';
import { extractTarSafely } from '../archive/extract';
import { ARCHIVE_LIMITS } from '../archive/limits';
import { ScanError, ScanTimeoutError } from '../errors';
import { GitHubClient } from '../github/githubClient';
import { parseGitHubRepoUrl } from '../github/urlParser';
import { withTempWorkspace } from '../utils/tempWorkspace';
import { sanitizeScanResult } from './sanitizer';
import type { RepositoryScanResponse } from './types';

export interface ScanGithubOptions {
  token?: string;
  maxArchiveBytes?: number;
  maxExtractedBytes?: number;
  maxExtractedFiles?: number;
  downloadTimeoutMs?: number;
  scanTimeoutMs?: number;
  githubClient?: GitHubClient;
}

export async function scanGithubRepository(
  repoUrl: string,
  options?: ScanGithubOptions
): Promise<RepositoryScanResponse> {
  const scanTimeoutMs = options?.scanTimeoutMs ?? ARCHIVE_LIMITS.SCAN_TIMEOUT_MS;

  // 1. Validate & normalize URL
  const identity = parseGitHubRepoUrl(repoUrl);

  // 2. Initialize GitHub client
  const client = options?.githubClient ?? new GitHubClient(options?.token);

  // Execute entire acquisition and scan with timeout guarantee
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ScanTimeoutError(`Repository scan timed out after ${scanTimeoutMs}ms`));
    }, scanTimeoutMs);
  });

  const scanPromise = (async () => {
    // 3. Fetch metadata & verify accessibility
    const metadata = await client.fetchRepoMetadata(identity, {
      token: options?.token,
    });

    const canonicalUrl = `https://github.com/${identity.owner}/${identity.repo}`;

    // 4. Download, extract, and scan in isolated temporary workspace
    return await withTempWorkspace(async (workspace) => {
      // Download repository archive
      await client.downloadRepoArchive(
        identity,
        metadata.defaultBranch,
        workspace.archivePath,
        {
          token: options?.token,
          maxBytes: options?.maxArchiveBytes,
          timeoutMs: options?.downloadTimeoutMs,
        }
      );

      // Extract archive safely
      const extraction = await extractTarSafely(
        workspace.archivePath,
        workspace.extractDir,
        {
          maxBytes: options?.maxExtractedBytes,
          maxFiles: options?.maxExtractedFiles,
        }
      );

      // Run static analysis with @codeeq/core (NEVER executes repository code)
      let rawResult;
      try {
        rawResult = await scanProject(extraction.repoRoot);
      } catch (err: unknown) {
        throw new ScanError(
          'SCAN_FAILED',
          `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
          500
        );
      }

      // Sanitize scan result for public web consumption
      return sanitizeScanResult(
        rawResult,
        {
          owner: identity.owner,
          name: metadata.name,
          url: canonicalUrl,
          defaultBranch: metadata.defaultBranch,
        },
        extraction.repoRoot
      );
    });
  })();

  try {
    return await Promise.race([scanPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
