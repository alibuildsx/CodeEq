import { describe, expect, it, vi } from 'vitest';
import { FrontendScanError, scanRepository } from '../client';
import { mockHealthyResult } from '../../fixtures/mockResults';

describe('Frontend API Client (scanRepository)', () => {
  it('rejects empty repository URLs before issuing request', async () => {
    await expect(scanRepository('')).rejects.toThrow(FrontendScanError);
    await expect(scanRepository('   ')).rejects.toThrow('Please enter a GitHub repository URL');
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

  it('throws FrontendScanError with error code and message on 400 invalid URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_GITHUB_URL',
            message: 'Invalid GitHub repository URL',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    );

    try {
      await scanRepository('https://attacker.com/repo', mockFetch as unknown as typeof fetch);
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(FrontendScanError);
      const scanErr = err as FrontendScanError;
      expect(scanErr.code).toBe('INVALID_GITHUB_URL');
      expect(scanErr.statusCode).toBe(400);
      expect(scanErr.message).toBe('Invalid GitHub repository URL');
    }
  });

  it('throws FrontendScanError on 404 repository not accessible', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'REPOSITORY_NOT_ACCESSIBLE',
            message: 'Repository not found or private',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(
      scanRepository('https://github.com/nonexistent/repo', mockFetch as unknown as typeof fetch)
    ).rejects.toThrow('Repository not found or private');
  });

  it('throws FrontendScanError on 429 rate limited', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'GITHUB_RATE_LIMITED',
            message: 'Rate limit exceeded',
          },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    );

    try {
      await scanRepository('https://github.com/any/repo', mockFetch as unknown as typeof fetch);
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(FrontendScanError);
      expect((err as FrontendScanError).code).toBe('GITHUB_RATE_LIMITED');
    }
  });

  it('handles network fetch failures cleanly', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    await expect(
      scanRepository('https://github.com/any/repo', mockFetch as unknown as typeof fetch)
    ).rejects.toThrow('Unable to reach scan server');
  });
});
