import React, { useEffect } from 'react';
import type { Finding } from '@codeeq/core';
import { formatCategory, formatSeverity } from '../lib/formatters/labels';
import {
  AlertCircle,
  AlertTriangle,
  FileCode,
  Info,
  Shield,
  X,
} from './icons';

interface FindingDrawerProps {
  finding: Finding | null;
  onClose: () => void;
}

export function FindingDrawer({ finding, onClose }: FindingDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!finding) return null;

  const getSeverityBadge = (sev: string) => {
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

  const sevMeta = getSeverityBadge(finding.severity);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer Panel */}
      <aside
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '540px',
          height: '100%',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 51,
          overflowY: 'auto',
        }}
        className="animate-slide-in"
      >
        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-default)',
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--bg-surface)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {finding.code}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-surface-elevated)',
            }}
            aria-label="Close diagnosis drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Title & Badges */}
          <div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: sevMeta.bg,
                  border: `1px solid ${sevMeta.border}`,
                  color: sevMeta.color,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {sevMeta.icon}
                <span>{formatSeverity(finding.severity)}</span>
              </span>

              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                {formatCategory(finding.category)}
              </span>

              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Confidence: {formatSeverity(finding.confidence)}
              </span>
            </div>

            <h2
              id="drawer-title"
              style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                letterSpacing: '-0.02em',
              }}
            >
              {finding.title}
            </h2>
          </div>

          {/* Location */}
          {finding.file && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
              }}
            >
              <FileCode size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ wordBreak: 'break-all' }}>
                {finding.file}
                {finding.line !== undefined ? `:${finding.line}` : ''}
              </span>
            </div>
          )}

          {/* Summary */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                marginBottom: '0.375rem',
              }}
            >
              Summary
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {finding.summary}
            </p>
          </div>

          {/* Evidence */}
          {finding.evidence && (
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                  marginBottom: '0.375rem',
                }}
              >
                Evidence
              </div>
              <pre
                style={{
                  padding: '0.875rem 1rem',
                  backgroundColor: 'var(--bg-page)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {finding.evidence}
              </pre>
            </div>
          )}

          {/* Why It Matters */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                marginBottom: '0.375rem',
              }}
            >
              Why This Matters
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {finding.whyItMatters}
            </p>
          </div>

          {/* Deployment Impact */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                marginBottom: '0.375rem',
              }}
            >
              Deployment Impact
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor:
                  finding.deploymentImpact === 'blocking'
                    ? 'var(--status-critical-bg)'
                    : finding.deploymentImpact === 'risk'
                    ? 'var(--status-high-bg)'
                    : 'var(--bg-surface-elevated)',
                border: `1px solid ${
                  finding.deploymentImpact === 'blocking'
                    ? 'var(--status-critical-border)'
                    : finding.deploymentImpact === 'risk'
                    ? 'var(--status-high-border)'
                    : 'var(--border-default)'
                }`,
                color:
                  finding.deploymentImpact === 'blocking'
                    ? 'var(--status-critical)'
                    : finding.deploymentImpact === 'risk'
                    ? 'var(--status-high)'
                    : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              <Shield size={13} />
              <span>{finding.deploymentImpact}</span>
            </div>
          </div>

          {/* Recommended Fix */}
          <div
            style={{
              padding: '1.25rem',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}
            >
              Recommended Fix
            </div>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              {finding.remediation}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
