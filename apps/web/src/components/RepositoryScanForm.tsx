import React, { useState } from 'react';
import { CANONICAL_DEMO_REPO } from '../lib/fixtures/mockResults';
import { ArrowRight, Search, Shield } from './icons';

import { FrontendScanError } from '../lib/errors';
import { normalizeRepositoryInput } from '../lib/github/urlNormalizer';

interface RepositoryScanFormProps {
  initialUrl?: string;
  isScanning?: boolean;
  onScan: (url: string) => void;
}

export function RepositoryScanForm({
  initialUrl = '',
  isScanning = false,
  onScan,
}: RepositoryScanFormProps) {
  const [url, setUrl] = useState(initialUrl);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isScanning) return;

    try {
      const normalized = normalizeRepositoryInput(url);
      setValidationError(null);
      onScan(normalized);
    } catch (err: unknown) {
      if (err instanceof FrontendScanError) {
        setValidationError(err.message);
      } else {
        setValidationError('Please enter a valid GitHub repository URL or owner/repo shorthand');
      }
    }
  };

  const handleDemoClick = () => {
    setUrl(CANONICAL_DEMO_REPO);
    setValidationError(null);
    onScan(CANONICAL_DEMO_REPO);
  };

  return (
    <section
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '3rem 1.5rem 2rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '4px 10px',
          borderRadius: '20px',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
          marginBottom: '1.25rem',
        }}
      >
        <Shield size={14} style={{ color: 'var(--status-healthy)' }} />
        <span>Your Vibe Coding Doctor</span>
      </div>

      <h1
        style={{
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
        }}
      >
        Balance your AI-built code.
      </h1>

      <p
        style={{
          fontSize: '1.05rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '560px',
          margin: '0 auto 2rem auto',
        }}
      >
        Scan any public GitHub repository for security, configuration,
        dependency, and code-health problems before you ship.
      </p>

      <form onSubmit={handleSubmit} style={{ position: 'relative', marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${validationError ? 'var(--status-critical)' : 'var(--border-default)'}`,
            borderRadius: '10px',
            padding: '4px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            transition: 'border-color var(--transition-fast)',
          }}
        >
          <div style={{ padding: '0 0.875rem', color: 'var(--text-muted)' }}>
            <Search size={18} />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="https://github.com/owner/repo or owner/repo"
            aria-label="GitHub Repository URL"
            disabled={isScanning}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              padding: '0.75rem 0',
            }}
          />
          <button
            type="submit"
            disabled={isScanning}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              backgroundColor: isScanning ? 'var(--bg-surface-elevated)' : 'var(--text-primary)',
              color: isScanning ? 'var(--text-muted)' : 'var(--bg-page)',
              fontWeight: 600,
              fontSize: '0.9rem',
              borderRadius: '8px',
              transition: 'opacity var(--transition-fast)',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{isScanning ? 'Scanning...' : 'Scan Repository'}</span>
            {!isScanning && <ArrowRight size={15} />}
          </button>
        </div>

        {validationError && (
          <div
            style={{
              color: 'var(--status-critical)',
              fontSize: '0.85rem',
              textAlign: 'left',
              marginTop: '0.5rem',
              paddingLeft: '0.5rem',
            }}
          >
            {validationError}
          </div>
        )}
      </form>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          marginTop: '1.25rem',
        }}
      >
        <button
          type="button"
          onClick={handleDemoClick}
          disabled={isScanning}
          style={{
            color: 'var(--text-link)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            fontSize: '0.85rem',
          }}
        >
          Try demo repository (octocat/Hello-World)
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Shield size={13} style={{ color: 'var(--text-muted)' }} />
          <span>Static analysis only — never executes repository code</span>
        </div>
      </div>
    </section>
  );
}
