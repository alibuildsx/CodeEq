import { describe, expect, it } from 'vitest';
import {
  CATEGORY_WEIGHTS,
  calculateCategoryScores,
  calculateDeploymentReadiness,
  calculateHealthBreakdown,
  calculateHealthScore,
  DEPLOYMENT_IMPACT_CROSS_DEDUCTIONS,
  SEVERITY_DEDUCTIONS,
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
  it('deducts the configured weight for each issue severity (fallback mode: 25+15+8+3 = 51 deduction -> 49)', () => {
    const issues = [
      { severity: 'critical' as const },
      { severity: 'high' as const },
      { severity: 'medium' as const },
      { severity: 'low' as const },
    ];

    expect(calculateHealthScore(issues)).toBe(49);
  });

  it('never returns a score below zero', () => {
    expect(
      calculateHealthScore([
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'critical' },
      ]),
    ).toBe(0);
  });

  it('healthy project without findings returns 100', () => {
    expect(calculateHealthScore([])).toBe(100);
  });
});

describe('calculateCategoryScores and calculateHealthBreakdown', () => {
  it('calculates independent scores per category and weighted overall breakdown', () => {
    const findings = [
      issue('critical', 'blocking', 'security'),    // security: 100 - 25 = 75, deployment: -15
      issue('high', 'risk', 'configuration'),       // config: 100 - 15 = 85, deployment: -8
      issue('medium', 'none', 'code-health'),       // codeHealth: 100 - 8 = 92
      issue('low', 'none', 'dependencies'),         // dependencies: 100 - 3 = 97
      issue('low', 'none', 'deployment'),           // deployment: 100 - 3 - 15 - 8 = 74
    ];

    const breakdown = calculateHealthBreakdown(findings);

    expect(breakdown.categories).toEqual({
      security: 75,
      configuration: 85,
      codeHealth: 92,
      dependencies: 97,
      deployment: 74,
    });

    // Weighted overall calculation:
    // 75 * 0.30 = 22.5
    // 85 * 0.20 = 17.0
    // 92 * 0.25 = 23.0
    // 97 * 0.15 = 14.55
    // 74 * 0.10 = 7.4
    // sum = 84.45 -> Math.round is 84
    expect(breakdown.overall).toBe(84);
  });

  it('is order-invariant and deterministic', () => {
    const f1 = [
      issue('critical', 'blocking', 'security'),
      issue('high', 'none', 'code-health'),
      issue('medium', 'risk', 'configuration'),
    ];
    const f2 = [
      issue('medium', 'risk', 'configuration'),
      issue('critical', 'blocking', 'security'),
      issue('high', 'none', 'code-health'),
    ];

    const b1 = calculateHealthBreakdown(f1);
    const b2 = calculateHealthBreakdown(f2);

    expect(b1).toEqual(b2);
  });

  it('clamps all category scores between 0 and 100', () => {
    const findings = Array.from({ length: 10 }, () => issue('critical', 'blocking', 'security'));
    const breakdown = calculateHealthBreakdown(findings);

    expect(breakdown.categories.security).toBe(0);
    expect(breakdown.categories.deployment).toBe(0);
    expect(breakdown.overall).toBe(60); // Other categories are 100: 0*0.3 + 100*0.2 + 100*0.25 + 100*0.15 + 0*0.1 = 60
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

