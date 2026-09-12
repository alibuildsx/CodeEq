import type {
  DeploymentReadiness,
  Finding,
  HealthBreakdown,
  ProjectInfo,
} from '@codeeq/core';

export interface RepositoryIdentityDto {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
}

export interface SanitizedScanDto {
  schemaVersion: '1.0';
  projectInfo: ProjectInfo;
  health: HealthBreakdown;
  healthScore: number;
  deploymentReadiness: DeploymentReadiness;
  findings: Finding[];
  apiRoutes: string[];
  scannedAt: string;
}

export interface RepositoryScanResponse {
  repository: RepositoryIdentityDto;
  scan: SanitizedScanDto;
}
