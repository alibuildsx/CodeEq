import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArchiveDownloadFailedError, RepositoryTooLargeError } from '../../errors';
import { extractTarSafely } from '../extract';

// Helper to create valid ustar tarballs with arbitrary headers (including malicious paths and links)
function createRawTar(
  entries: Array<{
    name: string;
    content?: string | Buffer;
    type?: string;
    linkname?: string;
  }>
): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 100, 'utf8');
    header.write('0000644\0', 100, 8, 'ascii'); // mode
    header.write('0001750\0', 108, 8, 'ascii'); // uid
    header.write('0001750\0', 116, 8, 'ascii'); // gid
    const content = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content || '');
    const sizeOctal = content.length.toString(8).padStart(11, '0') + '\0';
    header.write(sizeOctal, 124, 12, 'ascii');
    header.write('14000000000\0', 136, 12, 'ascii'); // mtime
    // fill checksum field with spaces before calculating
    header.fill(32, 148, 156);
    header.write(entry.type || '0', 156, 1, 'ascii');
    if (entry.linkname) header.write(entry.linkname, 157, 100, 'utf8');
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
  chunks.push(Buffer.alloc(1024)); // tar EOF
  return Buffer.concat(chunks);
}

describe('extractTarSafely', () => {
  let tempBase: string;

  beforeEach(() => {
    tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'codeeq-extract-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempBase, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('safely extracts standard repository structure with GitHub wrapper directory', async () => {
    const tarBuf = createRawTar([
      { name: 'owner-repo-sha/', type: '5' },
      { name: 'owner-repo-sha/package.json', content: '{"name":"demo"}' },
      { name: 'owner-repo-sha/src/index.js', content: 'console.log("hi");' },
    ]);

    const tarPath = path.join(tempBase, 'repo.tar');
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, tarBuf);

    const result = await extractTarSafely(tarPath, extractDir);

    expect(result.fileCount).toBe(3);
    expect(result.repoRoot).toBe(path.join(extractDir, 'owner-repo-sha'));
    expect(
      fs.existsSync(path.join(result.repoRoot, 'package.json'))
    ).toBe(true);
    expect(
      fs.readFileSync(path.join(result.repoRoot, 'package.json'), 'utf8')
    ).toBe('{"name":"demo"}');
  });

  it('safely extracts flat archive without outer wrapper folder', async () => {
    const tarBuf = createRawTar([
      { name: 'package.json', content: '{"name":"flat"}' },
      { name: 'README.md', content: '# Hello' },
    ]);

    const tarPath = path.join(tempBase, 'flat.tar');
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, tarBuf);

    const result = await extractTarSafely(tarPath, extractDir);

    expect(result.fileCount).toBe(2);
    expect(result.repoRoot).toBe(extractDir);
    expect(fs.existsSync(path.join(extractDir, 'package.json'))).toBe(true);
  });

  it('rejects path traversal entry attempting to escape temp directory (Zip-Slip)', async () => {
    const tarBuf = createRawTar([
      { name: '../escaped.txt', content: 'malicious payload' },
    ]);

    const tarPath = path.join(tempBase, 'slip.tar');
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, tarBuf);

    await expect(extractTarSafely(tarPath, extractDir)).rejects.toThrow(
      ArchiveDownloadFailedError
    );

    // Verify escaped file was not written to parent directory
    expect(fs.existsSync(path.join(tempBase, 'escaped.txt'))).toBe(false);
  });

  it('rejects deep relative traversal entries', async () => {
    const tarBuf = createRawTar([
      { name: '../../../../etc/passwd', content: 'root:x:0:0' },
    ]);

    const tarPath = path.join(tempBase, 'deep-slip.tar');
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, tarBuf);

    await expect(extractTarSafely(tarPath, extractDir)).rejects.toThrow(
      ArchiveDownloadFailedError
    );
  });

  it.each([
    'C:\\Windows\\system32\\owned.txt',
    '\\\\server\\share\\owned.txt',
    'wrapper\\..\\..\\owned.txt',
  ])('rejects absolute or mixed-separator hostile path %s', async (entryName) => {
    const tarPath = path.join(tempBase, 'hostile-path.tar');
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, createRawTar([{ name: entryName, content: 'owned' }]));

    await expect(extractTarSafely(tarPath, extractDir)).rejects.toThrow(
      ArchiveDownloadFailedError,
    );
  });

  it('rejects symlink entries', async () => {
    const tarBuf = createRawTar([
      { name: 'link_to_file', type: '2', linkname: '/etc/passwd' },
    ]);

    const tarPath = path.join(tempBase, 'symlink.tar');
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, tarBuf);

    await expect(extractTarSafely(tarPath, extractDir)).rejects.toThrow(
      ArchiveDownloadFailedError
    );
  });

  it('rejects hardlink entries', async () => {
    const tarBuf = createRawTar([
      { name: 'hardlink', type: '1', linkname: 'target' },
    ]);

    const tarPath = path.join(tempBase, 'hardlink.tar');
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, tarBuf);

    await expect(extractTarSafely(tarPath, extractDir)).rejects.toThrow(
      ArchiveDownloadFailedError
    );
  });

  it.each(['3', '4', '6'])('rejects device or FIFO tar entry type %s', async (type) => {
    const tarPath = path.join(tempBase, `special-${type}.tar`);
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, createRawTar([{ name: `special-${type}`, type }]));

    await expect(extractTarSafely(tarPath, extractDir)).rejects.toThrow(
      ArchiveDownloadFailedError,
    );
  });

  it('removes the destination after a malformed archive failure', async () => {
    const tarPath = path.join(tempBase, 'malformed.tar');
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, Buffer.from('not a tar archive'));

    await expect(extractTarSafely(tarPath, extractDir)).rejects.toThrow(
      ArchiveDownloadFailedError,
    );
    expect(fs.existsSync(extractDir)).toBe(false);
  });

  it('rejects file bomb exceeding maxFiles limit', async () => {
    const entries = [];
    for (let i = 0; i < 15; i++) {
      entries.push({ name: `file_${i}.txt`, content: 'data' });
    }
    const tarBuf = createRawTar(entries);

    const tarPath = path.join(tempBase, 'file-bomb.tar');
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, tarBuf);

    await expect(
      extractTarSafely(tarPath, extractDir, { maxFiles: 10 })
    ).rejects.toThrow(RepositoryTooLargeError);
  });

  it('rejects extracted-size bomb exceeding maxBytes limit', async () => {
    const largeContent = Buffer.alloc(100_000, 'A');
    const tarBuf = createRawTar([
      { name: 'large.txt', content: largeContent },
    ]);

    const tarPath = path.join(tempBase, 'size-bomb.tar');
    const extractDir = path.join(tempBase, 'dest');
    fs.writeFileSync(tarPath, tarBuf);

    await expect(
      extractTarSafely(tarPath, extractDir, { maxBytes: 50_000 })
    ).rejects.toThrow(RepositoryTooLargeError);
  });
});
