import type { DeploymentReadiness, Issue, Severity } from '../types/index.js';

const SCORE_DEDUCTIONS: Record<Severity, number> = {
  critical: 30,
  high: 20,
  medium: 10,
  low: 5,
};

export function calculateHealthScore(issues: Issue[]): number {
  const deductions = issues.reduce(
    (total, issue) => total + SCORE_DEDUCTIONS[issue.severity],
    0,
  );

  return Math.max(0, Math.min(100, 100 - deductions));
}

export function calculateDeploymentReadiness(
  issues: Issue[],
): DeploymentReadiness {
  if (issues.some((issue) => issue.severity === 'critical' || issue.severity === 'high')) {
    return 'Blocked';
  }

  if (issues.some((issue) => issue.severity === 'medium')) {
    return 'Needs attention';
  }

  return 'Ready';
}
