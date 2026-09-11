import { describe, expect, it, vi } from 'vitest';
import { FrontendScanError, scanRepository } from '../client';
import { mockHealthyResult } from '../../fixtures/mockResults';
import type { ScanErrorCode } from '../../errors';

describe('Frontend API Client (scanRepository)', () => {
  describe('Input validation & shorthand normalization', () => {
    it('rejects empty repository URLs before issuing request', async () => {
      await expect(scanRepository('')).rejects.toThrow(FrontendScanError);
      await expect(scanRepository('   ')).rejects.toThrow('Please enter a GitHub repository URL');
    });

    it('rejects invalid shorthand without slash before issuing request', async () => {
      await expect(scanRepository('invalid-shorthand')).rejects.toThrow('Please enter both owner and repository name');
    });

    it('rejects shorthand with extra path segments before issuing request', async () => {
      await expect(scanRepository('alibuildsx/CodeEq/extra')).rejects.toThrow('Extra path segments are not permitted');
    });

    it('rejects shorthand with traversal tokens before issuing request', async () => {
      await expect(scanRepository('../repo')).rejects.toThrow('Invalid owner or repository path token');
    });

    it('normalizes valid owner/repo shorthand to https://github.com/owner/repo before issuing request', async () => {
      let capturedBody = '';
      const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify(mockHealthyResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      await scanRepository('alibuildsx/CodeEq', mockFetch as unknown as typeof fetch);

      expect(JSON.parse(capturedBody)).toEqual({
        repoUrl: 'https://github.com/alibuildsx/CodeEq',
      });
    });

    it('posts to /api/scan with trimmed repoUrl and returns parsed scan result', async () => {
      let capturedUrl = '';
      let capturedBody = '';

      const mockFetch = vi.fn().mockImplementation(async (url, init) => {
        capturedUrl = String(url);
        capturedBody = init?.body as string;
        return new Response(JSON.stringify(mockHealthyResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await scanRepository('  https://github.com/alibuildsx/CodeEq  ', mockFetch as unknown as typeof fetch);

      expect(capturedUrl).toBe('/api/scan');
      expect(JSON.parse(capturedBody)).toEqual({
        repoUrl: 'https://github.com/alibuildsx/CodeEq',
      });
      expect(result).toEqual(mockHealthyResult);
    });
  });

  describe('Backend Error Code Handling', () => {
    const backendCodes: Array<{ code: ScanErrorCode; status: number; message: string }> = [
      { code: 'INVALID_GITHUB_URL', status: 400, message: 'Invalid GitHub repository URL' },
      { code: 'REPOSITORY_NOT_ACCESSIBLE', status: 404, message: 'Repository not found or private' },
      { code: 'GITHUB_RATE_LIMITED', status: 429, message: 'Rate limit exceeded' },
      { code: 'REPOSITORY_TOO_LARGE', status: 413, message: 'Repository exceeds size or file limit' },
      { code: 'ARCHIVE_DOWNLOAD_FAILED', status: 502, message: 'Failed to download repository archive' },
      { code: 'SCAN_TIMEOUT', status: 504, message: 'Scan operation timed out' },
      { code: 'SCAN_FAILED', status: 500, message: 'Scan analysis failed' },
    ];

    for (const { code, status, message } of backendCodes) {
      it(`accurately handles backend code ${code} (status ${status})`, async () => {
        const mockFetch = vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              error: {
                code,
                message,
              },
            }),
            { status, headers: { 'Content-Type': 'application/json' } }
          )
        );

        try {
          await scanRepository('https://github.com/owner/repo', mockFetch as unknown as typeof fetch);
          expect.unreachable(`Should have thrown for ${code}`);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(FrontendScanError);
          const scanErr = err as FrontendScanError;
          expect(scanErr.code).toBe(code);
          expect(scanErr.statusCode).toBe(status);
          expect(scanErr.message).toBe(message);
        }
      });
    }

    it('safely falls back to SCAN_FAILED for unknown future error codes', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'FUTURE_UNKNOWN_ERROR',
              message: 'Something new happened on backend',
            },
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      );

      try {
        await scanRepository('https://github.com/owner/repo', mockFetch as unknown as typeof fetch);
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(FrontendScanError);
        const scanErr = err as FrontendScanError;
        expect(scanErr.code).toBe('SCAN_FAILED');
        expect(scanErr.message).toBe('Something new happened on backend');
      }
    });

    it('handles network fetch failures cleanly with SCAN_FAILED', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      await expect(
        scanRepository('https://github.com/owner/repo', mockFetch as unknown as typeof fetch)
      ).rejects.toThrow('Unable to reach scan server');
    });

    it('handles invalid JSON responses cleanly with SCAN_FAILED', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('<html><body>502 Bad Gateway</body></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        })
      );

      try {
        await scanRepository('https://github.com/owner/repo', mockFetch as unknown as typeof fetch);
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(FrontendScanError);
        const scanErr = err as FrontendScanError;
        expect(scanErr.code).toBe('SCAN_FAILED');
        expect(scanErr.statusCode).toBe(502);
      }
    });
  });
});
