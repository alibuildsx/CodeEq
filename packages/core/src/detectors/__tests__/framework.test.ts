import { describe, it, expect } from 'vitest';
import { detectFramework } from '../framework.js';

describe('detectFramework', () => {
  // We pass a non-existent dir so config-file detection always returns false,
  // allowing us to test the dep-based detection path in isolation.
  const fakeDir = '/non/existent/dir';

  it('detects Next.js from dependencies', async () => {
    const result = await detectFramework(fakeDir, { next: '^14.0.0' });
    expect(result.framework).toBe('nextjs');
    expect(result.label).toBe('Next.js');
  });

  it('detects Vite from dependencies', async () => {
    const result = await detectFramework(fakeDir, { vite: '^5.0.0' });
    expect(result.framework).toBe('vite');
  });

  it('detects React (without Vite or Next)', async () => {
    const result = await detectFramework(fakeDir, {
      react: '^18.0.0',
      'react-dom': '^18.0.0',
    });
    expect(result.framework).toBe('react');
  });

  it('detects Express', async () => {
    const result = await detectFramework(fakeDir, { express: '^4.18.0' });
    expect(result.framework).toBe('express');
  });

  it('returns unknown for empty deps', async () => {
    const result = await detectFramework(fakeDir, {});
    expect(result.framework).toBe('unknown');
  });

  it('prefers Next.js over React when both are present', async () => {
    const result = await detectFramework(fakeDir, {
      next: '^14.0.0',
      react: '^18.0.0',
    });
    expect(result.framework).toBe('nextjs');
  });
});
