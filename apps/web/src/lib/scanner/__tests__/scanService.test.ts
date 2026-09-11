import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ReadableStream } from 'node:stream/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InvalidGitHubUrlError,
  RepositoryNotAccessibleError,
  RepositoryTooLargeError,
  ScanTimeoutError,
} from '../../errors';
import { scanGithubRepository } from '../scanService';

function createRawTar(
  entries: Array<{
    name: string;
    content?: string | Buffer;
    type?: string;
  }>
): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 100, 'utf8');
    header.write('0000644\0', 100, 8, 'ascii');
    header.write('0001750\0', 108, 8, 'ascii');
    header.write('0001750\0', 116, 8, 'ascii');
    const content = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content || '');
    const sizeOctal = content.length.toString(8).padStart(11, '0') + '\0';
    header.write(sizeOctal, 124, 12, 'ascii');
    header.write('14000000000\0', 136, 12, 'ascii');
    header.fill(32, 148, 156);
    header.write(entry.type || '0', 156, 1, 'ascii');
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');

    let sum = 0;
    for (let i = 0; i < 512; i++) sum += header[i];
    const chksumOctal = sum.toString(8).padStart(6, '0') + '\0 ';
    header.write(chksumOctal, 148, 8, 'ascii');

    chunks.push(header);
    if (content.length > 0) {
      chunks.push(content);
      const pad = (512 - (content.length % 512)) % 512;
      if (pad > 0) chunks.push(Buffer.alloc(pad));
    }
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

describe('Scan Service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects invalid GitHub repository URLs before network call', async () => {
    await expect(
      scanGithubRepository('https://attacker.com/user/repo')
    ).rejects.toThrow(InvalidGitHubUrlError);

    await expect(
      scanGithubRepository('http://github.com/user/repo')
    ).rejects.toThrow(InvalidGitHubUrlError);
  });

  it('completes end-to-end repository scan pipeline with sanitized response', async () => {
    // 1. Mock GitHub API metadata
    const mockMeta = {
      owner: { login: 'acme' },
      name: 'hello-world',
      default_branch: 'main',
      size: 200,
      private: false,
    };

    // 2. Mock repository tarball archive
    const samplePackageJson = JSON.stringify({
      name: 'hello-world',
      version: '1.0.0',
      scripts: { build: 'next build' },
      dependencies: { next: '^14.2.0', react: '^18.3.0' },
    });

    const sampleSource = `
      export default function Home() {
        return <h1>Hello CodeEq</h1>;
      }
    `;

    const tarData = createRawTar([
      { name: 'acme-hello-world-sha/', type: '5' },
      { name: 'acme-hello-world-sha/package.json', content: samplePackageJson },
      { name: 'acme-hello-world-sha/src/', type: '5' },
      { name: 'acme-hello-world-sha/src/app/', type: '5' },
      { name: 'acme-hello-world-sha/src/app/page.tsx', content: sampleSource },
    ]);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/repos/acme/hello-world/tarball/')) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(tarData);
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'application/x-gzip' },
        });
      }

      if (urlStr.includes('/repos/acme/hello-world')) {
        return new Response(JSON.stringify(mockMeta), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    });

    const result = await scanGithubRepository('https://github.com/acme/hello-world');

    // Verify repository identity
    expect(result.repository).toEqual({
      owner: 'acme',
      name: 'hello-world',
      url: 'https://github.com/acme/hello-world',
      defaultBranch: 'main',
    });

    // Verify scan results
    expect(result.scan.schemaVersion).toBe('1.0');
    expect(result.scan.projectInfo.name).toBe('hello-world');
    expect(result.scan.projectInfo.framework).toBe('nextjs');
    expect(result.scan.healthScore).toBeGreaterThanOrEqual(0);
    expect(['Ready', 'Needs attention', 'Blocked']).toContain(result.scan.deploymentReadiness);

    // Verify sanitization
    const rawResult = result as unknown as Record<string, unknown>;
    expect(rawResult.targetDir).toBeUndefined();
    expect(rawResult.reportPath).toBeUndefined();
    expect(rawResult.issues).toBeUndefined();

    // Verify no server temp paths exist in findings
    for (const finding of result.scan.findings) {
      if (finding.file) {
        expect(path.isAbsolute(finding.file)).toBe(false);
        expect(finding.file.includes('codeeq-scan-')).toBe(false);
      }
      expect(finding.summary.includes('codeeq-scan-')).toBe(false);
    }
  });

  it('fails cleanly on non-accessible repository', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );

    await expect(
      scanGithubRepository('https://github.com/private-org/private-repo')
    ).rejects.toThrow(RepositoryNotAccessibleError);
  });

  it('fails cleanly when archive exceeds size limit', async () => {
    const mockMeta = {
      owner: { login: 'big' },
      name: 'big-repo',
      default_branch: 'main',
      size: 50000,
      private: false,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/repos/big/big-repo/tarball/')) {
        return new Response('large payload', {
          status: 200,
          headers: { 'content-length': '99999999' },
        });
      }
      return new Response(JSON.stringify(mockMeta), { status: 200 });
    });

    await expect(
      scanGithubRepository('https://github.com/big/big-repo', {
        maxArchiveBytes: 1000,
      })
    ).rejects.toThrow(RepositoryTooLargeError);
  });

  it('times out cleanly when scan exceeds overall timeout limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Promise((resolve) => setTimeout(resolve, 500));
    });

    await expect(
      scanGithubRepository('https://github.com/slow/slow-repo', {
        scanTimeoutMs: 50,
      })
    ).rejects.toThrow(ScanTimeoutError);
  });
});
