// ─── Severity & Health ────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type DeploymentReadiness = 'Ready' | 'Needs attention' | 'Blocked';

export interface CategoryScores {
  security: number;
  configuration: number;
  codeHealth: number;
  dependencies: number;
  deployment: number;
}

export interface HealthBreakdown {
  overall: number;
  categories: CategoryScores;
}

// ─── Finding V2 ───────────────────────────────────────────────────────────────

export type FindingCategory =
  | 'security'
  | 'configuration'
  | 'code-health'
  | 'dependencies'
  | 'deployment';

export type FindingConfidence = 'high' | 'medium' | 'low';

export type DeploymentImpact = 'blocking' | 'risk' | 'none';

export interface Finding {
  /** Stable machine-readable identifier, e.g. "ENV_NOT_GITIGNORED" */
  code: string;
  category: FindingCategory;
  severity: Severity;
  confidence: FindingConfidence;
  title: string;
  summary: string;
  file?: string;
  line?: number;
  evidence?: string;
  whyItMatters: string;
  remediation: string;
  deploymentImpact: DeploymentImpact;
}

/** Legacy alias for Finding to maintain backward compatibility during migration */
export type Issue = Finding;

// ─── Project Intelligence ─────────────────────────────────────────────────────

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export type Framework =
  | 'nextjs'
  | 'vite'
  | 'react'
  | 'express'
  | 'unknown';

export type Language = 'typescript' | 'javascript';

export type RouterType = 'app' | 'pages' | 'hybrid' | 'none';

export type DatabaseProvider =
  | 'supabase'
  | 'prisma'
  | 'drizzle'
  | 'mongodb'
  | 'firebase'
  | 'unknown'
  | 'none';

export type AuthProvider =
  | 'supabase'
  | 'clerk'
  | 'nextauth'
  | 'firebase'
  | 'unknown'
  | 'none';

export type DeploymentProvider = 'vercel' | 'netlify' | 'unknown' | 'none';

export type TestFramework = 'vitest' | 'jest' | 'playwright' | 'cypress';

export interface ProjectInfo {
  /** Value of `name` in package.json, or "(unnamed)" */
  name: string;
  packageManager: PackageManager;
  framework: Framework;
  language: Language;
  /** package.json scripts object */
  scripts: Record<string, string>;
  /** Top-level dependencies (prod + dev merged) */
  dependencies: Record<string, string>;
  // ── Router & Structure ──
  router: RouterType;
  hasSrcFolder: boolean;
  /** Relative path of app router folder found ("app" | "src/app"), null if absent */
  appRouterPath: string | null;
  /** Relative path of pages router folder found ("pages" | "src/pages"), null if absent */
  pagesRouterPath: string | null;
  hasAppRouter: boolean;
  hasPagesRouter: boolean;
  // ── File / folder presence ──
  hasEnv: boolean;
  hasEnvLocal: boolean;
  hasEnvExample: boolean;
  hasGitignore: boolean;
  hasVercelJson: boolean;
  usesSupabase: boolean;
  // ── Extended Project Intelligence (M2 CP1) ──
  database: DatabaseProvider;
  authProvider: AuthProvider;
  deploymentProvider: DeploymentProvider;
  testingFrameworks: TestFramework[];
  sourceFileCount: number;
  apiRouteCount: number;
}

// ─── Scan Result ──────────────────────────────────────────────────────────────

export interface ScanResult {
  schemaVersion: '1.0';
  /** Absolute path to the scanned directory */
  targetDir: string;
  projectInfo: ProjectInfo;
  findings: Finding[];
  health: HealthBreakdown;
  healthScore: number;
  deploymentReadiness: DeploymentReadiness;
  /** Project-relative Next.js API route file paths */
  apiRoutes: string[];
  /** Absolute path where the report was written */
  reportPath: string;
  scannedAt: string; // ISO 8601
  /** Deprecated alias pointing to findings for backwards compatibility */
  issues?: Finding[];
}
