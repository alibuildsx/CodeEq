import type {
  CategoryScores,
  DeploymentReadiness,
  Finding,
  HealthBreakdown,
  Severity,
} from '../types/index.js';

const SCORE_DEDUCTIONS: Record<Severity, number> = {
  critical: 30,
  high: 20,
  medium: 10,
  low: 5,
};

export function calculateHealthScore(findings: Array<Pick<Finding, 'severity'>>): number {
  const deductions = findings.reduce(
    (total, item) => total + (SCORE_DEDUCTIONS[item.severity] ?? 0),
    0,
  );

  return Math.max(0, Math.min(100, 100 - deductions));
}

export function calculateCategoryScores(
  findings: Array<Pick<Finding, 'category' | 'severity'>>,
): CategoryScores {
  const scores: CategoryScores = {
    security: 100,
    configuration: 100,
    codeHealth: 100,
    dependencies: 100,
    deployment: 100,
  };

  for (const finding of findings) {
    const deduction = SCORE_DEDUCTIONS[finding.severity] ?? 0;
    switch (finding.category) {
      case 'security':
        scores.security = Math.max(0, scores.security - deduction);
        break;
      case 'configuration':
        scores.configuration = Math.max(0, scores.configuration - deduction);
        break;
      case 'code-health':
        scores.codeHealth = Math.max(0, scores.codeHealth - deduction);
        break;
      case 'dependencies':
        scores.dependencies = Math.max(0, scores.dependencies - deduction);
        break;
      case 'deployment':
        scores.deployment = Math.max(0, scores.deployment - deduction);
        break;
    }
  }

  return scores;
}

export function calculateHealthBreakdown(
  findings: Array<Pick<Finding, 'category' | 'severity'>>,
): HealthBreakdown {
  const overall = calculateHealthScore(findings);
  const categories = calculateCategoryScores(findings);
  return { overall, categories };
}

/**
 * Determines static deployment readiness using both deploymentImpact and severity.
 * - 'Blocked' if any finding has deploymentImpact 'blocking' OR severity 'critical'/'high'.
 * - 'Needs attention' if not blocked, and any finding has deploymentImpact 'risk' OR severity 'medium'.
 * - 'Ready' otherwise.
 */
export function calculateDeploymentReadiness(
  findings: Array<Partial<Pick<Finding, 'deploymentImpact'>> & Pick<Finding, 'severity'>>,
): DeploymentReadiness {
  if (
    findings.some(
      (item) =>
        item.deploymentImpact === 'blocking' ||
        item.severity === 'critical' ||
        item.severity === 'high',
    )
  ) {
    return 'Blocked';
  }

  if (
    findings.some(
      (item) =>
        item.deploymentImpact === 'risk' || item.severity === 'medium',
    )
  ) {
    return 'Needs attention';
  }

  return 'Ready';
}
