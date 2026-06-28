// ─── Severity ────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low';

// ─── Issue ────────────────────────────────────────────────────────────────────

export interface Issue {
  /** Stable machine-readable identifier, e.g. "ENV_NOT_GITIGNORED" */
  code: string;
  severity: Severity;
  title: string;
  detail?: string;
}

// ─── Project Info ─────────────────────────────────────────────────────────────

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export type Framework =
  | 'nextjs'
  | 'vite'
  | 'react'
  | 'express'
  | 'unknown';

export type Language = 'typescript' | 'javascript';

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
  // ── File / folder presence ──
  hasSrcFolder: boolean;
  /** Relative path of app router folder found ("app" | "src/app"), null if absent */
  appRouterPath: string | null;
  /** Relative path of pages router folder found ("pages" | "src/pages"), null if absent */
  pagesRouterPath: string | null;
  hasAppRouter: boolean;
  hasPagesRouter: boolean;
  hasEnv: boolean;
  hasEnvLocal: boolean;
  hasEnvExample: boolean;
  hasGitignore: boolean;
  hasVercelJson: boolean;
  usesSupabase: boolean;
}

// ─── Scan Result ──────────────────────────────────────────────────────────────

export interface ScanResult {
  /** Absolute path to the scanned directory */
  targetDir: string;
  projectInfo: ProjectInfo;
  issues: Issue[];
  /** Absolute path where the report was written */
  reportPath: string;
  scannedAt: string; // ISO 8601
}
