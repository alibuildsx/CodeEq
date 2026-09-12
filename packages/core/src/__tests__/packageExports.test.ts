import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';

describe('@codeeq/core package exports', () => {
  it('provides the CommonJS export required by the compiled CLI', async () => {
    const packageJson = JSON.parse(
      await fs.readFile(new URL('../../package.json', import.meta.url), 'utf-8'),
    ) as { exports?: { '.'?: { require?: string } } };

    expect(packageJson.exports?.['.']?.require).toBe('./dist/index.js');
  });

  it('declares TypeScript as a runtime dependency because detectors import it', async () => {
    const packageJson = JSON.parse(
      await fs.readFile(new URL('../../package.json', import.meta.url), 'utf-8'),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

    expect(packageJson.dependencies?.typescript).toBeDefined();
    expect(packageJson.devDependencies?.typescript).toBeUndefined();
  });

  it('declares the minimum Node.js runtime required by Next.js 15', async () => {
    const packageJson = JSON.parse(
      await fs.readFile(new URL('../../../../package.json', import.meta.url), 'utf-8'),
    ) as { engines?: { node?: string } };

    expect(packageJson.engines?.node).toBe('>=18.18.0');
  });
});
