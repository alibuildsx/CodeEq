import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TempWorkspace {
  readonly workspaceDir: string;
  readonly archivePath: string;
  readonly extractDir: string;
  cleanup: () => Promise<void>;
}

export async function createTempWorkspace(): Promise<TempWorkspace> {
  const id = randomUUID();
  const workspaceDir = path.join(os.tmpdir(), `codeeq-scan-${id}`);
  fs.mkdirSync(workspaceDir, { recursive: true });

  const archivePath = path.join(workspaceDir, 'repository.tar.gz');
  const extractDir = path.join(workspaceDir, 'extracted');
  fs.mkdirSync(extractDir, { recursive: true });

  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try {
      if (fs.existsSync(workspaceDir)) {
        await fs.promises.rm(workspaceDir, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 100,
        });
      }
    } catch {
      // Best effort cleanup; do not throw
    }
  };

  return {
    workspaceDir,
    archivePath,
    extractDir,
    cleanup,
  };
}

export async function withTempWorkspace<T>(
  action: (workspace: TempWorkspace) => Promise<T>
): Promise<T> {
  const workspace = await createTempWorkspace();
  try {
    return await action(workspace);
  } finally {
    await workspace.cleanup();
  }
}
