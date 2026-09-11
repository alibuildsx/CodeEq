import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTempWorkspace, withTempWorkspace } from '../tempWorkspace';

describe('TempWorkspace', () => {
  it('creates unique temporary directory and cleans it up', async () => {
    const ws = await createTempWorkspace();
    expect(fs.existsSync(ws.workspaceDir)).toBe(true);
    expect(fs.existsSync(ws.extractDir)).toBe(true);

    // Write a dummy file inside
    fs.writeFileSync(path.join(ws.extractDir, 'test.txt'), 'content');

    await ws.cleanup();
    expect(fs.existsSync(ws.workspaceDir)).toBe(false);

    // Calling cleanup again should not throw
    await expect(ws.cleanup()).resolves.toBeUndefined();
  });

  it('guarantees cleanup on success with withTempWorkspace', async () => {
    let capturedDir = '';
    const res = await withTempWorkspace(async (ws) => {
      capturedDir = ws.workspaceDir;
      expect(fs.existsSync(capturedDir)).toBe(true);
      return 'done';
    });

    expect(res).toBe('done');
    expect(fs.existsSync(capturedDir)).toBe(false);
  });

  it('guarantees cleanup even when action throws', async () => {
    let capturedDir = '';
    await expect(
      withTempWorkspace(async (ws) => {
        capturedDir = ws.workspaceDir;
        expect(fs.existsSync(capturedDir)).toBe(true);
        throw new Error('something failed');
      })
    ).rejects.toThrow('something failed');

    expect(fs.existsSync(capturedDir)).toBe(false);
  });

  it('creates isolated workspaces for concurrent calls', async () => {
    const [ws1, ws2] = await Promise.all([
      createTempWorkspace(),
      createTempWorkspace(),
    ]);

    expect(ws1.workspaceDir).not.toBe(ws2.workspaceDir);

    await Promise.all([ws1.cleanup(), ws2.cleanup()]);
    expect(fs.existsSync(ws1.workspaceDir)).toBe(false);
    expect(fs.existsSync(ws2.workspaceDir)).toBe(false);
  });
});
