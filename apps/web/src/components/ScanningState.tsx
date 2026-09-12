import React, { useEffect, useState } from 'react';
import { CheckCircle2, Shield } from './icons';

interface ScanningStateProps {
  repoUrl: string;
}

const SCAN_STAGES = [
  'Connecting to GitHub',
  'Downloading repository source',
  'Inspecting project structure',
  'Checking security diagnostics',
  'Analyzing code health & dependencies',
  'Calculating project equilibrium score',
];

export function ScanningState({ repoUrl }: ScanningStateProps) {
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStageIndex((prev) => (prev < SCAN_STAGES.length - 1 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      style={{
        maxWidth: '640px',
        margin: '4rem auto',
        padding: '2.5rem 1.5rem',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-hover)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto',
          color: 'var(--status-low)',
        }}
        className="animate-pulse"
      >
        <Shield size={24} />
      </div>

      <h2
        style={{
          fontSize: '1.4rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
          letterSpacing: '-0.02em',
        }}
      >
        Scanning Repository
      </h2>

      <p
        style={{
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          marginBottom: '2rem',
          wordBreak: 'break-all',
        }}
      >
        {repoUrl}
      </p>

      {/* Diagnostic Stage List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: '400px',
          margin: '0 auto',
          textAlign: 'left',
        }}
      >
        {SCAN_STAGES.map((stage, idx) => {
          const isPassed = idx < activeStageIndex;
          const isCurrent = idx === activeStageIndex;

          return (
            <div
              key={stage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.875rem',
                color: isPassed
                  ? 'var(--status-healthy)'
                  : isCurrent
                  ? 'var(--text-primary)'
                  : 'var(--text-muted)',
                fontWeight: isCurrent ? 500 : 400,
                transition: 'color var(--transition-normal)',
              }}
            >
              <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center' }}>
                {isPassed ? (
                  <CheckCircle2 size={16} />
                ) : isCurrent ? (
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--status-low)',
                      margin: '0 auto',
                    }}
                    className="animate-pulse"
                  />
                ) : (
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--border-default)',
                      margin: '0 auto',
                    }}
                  />
                )}
              </div>
              <span>{stage}</span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: '2.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}
      >
        CodeEq performs static analysis only. It never executes repository code.
      </div>
    </section>
  );
}
