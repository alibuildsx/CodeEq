import { describe, it, expect } from 'vitest';
import { mergeDependencies } from '../packageJson.js';
import type { ParsedPackageJson } from '../packageJson.js';

describe('mergeDependencies', () => {
  it('merges prod, dev, and peer dependencies', () => {
    const pkg: ParsedPackageJson = {
      scripts: {},
      dependencies: { react: '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' },
      peerDependencies: { 'react-dom': '^18.0.0' },
    };
    const result = mergeDependencies(pkg);
    expect(result).toEqual({
      react: '^18.0.0',
      typescript: '^5.0.0',
      'react-dom': '^18.0.0',
    });
  });

  it('handles empty dep objects gracefully', () => {
    const pkg: ParsedPackageJson = {
      scripts: {},
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
    };
    expect(mergeDependencies(pkg)).toEqual({});
  });

  it('devDependencies overwrite dependencies on key collision', () => {
    const pkg: ParsedPackageJson = {
      scripts: {},
      dependencies: { lodash: '^4.0.0' },
      devDependencies: { lodash: '^4.17.0' },
      peerDependencies: {},
    };
    const result = mergeDependencies(pkg);
    expect(result['lodash']).toBe('^4.17.0');
  });
});
