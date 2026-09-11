import React from 'react';
import type { ProjectInfo } from '@codeeq/core';
import {
  formatAuth,
  formatDatabase,
  formatDeploymentProvider,
  formatFramework,
  formatLanguage,
  formatPackageManager,
  formatRouter,
  formatTestingFrameworks,
} from '../lib/formatters/labels';

interface ProjectOverviewProps {
  projectInfo: ProjectInfo;
}

export function ProjectOverview({ projectInfo }: ProjectOverviewProps) {
  const items = [
    { label: 'Framework', value: formatFramework(projectInfo.framework) },
    { label: 'Language', value: formatLanguage(projectInfo.language) },
    { label: 'Router', value: formatRouter(projectInfo.router) },
    { label: 'Package Manager', value: formatPackageManager(projectInfo.packageManager) },
    { label: 'Database', value: formatDatabase(projectInfo.database) },
    { label: 'Authentication', value: formatAuth(projectInfo.authProvider) },
    { label: 'Deployment', value: formatDeploymentProvider(projectInfo.deploymentProvider) },
    { label: 'Testing', value: formatTestingFrameworks(projectInfo.testingFrameworks) },
    { label: 'API Routes', value: String(projectInfo.apiRouteCount ?? 0) },
    { label: 'Source Files', value: String(projectInfo.sourceFileCount ?? 0) },
  ];

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
          }}
        >
          Project Intelligence Overview
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: '1.25rem 1.5rem',
        }}
      >
        {items.map((item) => (
          <div key={item.label}>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: '0.925rem',
                fontWeight: 600,
                color: item.value === 'Not detected' || item.value === 'None detected'
                  ? 'var(--text-muted)'
                  : 'var(--text-primary)',
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
