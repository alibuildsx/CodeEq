import { describe, expect, it } from 'vitest';
import { calculateDeploymentReadiness, calculateHealthScore } from '../projectHealth.js';
import type { Issue } from '../../types/index.js';

function issue(severity: Issue['severity']): Issue {
  return { code: severity.toUpperCase(), severity, title: severity };
}

describe('calculateHealthScore', () => {
  it('deducts the configured weight for each issue severity', () => {
    const issues = [issue('critical'), issue('high'), issue('medium'), issue('low')];

    expect(calculateHealthScore(issues)).toBe(35);
  });

  it('never returns a score below zero', () => {
    expect(calculateHealthScore([issue('critical'), issue('critical'), issue('critical'), issue('critical')])).toBe(0);
  });
});

describe('calculateDeploymentReadiness', () => {
  it.each([
    [[issue('critical')], 'Blocked'],
    [[issue('high')], 'Blocked'],
    [[issue('medium')], 'Needs attention'],
    [[issue('low')], 'Ready'],
    [[], 'Ready'],
  ] as const)('maps issues to the expected readiness state', (issues, expected) => {
    expect(calculateDeploymentReadiness([...issues])).toBe(expected);
  });
});
