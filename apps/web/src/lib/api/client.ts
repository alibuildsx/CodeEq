import { FrontendScanError, isScanErrorCode, type ScanErrorCode } from '../errors';
import { normalizeRepositoryInput } from '../github/urlNormalizer';
import type { RepositoryScanResponse } from '../scanner/types';

export { FrontendScanError, isScanErrorCode, KNOWN_SCAN_ERROR_CODES } from '../errors';
export type { ScanErrorCode } from '../errors';

export interface ApiErrorPayload {
  code: string;
  message: string;
}

export async function scanRepository(
  repoUrl: string,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<RepositoryScanResponse> {
  // Client-side validation & shorthand normalization (e.g. "owner/repo" -> "https://github.com/owner/repo")
  const normalizedUrl = normalizeRepositoryInput(repoUrl);

  let response: Response;
  try {
    response = await fetchFn('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoUrl: normalizedUrl }),
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
    const rawCode = errorBody?.code;
    const code: ScanErrorCode = isScanErrorCode(rawCode) ? rawCode : 'SCAN_FAILED';
    const message = errorBody?.message || 'Repository scan failed. Please try again.';
    throw new FrontendScanError(code, message, response.status);
  }

  return data as RepositoryScanResponse;
}
