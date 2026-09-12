import React from 'react';
import type { Finding } from '@codeeq/core';
import { formatCategory, formatSeverity } from '../lib/formatters/labels';
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  FileCode,
  Info,
} from './icons';

interface FindingCardProps {
  finding: Finding;
  isSelected?: boolean;
  onSelect: (finding: Finding) => void;
}

export function FindingCard({ finding, isSelected = false, onSelect }: FindingCardProps) {
  const getSeverityMeta = (sev: string) => {
    switch (sev) {
      case 'critical':
        return {
          color: 'var(--status-critical)',
          bg: 'var(--status-critical-bg)',
          border: 'var(--status-critical-border)',
          icon: <AlertCircle size={14} />,
        };
      case 'high':
        return {
          color: 'var(--status-high)',
          bg: 'var(--status-high-bg)',
          border: 'var(--status-high-border)',
          icon: <AlertTriangle size={14} />,
        };
      case 'medium':
        return {
          color: 'var(--status-medium)',
          bg: 'var(--status-medium-bg)',
          border: 'var(--status-medium-border)',
          icon: <AlertTriangle size={14} />,
        };
      case 'low':
      default:
        return {
          color: 'var(--status-low)',
          bg: 'var(--status-low-bg)',
          border: 'var(--status-low-border)',
          icon: <Info size={14} />,
        };
    }
  };

  const meta = getSeverityMeta(finding.severity);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(finding)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(finding);
        }
      }}
      style={{
        backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
        border: `1px solid ${isSelected ? 'var(--border-focus)' : 'var(--border-default)'}`,
        borderRadius: '8px',
        padding: '1.25rem',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-default)';
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.625rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Severity Badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: meta.bg,
              border: `1px solid ${meta.border}`,
              color: meta.color,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            {meta.icon}
            <span>{formatSeverity(finding.severity)}</span>
          </span>

          {/* Category Pill */}
          <span
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
            {formatCategory(finding.category)}
          </span>

          {/* Confidence Badge */}
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
            }}
          >
            Confidence: {formatSeverity(finding.confidence)}
          </span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.8rem',
            color: 'var(--text-link)',
            fontWeight: 500,
          }}
        >
          <span>View diagnosis</span>
          <ChevronRight size={14} />
        </div>
      </div>

      {/* Finding Title */}
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
          lineHeight: 1.4,
        }}
      >
        {finding.title}
      </h3>

      {/* Finding Summary */}
      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: '0.75rem',
        }}
      >
        {finding.summary}
      </p>

      {/* File / Location */}
      {finding.file && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-surface-elevated)',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <FileCode size={13} />
          <span>
            {finding.file}
            {finding.line !== undefined ? `:${finding.line}` : ''}
          </span>
        </div>
      )}
    </article>
  );
}
