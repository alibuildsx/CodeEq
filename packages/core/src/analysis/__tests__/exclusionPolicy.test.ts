import { describe, expect, it } from 'vitest';
import {
  GENERATED_OR_HEAVY_DIRS,
  NESTED_NON_PRODUCTION_DIRS,
  DOC_EXTENSIONS,
  normalizePath,
  shouldSkipDirectory,
  isGeneratedOrHeavyPath,
  isNestedNonProductionPath,
  isTestFile,
  isDocFile,
  isTestOrDocFile,
} from '../exclusionPolicy.js';

describe('Central Exclusion Policy', () => {
  describe('Directory categories and constants', () => {
    it('defines expected generated or heavy directories', () => {
      expect(GENERATED_OR_HEAVY_DIRS.has('node_modules')).toBe(true);
      expect(GENERATED_OR_HEAVY_DIRS.has('.git')).toBe(true);
      expect(GENERATED_OR_HEAVY_DIRS.has('dist')).toBe(true);
      expect(GENERATED_OR_HEAVY_DIRS.has('build')).toBe(true);
      expect(GENERATED_OR_HEAVY_DIRS.has('.next')).toBe(true);
      expect(GENERATED_OR_HEAVY_DIRS.has('.nuxt')).toBe(true);
      expect(GENERATED_OR_HEAVY_DIRS.has('.output')).toBe(true);
      expect(GENERATED_OR_HEAVY_DIRS.has('.turbo')).toBe(true);
      expect(GENERATED_OR_HEAVY_DIRS.has('coverage')).toBe(true);
      expect(GENERATED_OR_HEAVY_DIRS.has('.cache')).toBe(true);
    });

    it('defines expected nested non-production directories', () => {
      expect(NESTED_NON_PRODUCTION_DIRS.has('test-fixtures')).toBe(true);
      expect(NESTED_NON_PRODUCTION_DIRS.has('fixtures')).toBe(true);
      expect(NESTED_NON_PRODUCTION_DIRS.has('__fixtures__')).toBe(true);
      expect(NESTED_NON_PRODUCTION_DIRS.has('examples')).toBe(true);
      expect(NESTED_NON_PRODUCTION_DIRS.has('samples')).toBe(true);
      expect(NESTED_NON_PRODUCTION_DIRS.has('mocks')).toBe(true);
      expect(NESTED_NON_PRODUCTION_DIRS.has('__mocks__')).toBe(true);
    });

    it('does NOT include general "test" or "src" in excluded directory sets', () => {
      expect(GENERATED_OR_HEAVY_DIRS.has('test')).toBe(false);
      expect(NESTED_NON_PRODUCTION_DIRS.has('test')).toBe(false);
      expect(GENERATED_OR_HEAVY_DIRS.has('src')).toBe(false);
      expect(NESTED_NON_PRODUCTION_DIRS.has('src')).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('normalizes Windows backslashes to POSIX forward slashes', () => {
      expect(normalizePath('packages\\core\\test-fixtures\\broken-code')).toBe(
        'packages/core/test-fixtures/broken-code',
      );
      expect(normalizePath('src\\index.ts')).toBe('src/index.ts');
    });

    it('trims trailing slashes', () => {
      expect(normalizePath('packages/core/')).toBe('packages/core');
      expect(normalizePath('src\\')).toBe('src');
    });
  });

  describe('shouldSkipDirectory', () => {
    it('returns true for generated and heavy directories', () => {
      expect(shouldSkipDirectory('node_modules')).toBe(true);
      expect(shouldSkipDirectory('.git')).toBe(true);
      expect(shouldSkipDirectory('dist')).toBe(true);
      expect(shouldSkipDirectory('.next')).toBe(true);
    });

    it('returns true for nested non-production directories', () => {
      expect(shouldSkipDirectory('test-fixtures')).toBe(true);
      expect(shouldSkipDirectory('fixtures')).toBe(true);
      expect(shouldSkipDirectory('__fixtures__')).toBe(true);
      expect(shouldSkipDirectory('examples')).toBe(true);
      expect(shouldSkipDirectory('samples')).toBe(true);
      expect(shouldSkipDirectory('mocks')).toBe(true);
      expect(shouldSkipDirectory('__mocks__')).toBe(true);
    });

    it('returns false for normal source and test directories', () => {
      expect(shouldSkipDirectory('src')).toBe(false);
      expect(shouldSkipDirectory('app')).toBe(false);
      expect(shouldSkipDirectory('pages')).toBe(false);
      expect(shouldSkipDirectory('components')).toBe(false);
      expect(shouldSkipDirectory('lib')).toBe(false);
      expect(shouldSkipDirectory('test')).toBe(false);
      expect(shouldSkipDirectory('__tests__')).toBe(false);
    });
  });

  describe('isGeneratedOrHeavyPath', () => {
    it('identifies paths inside generated or heavy directories', () => {
      expect(isGeneratedOrHeavyPath('node_modules/pkg/index.js')).toBe(true);
      expect(isGeneratedOrHeavyPath('packages/core/dist/index.js')).toBe(true);
      expect(isGeneratedOrHeavyPath('.next/server/pages.js')).toBe(true);
      expect(isGeneratedOrHeavyPath('coverage/lcov.info')).toBe(true);
    });

    it('returns false for normal application source paths', () => {
      expect(isGeneratedOrHeavyPath('src/index.ts')).toBe(false);
      expect(isGeneratedOrHeavyPath('app/page.tsx')).toBe(false);
    });
  });

  describe('isNestedNonProductionPath', () => {
    it('identifies nested fixture, example, sample, and mock paths relative to scan root', () => {
      expect(isNestedNonProductionPath('test-fixtures/broken-project/src/bad.ts')).toBe(true);
      expect(isNestedNonProductionPath('packages/core/test-fixtures/broken-code/src/syntaxError.ts')).toBe(true);
      expect(isNestedNonProductionPath('fixtures/legacy/app.ts')).toBe(true);
      expect(isNestedNonProductionPath('__fixtures__/test.ts')).toBe(true);
      expect(isNestedNonProductionPath('examples/basic/index.ts')).toBe(true);
      expect(isNestedNonProductionPath('samples/demo.ts')).toBe(true);
      expect(isNestedNonProductionPath('mocks/server.ts')).toBe(true);
      expect(isNestedNonProductionPath('__mocks__/client.ts')).toBe(true);
    });

    it('handles Windows-style backslashes', () => {
      expect(isNestedNonProductionPath('test-fixtures\\broken-project\\src\\bad.ts')).toBe(true);
      expect(isNestedNonProductionPath('examples\\demo\\app.ts')).toBe(true);
      expect(isNestedNonProductionPath('mocks\\handlers.ts')).toBe(true);
    });

    it('returns false when scanning directly inside a fixture directory (targetDir is the fixture)', () => {
      // When targetDir is /path/to/test-fixtures/broken-code, relPath is src/syntaxError.ts
      expect(isNestedNonProductionPath('src/syntaxError.ts')).toBe(false);
      expect(isNestedNonProductionPath('src/brokenImport.ts')).toBe(false);
      expect(isNestedNonProductionPath('src/config.ts')).toBe(false);
      expect(isNestedNonProductionPath('index.ts')).toBe(false);
    });

    it('returns false for normal application files with similar names', () => {
      expect(isNestedNonProductionPath('src/examples.ts')).toBe(false);
      expect(isNestedNonProductionPath('src/mocks.ts')).toBe(false);
      expect(isNestedNonProductionPath('src/fixtures.ts')).toBe(false);
      expect(isNestedNonProductionPath('src/sampleService.ts')).toBe(false);
    });
  });

  describe('isTestFile', () => {
    it('identifies test files by __tests__ directory', () => {
      expect(isTestFile('src/__tests__/app.test.ts')).toBe(true);
      expect(isTestFile('packages/core/src/__tests__/fixturePack.test.ts')).toBe(true);
      expect(isTestFile('__tests__/helper.ts')).toBe(true);
    });

    it('identifies test files by .test. or .spec. suffix', () => {
      expect(isTestFile('src/utils.test.ts')).toBe(true);
      expect(isTestFile('src/utils.spec.js')).toBe(true);
      expect(isTestFile('test/runner.test.ts')).toBe(true);
      expect(isTestFile('test-runner.ts')).toBe(true);
    });

    it('returns false for non-test files', () => {
      expect(isTestFile('src/app.ts')).toBe(false);
      expect(isTestFile('src/testingUtils.ts')).toBe(false);
      expect(isTestFile('src/contest.ts')).toBe(false);
    });
  });

  describe('isDocFile', () => {
    it('identifies documentation files by extension', () => {
      expect(isDocFile('README.md')).toBe(true);
      expect(isDocFile('docs/architecture.mdx')).toBe(true);
      expect(isDocFile('LICENSE.txt')).toBe(true);
    });

    it('identifies files inside docs directory or with example suffixes', () => {
      expect(isDocFile('docs/config.json')).toBe(true);
      expect(isDocFile('config.example')).toBe(true);
      expect(isDocFile('settings.sample')).toBe(true);
    });

    it('returns false for source code files', () => {
      expect(isDocFile('src/index.ts')).toBe(false);
      expect(isDocFile('src/config.ts')).toBe(false);
    });
  });

  describe('isTestOrDocFile', () => {
    it('returns true for both test and doc files, false for normal source', () => {
      expect(isTestOrDocFile('src/__tests__/app.test.ts')).toBe(true);
      expect(isTestOrDocFile('test/integration.js')).toBe(true);
      expect(isTestOrDocFile('tests/unit/helper.ts')).toBe(true);
      expect(isTestOrDocFile('test\\windows-case.js')).toBe(true);
      expect(isTestOrDocFile('README.md')).toBe(true);
      expect(isTestOrDocFile('src/app.ts')).toBe(false);
    });
  });
});
