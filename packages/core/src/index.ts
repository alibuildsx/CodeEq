// Public API for @codeeq/core

export { scanProject } from './scanners/projectScanner.js';
export { generateMarkdownReport } from './reports/markdownReport.js';
export { calculateDeploymentReadiness, calculateHealthScore } from './analysis/projectHealth.js';

// Types
export type {
  ScanResult,
  ProjectInfo,
  Issue,
  Severity,
  PackageManager,
  Framework,
  Language,
  DeploymentReadiness,
} from './types/index.js';

// Detectors (exported for testing and future extension)
export { readPackageJson, mergeDependencies, detectPackageManager } from './detectors/packageJson.js';
export { detectFramework, hasNextConfig } from './detectors/framework.js';
export { detectFilePresence, type FilePresenceResult } from './detectors/filePresence.js';
export { detectSupabase } from './detectors/supabase.js';
export { detectEnvSafety } from './detectors/envSafety.js';
export { detectApiRoutes } from './detectors/apiRoutes.js';
