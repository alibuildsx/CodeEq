import React from 'react';
import { CheckCircle2 } from './icons';

interface EmptyFindingsStateProps {
  isFiltered?: boolean;
}

export function EmptyFindingsState({ isFiltered = false }: EmptyFindingsStateProps) {
  return (
    <div
      style={{
        padding: '3rem 2rem',
        textAlign: 'center',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--status-healthy-bg)',
          border: '1px solid var(--status-healthy-border)',
          color: 'var(--status-healthy)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem auto',
        }}
      >
        <CheckCircle2 size={24} />
      </div>

      <h3
        style={{
          fontSize: '1.2rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
        }}
      >
        {isFiltered ? 'No matching findings' : 'No issues detected'}
      </h3>

      <p
        style={{
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
          maxWidth: '440px',
          margin: '0 auto',
          lineHeight: 1.5,
        }}
      >
        {isFiltered
          ? 'Try adjusting your severity or category filters to view other diagnostic findings.'
          : 'CodeEq did not find any problems covered by the current static checks.'}
      </p>
    </div>
  );
}
