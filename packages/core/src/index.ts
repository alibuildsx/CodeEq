// Public API for @codeeq/core

export { scanProject } from './scanners/projectScanner.js';
export { generateMarkdownReport } from './reports/markdownReport.js';
export {
  calculateDeploymentReadiness,
  calculateHealthScore,
  calculateCategoryScores,
  calculateHealthBreakdown,
} from './analysis/projectHealth.js';

// Types
export type {
  ScanResult,
  ProjectInfo,
  Finding,
  FindingCategory,
  FindingConfidence,
  DeploymentImpact,
  CategoryScores,
  HealthBreakdown,
  Issue,
  Severity,
  PackageManager,
  Framework,
  Language,
  RouterType,
  DatabaseProvider,
  AuthProvider,
  DeploymentProvider,
  TestFramework,
  DeploymentReadiness,
} from './types/index.js';

// Detectors
export { readPackageJson, mergeDependencies, detectPackageManager } from './detectors/packageJson.js';
export { detectFramework, hasNextConfig } from './detectors/framework.js';
export { detectFilePresence, type FilePresenceResult } from './detectors/filePresence.js';
export { detectSupabase } from './detectors/supabase.js';
export { detectEnvSafety } from './detectors/envSafety.js';
export { detectApiRoutes } from './detectors/apiRoutes.js';
export {
  detectRouter,
  detectDatabase,
  detectAuthProvider,
  detectDeploymentProvider,
  detectTestingFrameworks,
  countSourceFiles,
} from './detectors/projectIntelligence.js';
export { detectSecurityFindings } from './detectors/security.js';
export { detectConfigurationFindings } from './detectors/configuration.js';
export { detectCodeHealthFindings } from './detectors/codeHealth.js';
export { detectDependencyFindings } from './detectors/dependencies.js';
export { detectVibeCodeFindings } from './detectors/vibeCode.js';
