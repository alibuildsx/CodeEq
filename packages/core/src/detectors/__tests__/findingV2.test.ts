import { describe, expect, it } from 'vitest';
import type {
  DeploymentImpact,
  Finding,
  FindingCategory,
  FindingConfidence,
  Severity,
} from '../../types/index.js';

describe('Finding V2 contract', () => {
  it('conforms to the complete Finding V2 schema', () => {
    const finding: Finding = {
      code: 'ENV_LOCAL_NOT_GITIGNORED',
      category: 'security',
      severity: 'critical',
      confidence: 'high',
      title: '.env.local is not listed in .gitignore',
      summary: '.env.local file is present but not ignored in .gitignore.',
      file: '.gitignore',
      line: undefined,
      evidence: '.env.local is present in root but missing from .gitignore patterns',
      whyItMatters: '.env.local commonly contains credentials and should not be committed.',
      remediation: 'Add .env.local to .gitignore and ensure any exposed secrets are rotated.',
      deploymentImpact: 'risk',
    };

    expect(finding.code).toBe('ENV_LOCAL_NOT_GITIGNORED');
    expect(finding.category).toBe<FindingCategory>('security');
    expect(finding.severity).toBe<Severity>('critical');
    expect(finding.confidence).toBe<FindingConfidence>('high');
    expect(finding.title).toBeTruthy();
    expect(finding.summary).toBeTruthy();
    expect(finding.file).toBe('.gitignore');
    expect(finding.evidence).toBeTruthy();
    expect(finding.whyItMatters).toBeTruthy();
    expect(finding.remediation).toBeTruthy();
    expect(finding.deploymentImpact).toBe<DeploymentImpact>('risk');
  });

  it('supports non-secret, safe evidence representation', () => {
    const finding: Finding = {
      code: 'NEXT_PUBLIC_LIKELY_SECRET',
      category: 'security',
      severity: 'high',
      confidence: 'high',
      title: 'NEXT_PUBLIC_ variable looks like a private secret: NEXT_PUBLIC_API_KEY',
      summary: '"NEXT_PUBLIC_API_KEY" is prefixed with NEXT_PUBLIC_ which exposes it to the browser bundle.',
      evidence: 'Variable name: NEXT_PUBLIC_API_KEY',
      whyItMatters: 'NEXT_PUBLIC_ variables are bundled into client-side code and exposed to anyone inspecting the browser.',
      remediation: 'Remove the NEXT_PUBLIC_ prefix or move sensitive logic to server-side code.',
      deploymentImpact: 'risk',
    };

    expect(finding.evidence).not.toContain('eyJ');
    expect(finding.evidence).toContain('NEXT_PUBLIC_API_KEY');
  });
});
