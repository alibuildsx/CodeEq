import React, { useState } from 'react';
import { Check, Terminal } from './icons';

export function CliPromotion() {
  const [copied, setCopied] = useState(false);
  const command = 'codeeq scan .';

  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // ignore
    });
  };

  return (
    <aside
      style={{
        maxWidth: '720px',
        margin: '3rem auto 4rem auto',
        padding: '1.5rem',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.25rem',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Terminal size={15} style={{ color: 'var(--status-low)' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Prefer local scanning?
          </span>
        </div>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
          Scan large or private codebases on your machine without uploading source code.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '6px 12px',
            backgroundColor: 'var(--bg-page)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>$</span>
          <span>{command}</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            color: copied ? 'var(--status-healthy)' : 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
          aria-label="Copy CLI command"
        >
          {copied ? <Check size={14} /> : <span>Copy</span>}
        </button>
      </div>
    </aside>
  );
}
