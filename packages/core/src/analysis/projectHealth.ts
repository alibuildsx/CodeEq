import type {
  CategoryScores,
  DeploymentReadiness,
  Finding,
  HealthBreakdown,
  Severity,
} from '../types/index.js';


export const SEVERITY_DEDUCTIONS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

export const CATEGORY_WEIGHTS = {
  security: 0.30,
  configuration: 0.20,
  codeHealth: 0.25,
  dependencies: 0.15,
  deployment: 0.10,
} as const;

export const DEPLOYMENT_IMPACT_CROSS_DEDUCTIONS = {
  blocking: 15,
  risk: 8,
  none: 0,
} as const;

export function calculateCategoryScores(
  findings: Array<Pick<Finding, 'category' | 'severity'> & Partial<Pick<Finding, 'deploymentImpact'>>>,
): CategoryScores {
  const scores: CategoryScores = {
    security: 100,
    configuration: 100,
    codeHealth: 100,
    dependencies: 100,
    deployment: 100,
  };

  for (const finding of findings) {
    const deduction = SEVERITY_DEDUCTIONS[finding.severity] ?? 0;
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

    // Findings from non-deployment categories that have deployment impact also deduct from deployment score
    if (finding.category && finding.category !== 'deployment') {
      const impactDeduction =
        finding.deploymentImpact === 'blocking'
          ? DEPLOYMENT_IMPACT_CROSS_DEDUCTIONS.blocking
          : finding.deploymentImpact === 'risk'
            ? DEPLOYMENT_IMPACT_CROSS_DEDUCTIONS.risk
            : 0;
      if (impactDeduction > 0) {
        scores.deployment = Math.max(0, scores.deployment - impactDeduction);
      }
    }
  }

  return scores;
}

export function calculateHealthScore(
  findings: Array<Partial<Pick<Finding, 'category' | 'deploymentImpact'>> & Pick<Finding, 'severity'>>,
): number {
  // If findings have category information, compute the canonical weighted score
  const hasCategory = findings.some((f) => f.category !== undefined);
  if (hasCategory) {
    const categories = calculateCategoryScores(
      findings as Array<Pick<Finding, 'category' | 'severity'> & Partial<Pick<Finding, 'deploymentImpact'>>>,
    );
    const weighted =
      categories.security * CATEGORY_WEIGHTS.security +
      categories.configuration * CATEGORY_WEIGHTS.configuration +
      categories.codeHealth * CATEGORY_WEIGHTS.codeHealth +
      categories.dependencies * CATEGORY_WEIGHTS.dependencies +
      categories.deployment * CATEGORY_WEIGHTS.deployment;

    return Math.max(0, Math.min(100, Math.round(weighted)));
  }

  // Fallback for raw severity-only inputs (legacy compatibility)
  const deductions = findings.reduce(
    (total, item) => total + (SEVERITY_DEDUCTIONS[item.severity] ?? 0),
    0,
  );

  return Math.max(0, Math.min(100, 100 - deductions));
}

export function calculateHealthBreakdown(
  findings: Array<Pick<Finding, 'category' | 'severity'> & Partial<Pick<Finding, 'deploymentImpact'>>>,
): HealthBreakdown {
  const categories = calculateCategoryScores(findings);
  const weighted =
    categories.security * CATEGORY_WEIGHTS.security +
    categories.configuration * CATEGORY_WEIGHTS.configuration +
    categories.codeHealth * CATEGORY_WEIGHTS.codeHealth +
    categories.dependencies * CATEGORY_WEIGHTS.dependencies +
    categories.deployment * CATEGORY_WEIGHTS.deployment;

  const overall = Math.max(0, Math.min(100, Math.round(weighted)));
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

