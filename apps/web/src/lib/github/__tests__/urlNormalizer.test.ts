import { describe, expect, it } from 'vitest';
import { normalizeRepositoryInput } from '../urlNormalizer';
import { FrontendScanError } from '../../api/client';

describe('normalizeRepositoryInput', () => {
  describe('Shorthand owner/repo normalization', () => {
    it('normalizes valid owner/repo shorthand to canonical HTTPS GitHub URL', () => {
      expect(normalizeRepositoryInput('alibuildsx/CodeEq')).toBe('https://github.com/alibuildsx/CodeEq');
      expect(normalizeRepositoryInput('vercel/next.js')).toBe('https://github.com/vercel/next.js');
      expect(normalizeRepositoryInput('facebook/react')).toBe('https://github.com/facebook/react');
    });

    it('strips .git suffix from shorthand', () => {
      expect(normalizeRepositoryInput('alibuildsx/CodeEq.git')).toBe('https://github.com/alibuildsx/CodeEq');
    });

    it('trims leading and trailing whitespace from shorthand', () => {
      expect(normalizeRepositoryInput('   alibuildsx/CodeEq   ')).toBe('https://github.com/alibuildsx/CodeEq');
    });
  });

  describe('Full GitHub URL normalization', () => {
    it('preserves and canonicalizes valid HTTPS GitHub URLs', () => {
      expect(normalizeRepositoryInput('https://github.com/alibuildsx/CodeEq')).toBe('https://github.com/alibuildsx/CodeEq');
      expect(normalizeRepositoryInput('https://github.com/vercel/next.js')).toBe('https://github.com/vercel/next.js');
    });

    it('handles trailing slashes on full URLs', () => {
      expect(normalizeRepositoryInput('https://github.com/alibuildsx/CodeEq/')).toBe('https://github.com/alibuildsx/CodeEq');
    });

    it('strips .git suffix on full URLs', () => {
      expect(normalizeRepositoryInput('https://github.com/alibuildsx/CodeEq.git')).toBe('https://github.com/alibuildsx/CodeEq');
    });

    it('handles github.com/owner/repo without protocol by adding https://', () => {
      expect(normalizeRepositoryInput('github.com/alibuildsx/CodeEq')).toBe('https://github.com/alibuildsx/CodeEq');
    });
  });

  describe('Extra path segments rejection', () => {
    it('rejects shorthand with extra path segments', () => {
      expect(() => normalizeRepositoryInput('alibuildsx/CodeEq/extra')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('alibuildsx/CodeEq/tree/main')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('alibuildsx/CodeEq/issues/1')).toThrow(FrontendScanError);
    });

    it('rejects full URLs with extra path segments', () => {
      expect(() => normalizeRepositoryInput('https://github.com/alibuildsx/CodeEq/tree/main')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('https://github.com/alibuildsx/CodeEq/blob/master/README.md')).toThrow(FrontendScanError);
    });
  });

  describe('Invalid shorthand rejection', () => {
    it('rejects single segment shorthand without slash', () => {
      expect(() => normalizeRepositoryInput('alibuildsx')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('invalid')).toThrow(FrontendScanError);
    });

    it('rejects path traversal tokens in shorthand', () => {
      expect(() => normalizeRepositoryInput('../repo')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('owner/..')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('./repo')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('owner/.')).toThrow(FrontendScanError);
    });

    it('rejects shorthand containing invalid characters or spaces', () => {
      expect(() => normalizeRepositoryInput('owner//repo')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('owner/repo with space')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('owner/repo?query=1')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('owner/repo#hash')).toThrow(FrontendScanError);
    });
  });

  describe('Empty and blank input rejection', () => {
    it('rejects empty strings and whitespace-only strings', () => {
      expect(() => normalizeRepositoryInput('')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput('   ')).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput(null as unknown as string)).toThrow(FrontendScanError);
      expect(() => normalizeRepositoryInput(undefined as unknown as string)).toThrow(FrontendScanError);
    });
  });

  describe('Non-HTTPS and non-GitHub rejection', () => {
    it('rejects non-HTTPS protocols', () => {
      expect(() => normalizeRepositoryInput('http://github.com/alibuildsx/CodeEq')).toThrow('Only HTTPS GitHub URLs are supported');
      expect(() => normalizeRepositoryInput('ftp://github.com/alibuildsx/CodeEq')).toThrow('Only HTTPS GitHub URLs are supported');
    });

    it('rejects non-GitHub domains', () => {
      expect(() => normalizeRepositoryInput('https://gitlab.com/alibuildsx/CodeEq')).toThrow('Only github.com repositories are supported');
      expect(() => normalizeRepositoryInput('https://bitbucket.org/alibuildsx/CodeEq')).toThrow('Only github.com repositories are supported');
    });
  });
});
