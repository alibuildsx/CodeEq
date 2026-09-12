import fs from 'node:fs';
import path from 'node:path';
import * as tar from 'tar';
import { ArchiveDownloadFailedError, RepositoryTooLargeError, ScanError } from '../errors';
import { ARCHIVE_LIMITS } from './limits';

export interface ExtractResult {
  repoRoot: string;
  fileCount: number;
  totalBytes: number;
}

export interface ExtractOptions {
  maxBytes?: number;
  maxFiles?: number;
  signal?: AbortSignal;
}

export async function extractTarSafely(
  tarPath: string,
  destDir: string,
  options?: ExtractOptions
): Promise<ExtractResult> {
  options?.signal?.throwIfAborted();
  const maxBytes = options?.maxBytes ?? ARCHIVE_LIMITS.MAX_EXTRACTED_BYTES;
  const maxFiles = options?.maxFiles ?? ARCHIVE_LIMITS.MAX_EXTRACTED_FILES;

  const normalizedDest = path.resolve(destDir);
  if (!fs.existsSync(normalizedDest)) {
    fs.mkdirSync(normalizedDest, { recursive: true });
  }

  let validationError: ScanError | null = null;
  let fileCount = 0;
  let totalBytes = 0;
  const cleanupDestination = () => {
    try {
      fs.rmSync(normalizedDest, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; the enclosing workspace also has a finalizer.
    }
  };

  try {
    await tar.x({
      file: tarPath,
      cwd: normalizedDest,
      filter: (entryPath, entry) => {
        options?.signal?.throwIfAborted();
        // If an error has already been found, skip remaining entries without writing
        if (validationError) {
          return false;
        }

        // 1. Disallow null bytes or invalid paths
        if (entryPath.includes('\0')) {
          validationError = new ArchiveDownloadFailedError(
            `Archive entry contains null byte: "${entryPath}"`
          );
          return false;
        }

        // 2. Reject symlinks, hardlinks, devices, FIFOs
        const rawType = 'type' in entry ? String((entry as { type?: unknown }).type) : '';
        const isSymlink =
          rawType === 'SymbolicLink' ||
          rawType === '2' ||
          ('isSymbolicLink' in entry && typeof (entry as { isSymbolicLink?: () => boolean }).isSymbolicLink === 'function' && (entry as { isSymbolicLink: () => boolean }).isSymbolicLink());
        const isLink = rawType === 'Link' || rawType === '1';
        const isDeviceOrFifo =
          rawType === 'CharacterDevice' ||
          rawType === 'BlockDevice' ||
          rawType === 'FIFO';

        if (isSymlink || isLink || isDeviceOrFifo) {
          validationError = new ArchiveDownloadFailedError(
            `Archive contains prohibited link or device entry: "${entryPath}"`
          );
          return false;
        }

        // 3. Prevent Zip-Slip and absolute path traversal
        const portableEntryPath = entryPath.replace(/\\/g, '/');
        const hasDrivePrefix = /^[a-zA-Z]:/.test(entryPath);
        const hasTraversalSegment = portableEntryPath.split('/').includes('..');
        if (
          hasDrivePrefix ||
          path.isAbsolute(entryPath) ||
          portableEntryPath.startsWith('/') ||
          hasTraversalSegment
        ) {
          validationError = new ArchiveDownloadFailedError(
            `Archive entry has unsafe path: "${entryPath}"`
          );
          return false;
        }

        const resolved = path.resolve(normalizedDest, portableEntryPath);
        if (!resolved.startsWith(normalizedDest + path.sep) && resolved !== normalizedDest) {
          validationError = new ArchiveDownloadFailedError(
            `Archive entry escapes destination directory: "${entryPath}"`
          );
          return false;
        }

        // 4. File count check
        fileCount++;
        if (fileCount > maxFiles) {
          validationError = new RepositoryTooLargeError(
            `Archive contains more than ${maxFiles} files`
          );
          return false;
        }

        // 5. Extracted size check
        const entrySize = typeof entry.size === 'number' ? entry.size : 0;
        totalBytes += entrySize;
        if (totalBytes > maxBytes) {
          validationError = new RepositoryTooLargeError(
            `Extracted archive size exceeds limit of ${maxBytes} bytes`
          );
          return false;
        }

        return true;
      },
    });
  } catch (err: unknown) {
    // If validation error was captured during extraction, throw that instead
    if (validationError) {
      cleanupDestination();
      throw validationError;
    }
    cleanupDestination();
    if (options?.signal?.aborted && options.signal.reason instanceof Error) {
      throw options.signal.reason;
    }
    if (err instanceof ScanError) {
      throw err;
    }
    throw new ArchiveDownloadFailedError(
      `Failed to safely extract archive: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (validationError) {
    cleanupDestination();
    throw validationError;
  }

  // Determine actual repository root inside GitHub's wrapper folder
  let repoRoot = normalizedDest;
  const entries = fs.readdirSync(normalizedDest, { withFileTypes: true });
  if (entries.length === 1 && entries[0].isDirectory()) {
    repoRoot = path.join(normalizedDest, entries[0].name);
  }

  return {
    repoRoot,
    fileCount,
    totalBytes,
  };
}
