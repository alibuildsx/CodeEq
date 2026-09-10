import type { DeploymentReadiness, Finding, Severity } from '../types/index.js';

const SCORE_DEDUCTIONS: Record<Severity, number> = {
  critical: 30,
  high: 20,
  medium: 10,
  low: 5,
};

export function calculateHealthScore(findings: Array<Pick<Finding, 'severity'>>): number {
  const deductions = findings.reduce(
    (total, item) => total + SCORE_DEDUCTIONS[item.severity],
    0,
  );

  return Math.max(0, Math.min(100, 100 - deductions));
}

export function calculateDeploymentReadiness(
  findings: Array<Pick<Finding, 'severity'>>,
): DeploymentReadiness {
  if (findings.some((item) => item.severity === 'critical' || item.severity === 'high')) {
    return 'Blocked';
  }

  if (findings.some((item) => item.severity === 'medium')) {
    return 'Needs attention';
  }

  return 'Ready';
}
