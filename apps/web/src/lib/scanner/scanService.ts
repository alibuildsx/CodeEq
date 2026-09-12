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
  const controller = new AbortController();

  // Execute the entire acquisition and scan under one cooperative cancellation signal.
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new ScanTimeoutError(
        `Repository scan timed out after ${scanTimeoutMs}ms`,
      );
      controller.abort(timeoutError);
      reject(timeoutError);
    }, scanTimeoutMs);
  });

  const scanPromise = (async () => {
    // 3. Fetch metadata & verify accessibility
    const metadata = await client.fetchRepoMetadata(identity, {
      token: options?.token,
      signal: controller.signal,
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
          signal: controller.signal,
        }
      );

      // Extract archive safely
      const extraction = await extractTarSafely(
        workspace.archivePath,
        workspace.extractDir,
        {
          maxBytes: options?.maxExtractedBytes,
          maxFiles: options?.maxExtractedFiles,
          signal: controller.signal,
        }
      );

      // Run static analysis with @codeeq/core (NEVER executes repository code)
      let rawResult;
      try {
        rawResult = await scanProject(extraction.repoRoot, {
          filesAreTracked: true,
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (controller.signal.aborted && controller.signal.reason instanceof Error) {
          throw controller.signal.reason;
        }
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
  } catch (error) {
    if (controller.signal.aborted) {
      // Wait for the losing task to acknowledge cancellation and run workspace cleanup.
      await scanPromise.catch(() => undefined);
      if (controller.signal.reason instanceof Error) throw controller.signal.reason;
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
