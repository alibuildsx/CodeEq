import React from 'react';
import { formatFramework, formatLanguage, formatPackageManager } from '../lib/formatters/labels';
import type { RepositoryScanResponse } from '../lib/scanner/types';
import { ExternalLink, GithubIcon, RefreshCw, Search } from './icons';

interface ResultsHeaderProps {
  data: RepositoryScanResponse;
  onRescan: () => void;
  onNewScan: () => void;
  isRescanning?: boolean;
}

export function ResultsHeader({
  data,
  onRescan,
  onNewScan,
  isRescanning = false,
}: ResultsHeaderProps) {
  const { repository, scan } = data;
  const { projectInfo } = scan;

  const stackPills: string[] = [];

  const framework = formatFramework(projectInfo.framework);
  if (framework !== 'Not detected') stackPills.push(framework);

  const lang = formatLanguage(projectInfo.language);
  if (lang !== 'Not detected') stackPills.push(lang);

  const pm = formatPackageManager(projectInfo.packageManager);
  if (pm !== 'Not detected') stackPills.push(pm);

  return (
    <section
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.25rem',
        padding: '1.5rem 0',
        borderBottom: '1px solid var(--border-default)',
        marginBottom: '2rem',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            {repository.owner} / {repository.name}
          </h1>

          <a
            href={repository.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-surface-elevated)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}
            aria-label="View on GitHub"
          >
            <GithubIcon size={13} />
            <span>GitHub</span>
            <ExternalLink size={11} style={{ color: 'var(--text-muted)' }} />
          </a>
        </div>

        {/* Stack badges & branch info */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            branch: {repository.defaultBranch}
          </span>

          {stackPills.map((pill) => (
            <span
              key={pill}
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}
            >
              {pill}
            </span>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onRescan}
          disabled={isRescanning}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 0.875rem',
            borderRadius: '6px',
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: isRescanning ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={14} className={isRescanning ? 'animate-spin' : ''} />
          <span>{isRescanning ? 'Rescanning...' : 'Rescan'}</span>
        </button>

        <button
          type="button"
          onClick={onNewScan}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 0.875rem',
            borderRadius: '6px',
            backgroundColor: 'var(--text-primary)',
            color: 'var(--bg-page)',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <Search size={14} />
          <span>Scan another</span>
        </button>
      </div>
    </section>
  );
}
