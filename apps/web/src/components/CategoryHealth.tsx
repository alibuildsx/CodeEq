import React from 'react';
import type { CategoryScores } from '@codeeq/core';
import { formatCategory } from '../lib/formatters/labels';

interface CategoryHealthProps {
  categories: CategoryScores;
}

const CATEGORY_KEYS: Array<keyof CategoryScores> = [
  'security',
  'configuration',
  'codeHealth',
  'dependencies',
  'deployment',
];

export function CategoryHealth({ categories }: CategoryHealthProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'var(--status-healthy)';
    if (score >= 75) return 'var(--status-medium)';
    if (score >= 50) return 'var(--status-high)';
    return 'var(--status-critical)';
  };

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
          Category Breakdown
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {CATEGORY_KEYS.map((key) => {
          const score = categories[key] ?? 100;
          const color = getScoreColor(score);
          const label =
            key === 'codeHealth' ? 'Code Health' : formatCategory(key);

          return (
            <div key={key}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.375rem',
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: color,
                    fontWeight: 600,
                  }}
                >
                  {score}
                </span>
              </div>

              {/* Progress Track */}
              <div
                style={{
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(0, Math.min(100, score))}%`,
                    backgroundColor: color,
                    borderRadius: '3px',
                    transition: 'width 0.5s ease-out',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
