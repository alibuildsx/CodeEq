import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';

interface RouteRoot {
  relativePath: string;
  matches(filename: string): boolean;
}

const ROUTE_ROOTS: RouteRoot[] = [
  { relativePath: 'app/api', matches: (name) => name === 'route.ts' || name === 'route.tsx' },
  { relativePath: 'src/app/api', matches: (name) => name === 'route.ts' || name === 'route.tsx' },
  { relativePath: 'pages/api', matches: (name) => name.endsWith('.ts') },
  { relativePath: 'src/pages/api', matches: (name) => name.endsWith('.ts') },
];

function toPortablePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

export async function detectApiRoutes(targetDir: string): Promise<string[]> {
  const routes: string[] = [];

  async function walk(currentDir: string, root: RouteRoot): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath, root);
      } else if (entry.isFile() && root.matches(entry.name)) {
        routes.push(toPortablePath(path.relative(targetDir, entryPath)));
      }
    }));
  }

  await Promise.all(
    ROUTE_ROOTS.map((root) => walk(path.join(targetDir, root.relativePath), root)),
  );

  return routes.sort();
}
