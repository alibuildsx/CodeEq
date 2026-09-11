import type { RepositoryScanResponse } from '../scanner/types';

export interface ApiErrorPayload {
  code: string;
  message: string;
}

export class FrontendScanError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 500) {
    super(message);
    this.name = 'FrontendScanError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function scanRepository(
  repoUrl: string,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<RepositoryScanResponse> {
  const trimmed = repoUrl.trim();
  if (!trimmed) {
    throw new FrontendScanError('INVALID_GITHUB_URL', 'Please enter a GitHub repository URL', 400);
  }

  let response: Response;
  try {
    response = await fetchFn('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoUrl: trimmed }),
    });
  } catch (err: unknown) {
    throw new FrontendScanError(
      'SCAN_FAILED',
      `Unable to reach scan server: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new FrontendScanError(
      'SCAN_FAILED',
      'Received invalid response format from scanner server',
      response.status
    );
  }

  if (!response.ok) {
    const errorBody = (data as { error?: ApiErrorPayload })?.error;
    const code = errorBody?.code || 'SCAN_FAILED';
    const message = errorBody?.message || 'Repository scan failed. Please try again.';
    throw new FrontendScanError(code, message, response.status);
  }

  return data as RepositoryScanResponse;
}
