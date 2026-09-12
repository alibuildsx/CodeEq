import React from 'react';
import { Search, X } from './icons';

interface FindingsToolbarProps {
  totalCount: number;
  filteredCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedSeverity: string | null;
  onSelectSeverity: (s: string | null) => void;
  selectedCategory: string | null;
  onSelectCategory: (c: string | null) => void;
  onResetFilters: () => void;
}

const SEVERITIES = [
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

const CATEGORIES = [
  { id: 'security', label: 'Security' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'code-health', label: 'Code Health' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'deployment', label: 'Deployment' },
];

export function FindingsToolbar({
  totalCount,
  filteredCount,
  searchQuery,
  onSearchChange,
  selectedSeverity,
  onSelectSeverity,
  selectedCategory,
  onSelectCategory,
  onResetFilters,
}: FindingsToolbarProps) {
  const hasActiveFilters = Boolean(
    selectedSeverity || selectedCategory || searchQuery.trim()
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
        padding: '1rem 1.25rem',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Diagnostics ({filteredCount} of {totalCount})
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                color: 'var(--text-link)',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-surface-elevated)',
              }}
            >
              <X size={12} />
              <span>Reset filters</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            padding: '4px 8px',
            width: '240px',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)', marginRight: '6px' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search findings..."
            aria-label="Search findings"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              style={{ color: 'var(--text-muted)' }}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.8rem',
        }}
      >
        {/* Severity options */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginRight: '0.25rem' }}>
            Severity:
          </span>
          <button
            type="button"
            onClick={() => onSelectSeverity(null)}
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: selectedSeverity === null ? 'var(--text-primary)' : 'var(--bg-surface-elevated)',
              color: selectedSeverity === null ? 'var(--bg-page)' : 'var(--text-secondary)',
              fontWeight: 500,
            }}
          >
            All
          </button>
          {SEVERITIES.map((s) => {
            const isSelected = selectedSeverity === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSeverity(isSelected ? null : s.id)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: isSelected ? 'var(--bg-surface-subtle)' : 'var(--bg-surface-elevated)',
                  border: isSelected ? '1px solid var(--border-hover)' : '1px solid transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div style={{ height: '14px', width: '1px', backgroundColor: 'var(--border-default)' }} />

        {/* Category options */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginRight: '0.25rem' }}>
            Category:
          </span>
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: selectedCategory === null ? 'var(--text-primary)' : 'var(--bg-surface-elevated)',
              color: selectedCategory === null ? 'var(--bg-page)' : 'var(--text-secondary)',
              fontWeight: 500,
            }}
          >
            All
          </button>
          {CATEGORIES.map((c) => {
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCategory(isSelected ? null : c.id)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: isSelected ? 'var(--bg-surface-subtle)' : 'var(--bg-surface-elevated)',
                  border: isSelected ? '1px solid var(--border-hover)' : '1px solid transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
