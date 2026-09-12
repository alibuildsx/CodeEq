import React from 'react';
import type { DeploymentReadiness } from '@codeeq/core';
import { AlertCircle, AlertTriangle, CheckCircle2 } from './icons';

interface OverallHealthProps {
  score: number;
  readiness: DeploymentReadiness;
}

export function OverallHealth({ score, readiness }: OverallHealthProps) {
  let readinessColor = 'var(--status-healthy)';
  let readinessBg = 'var(--status-healthy-bg)';
  let readinessBorder = 'var(--status-healthy-border)';
  let readinessIcon = <CheckCircle2 size={16} />;
  let explanation = 'No blocking static issues were detected.';

  if (readiness === 'Needs attention') {
    readinessColor = 'var(--status-high)';
    readinessBg = 'var(--status-high-bg)';
    readinessBorder = 'var(--status-high-border)';
    readinessIcon = <AlertTriangle size={16} />;
    explanation = 'CodeEq found issues worth reviewing before deployment.';
  } else if (readiness === 'Blocked') {
    readinessColor = 'var(--status-critical)';
    readinessBg = 'var(--status-critical-bg)';
    readinessBorder = 'var(--status-critical-border)';
    readinessIcon = <AlertCircle size={16} />;
    explanation = 'CodeEq found issues likely to block or seriously affect deployment.';
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
          }}
        >
          Project Health
        </span>

        {/* Readiness Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '3px 10px',
            borderRadius: '20px',
            backgroundColor: readinessBg,
            border: `1px solid ${readinessBorder}`,
            color: readinessColor,
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {readinessIcon}
          <span>{readiness}</span>
        </div>
      </div>

      {/* Score Number Display */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem', margin: '0.5rem 0' }}>
        <span
          style={{
            fontSize: '3.5rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            color: readinessColor,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {score}
        </span>
        <span
          style={{
            fontSize: '1.2rem',
            color: 'var(--text-muted)',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
          }}
        >
          / 100
        </span>
      </div>

      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginTop: '0.75rem',
        }}
      >
        {explanation}
      </p>
    </div>
  );
}
