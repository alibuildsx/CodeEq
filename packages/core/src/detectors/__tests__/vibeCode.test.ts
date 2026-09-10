import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectVibeCodeFindings } from '../vibeCode.js';

describe('detectVibeCodeFindings', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeeq-vibe-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content = ''): Promise<void> {
    const filePath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  describe('DUPLICATE_AUTH_PROVIDERS', () => {
    it('detects multiple competing auth implementations in dependencies', async () => {
      await write('package.json', JSON.stringify({
        name: 'multi-auth-app',
        dependencies: {
          '@clerk/nextjs': '^5.0.0',
          'next-auth': '^4.24.0',
        },
      }));

      const findings = await detectVibeCodeFindings(tmpDir);
      const finding = findings.find((f) => f.code === 'DUPLICATE_AUTH_PROVIDERS');

      expect(finding).toBeDefined();
      expect(finding?.category).toBe('code-health');
      expect(finding?.severity).toBe('medium');
      expect(finding?.evidence).toContain('@clerk/nextjs');
      expect(finding?.evidence).toContain('next-auth');
    });

    it('does not flag when only one auth provider is used', async () => {
      await write('package.json', JSON.stringify({
        name: 'single-auth-app',
        dependencies: {
          '@clerk/nextjs': '^5.0.0',
        },
      }));

      const findings = await detectVibeCodeFindings(tmpDir);
      expect(findings.find((f) => f.code === 'DUPLICATE_AUTH_PROVIDERS')).toBeUndefined();
    });
  });

  describe('MULTIPLE_SUPABASE_CLIENTS', () => {
    it('detects multiple separate Supabase client initialization files', async () => {
      await write('package.json', JSON.stringify({
        name: 'multi-supabase-app',
        dependencies: { '@supabase/supabase-js': '^2.0.0' },
      }));
      await write('lib/supabase.ts', 'import { createClient } from "@supabase/supabase-js";\nexport const supabase = createClient("url", "key");');
      await write('utils/supabaseClient.ts', 'import { createClient } from "@supabase/supabase-js";\nexport const client = createClient("url", "key");');

      const findings = await detectVibeCodeFindings(tmpDir);
      const finding = findings.find((f) => f.code === 'MULTIPLE_SUPABASE_CLIENTS');

      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('low');
      expect(finding?.evidence).toContain('lib/supabase.ts');
      expect(finding?.evidence).toContain('utils/supabaseClient.ts');
    });

    it('does not flag when only a single client file creates the Supabase client', async () => {
      await write('package.json', JSON.stringify({
        name: 'single-supabase-app',
        dependencies: { '@supabase/supabase-js': '^2.0.0' },
      }));
      await write('lib/supabase.ts', 'import { createClient } from "@supabase/supabase-js";\nexport const supabase = createClient("url", "key");');
      await write('src/app/page.tsx', 'import { supabase } from "@/lib/supabase";');

      const findings = await detectVibeCodeFindings(tmpDir);
      expect(findings.find((f) => f.code === 'MULTIPLE_SUPABASE_CLIENTS')).toBeUndefined();
    });
  });

  describe('MULTIPLE_API_CLIENTS', () => {
    it('detects multiple separate axios client instance files', async () => {
      await write('package.json', JSON.stringify({
        name: 'multi-api-app',
        dependencies: { axios: '^1.0.0' },
      }));
      await write('lib/api.ts', 'import axios from "axios";\nexport const api = axios.create();');
      await write('services/client.ts', 'import axios from "axios";\nexport const apiClient = axios.create();');

      const findings = await detectVibeCodeFindings(tmpDir);
      const finding = findings.find((f) => f.code === 'MULTIPLE_API_CLIENTS');

      expect(finding).toBeDefined();
      expect(finding?.evidence).toContain('lib/api.ts');
      expect(finding?.evidence).toContain('services/client.ts');
    });
  });

  describe('PLACEHOLDER_VALUE_LEFTOVER', () => {
    it('detects placeholder mock values in application source code', async () => {
      await write('package.json', JSON.stringify({ name: 'placeholder-app' }));
      await write('src/service.ts', 'const apiKey = "YOUR_API_KEY";\nconst email = "test@example.com";');

      const findings = await detectVibeCodeFindings(tmpDir);
      const finding = findings.find((f) => f.code === 'PLACEHOLDER_VALUE_LEFTOVER');

      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('low');
      expect(finding?.file).toBe('src/service.ts');
      expect(finding?.evidence).toContain('YOUR_API_KEY');
    });

    it('does not flag placeholders in tests or docs', async () => {
      await write('package.json', JSON.stringify({ name: 'test-app' }));
      await write('src/__tests__/service.test.ts', 'const dummyKey = "YOUR_API_KEY";');
      await write('README.md', 'Use test@example.com for login');

      const findings = await detectVibeCodeFindings(tmpDir);
      expect(findings.find((f) => f.code === 'PLACEHOLDER_VALUE_LEFTOVER')).toBeUndefined();
    });
  });
});
