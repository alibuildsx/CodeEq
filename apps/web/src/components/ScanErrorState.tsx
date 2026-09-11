import React from 'react';
import { AlertTriangle, X } from './icons';

interface ScanErrorStateProps {
  error: {
    code: string;
    message: string;
  };
  onDismiss?: () => void;
}

export function ScanErrorState({ error, onDismiss }: ScanErrorStateProps) {
  const getFriendlyMessage = (code: string, fallback: string) => {
    switch (code) {
      case 'INVALID_GITHUB_URL':
        return 'Please enter a valid public GitHub repository URL (e.g. https://github.com/owner/repo).';
      case 'REPOSITORY_NOT_ACCESSIBLE':
        return 'CodeEq could not access this repository. Please make sure it exists, is spelled correctly, and is publicly visible.';
      case 'GITHUB_RATE_LIMITED':
        return 'GitHub is temporarily rate limiting unauthenticated public requests. Please try again in a few moments.';
      case 'REPOSITORY_TOO_LARGE':
        return 'This repository exceeds the online scanner limit (15MB compressed / 75MB extracted). Use the local CodeEq CLI for large codebases.';
      case 'ARCHIVE_DOWNLOAD_FAILED':
        return 'Failed to download the repository archive from GitHub. Please verify repository availability and try again.';
      case 'SCAN_TIMEOUT':
        return 'The repository scan timed out. The codebase may be too large or complex for the web scanner.';
      case 'SCAN_FAILED':
      default:
        return fallback || 'An unexpected error occurred while analyzing the repository. Please try again.';
    }
  };

  const message = getFriendlyMessage(error.code, error.message);

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '1rem 1.25rem',
        backgroundColor: 'var(--status-critical-bg)',
        border: '1px solid var(--status-critical-border)',
        borderRadius: '8px',
        color: 'var(--text-primary)',
        margin: '1.5rem auto 0 auto',
        maxWidth: '720px',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ color: 'var(--status-critical)', marginTop: '2px' }}>
          <AlertTriangle size={18} />
        </div>
        <div>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--status-critical)',
              marginBottom: '0.25rem',
            }}
          >
            {error.code.replace(/_/g, ' ')}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {message}
          </p>
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: '4px',
            color: 'var(--text-muted)',
            borderRadius: '4px',
          }}
          aria-label="Dismiss error"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
