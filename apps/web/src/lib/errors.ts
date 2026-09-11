export type ScanErrorCode =
  | 'INVALID_GITHUB_URL'
  | 'REPOSITORY_NOT_ACCESSIBLE'
  | 'GITHUB_RATE_LIMITED'
  | 'REPOSITORY_TOO_LARGE'
  | 'ARCHIVE_DOWNLOAD_FAILED'
  | 'SCAN_TIMEOUT'
  | 'SCAN_FAILED';

export class ScanError extends Error {
  readonly code: ScanErrorCode;
  readonly statusCode: number;

  constructor(code: ScanErrorCode, message: string, statusCode: number = 500) {
    super(message);
    this.name = 'ScanError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class InvalidGitHubUrlError extends ScanError {
  constructor(message: string = 'Invalid GitHub repository URL') {
    super('INVALID_GITHUB_URL', message, 400);
    this.name = 'InvalidGitHubUrlError';
  }
}

export class RepositoryNotAccessibleError extends ScanError {
  constructor(message: string = 'Repository not found or not publicly accessible') {
    super('REPOSITORY_NOT_ACCESSIBLE', message, 404);
    this.name = 'RepositoryNotAccessibleError';
  }
}

export class GitHubRateLimitedError extends ScanError {
  constructor(message: string = 'GitHub API rate limit exceeded') {
    super('GITHUB_RATE_LIMITED', message, 429);
    this.name = 'GitHubRateLimitedError';
  }
}

export class RepositoryTooLargeError extends ScanError {
  constructor(message: string = 'Repository exceeds size or file limit') {
    super('REPOSITORY_TOO_LARGE', message, 413);
    this.name = 'RepositoryTooLargeError';
  }
}

export class ArchiveDownloadFailedError extends ScanError {
  constructor(message: string = 'Failed to download repository archive') {
    super('ARCHIVE_DOWNLOAD_FAILED', message, 502);
    this.name = 'ArchiveDownloadFailedError';
  }
}

export class ScanTimeoutError extends ScanError {
  constructor(message: string = 'Scan operation timed out') {
    super('SCAN_TIMEOUT', message, 504);
    this.name = 'ScanTimeoutError';
  }
}
