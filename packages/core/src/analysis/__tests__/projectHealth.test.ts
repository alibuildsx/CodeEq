import { describe, expect, it } from 'vitest';
import {
  calculateCategoryScores,
  calculateDeploymentReadiness,
  calculateHealthBreakdown,
  calculateHealthScore,
} from '../projectHealth.js';
import type { Finding } from '../../types/index.js';

function issue(
  severity: Finding['severity'],
  deploymentImpact: Finding['deploymentImpact'] = 'none',
  category: Finding['category'] = 'code-health',
): Pick<Finding, 'severity' | 'deploymentImpact' | 'category'> {
  return { severity, deploymentImpact, category };
}

describe('calculateHealthScore', () => {
  it('deducts the configured weight for each issue severity', () => {
    const issues = [issue('critical'), issue('high'), issue('medium'), issue('low')];

    expect(calculateHealthScore(issues)).toBe(35);
  });

  it('never returns a score below zero', () => {
    expect(
      calculateHealthScore([
        issue('critical'),
        issue('critical'),
        issue('critical'),
        issue('critical'),
      ]),
    ).toBe(0);
  });
});

describe('calculateCategoryScores and calculateHealthBreakdown', () => {
  it('calculates independent scores per category and overall breakdown', () => {
    const findings = [
      issue('critical', 'blocking', 'security'), // 100 - 30 = 70
      issue('high', 'risk', 'configuration'),    // 100 - 20 = 80
      issue('medium', 'risk', 'code-health'),     // 100 - 10 = 90
      issue('low', 'none', 'dependencies'),      // 100 - 5 = 95
    ];

    const breakdown = calculateHealthBreakdown(findings);

    expect(breakdown.overall).toBe(35);
    expect(breakdown.categories).toEqual({
      security: 70,
      configuration: 80,
      codeHealth: 90,
      dependencies: 95,
      deployment: 100,
    });
  });
});

describe('calculateDeploymentReadiness', () => {
  it.each([
    [[issue('critical')], 'Blocked'],
    [[issue('high')], 'Blocked'],
    [[issue('medium')], 'Needs attention'],
    [[issue('low')], 'Ready'],
    [[], 'Ready'],
    // Semantic fix: blocking deploymentImpact blocks even on medium severity
    [[issue('medium', 'blocking', 'deployment')], 'Blocked'],
    // Semantic fix: risk deploymentImpact triggers Needs attention even on low severity
    [[issue('low', 'risk', 'deployment')], 'Needs attention'],
  ] as const)('maps issues to the expected readiness state', (issues, expected) => {
    expect(calculateDeploymentReadiness([...issues])).toBe(expected);
  });
});
