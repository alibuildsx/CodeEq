import React from 'react';
import type { Finding } from '@codeeq/core';
import { AlertCircle, AlertTriangle, Info, Shield } from './icons';

interface SeveritySummaryBarProps {
  findings: Finding[];
  activeSeverity?: string | null;
  onSelectSeverity?: (severity: string | null) => void;
}

export function SeveritySummaryBar({
  findings,
  activeSeverity = null,
  onSelectSeverity,
}: SeveritySummaryBarProps) {
  const counts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
  };

  const items = [
    {
      id: 'critical',
      label: 'Critical',
      count: counts.critical,
      color: 'var(--status-critical)',
      bg: 'var(--status-critical-bg)',
      border: 'var(--status-critical-border)',
      icon: <AlertCircle size={14} />,
    },
    {
      id: 'high',
      label: 'High',
      count: counts.high,
      color: 'var(--status-high)',
      bg: 'var(--status-high-bg)',
      border: 'var(--status-high-border)',
      icon: <AlertTriangle size={14} />,
    },
    {
      id: 'medium',
      label: 'Medium',
      count: counts.medium,
      color: 'var(--status-medium)',
      bg: 'var(--status-medium-bg)',
      border: 'var(--status-medium-border)',
      icon: <AlertTriangle size={14} />,
    },
    {
      id: 'low',
      label: 'Low',
      count: counts.low,
      color: 'var(--status-low)',
      bg: 'var(--status-low-bg)',
      border: 'var(--status-low-border)',
      icon: <Info size={14} />,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.875rem 1.25rem',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        marginBottom: '1.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginRight: '0.5rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <Shield size={14} />
        <span>Findings: {findings.length}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {items.map((item) => {
          const isSelected = activeSeverity === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (onSelectSeverity) {
                  onSelectSeverity(isSelected ? null : item.id);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: isSelected ? item.bg : 'var(--bg-surface-elevated)',
                border: `1px solid ${isSelected ? item.color : 'var(--border-default)'}`,
                color: item.color,
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: onSelectSeverity ? 'pointer' : 'default',
                transition: 'all var(--transition-fast)',
              }}
            >
              {item.icon}
              <span>{item.count} {item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
