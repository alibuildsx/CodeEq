import React from 'react';
import { Cpu, FileCode, Layers, Shield } from './icons';

export function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Understand',
      desc: 'CodeEq identifies your framework, language, router, package manager, and full project architecture.',
      icon: <Layers size={20} />,
    },
    {
      num: '02',
      title: 'Diagnose',
      desc: 'Runs modular static diagnostics across security, configuration, code health, dependencies, and deployment readiness.',
      icon: <Cpu size={20} />,
    },
    {
      num: '03',
      title: 'Explain',
      desc: 'Each finding explains why it matters, provides code-level evidence, evaluates deployment risk, and suggests an exact fix.',
      icon: <FileCode size={20} />,
    },
  ];

  const checks = [
    {
      category: 'Security',
      summary: 'Accidentally committed .env files, leaked API secrets, insecure public credentials.',
    },
    {
      category: 'Configuration',
      summary: 'Missing .env.example templates, gitignore omissions, broken build scripts, framework misconfigs.',
    },
    {
      category: 'Code Health',
      summary: 'Unresolved local imports, syntax errors, missing source files, unparseable modules.',
    },
    {
      category: 'Dependencies',
      summary: 'Undeclared imports, missing packages, monorepo manifest boundaries, hoisting assumptions.',
    },
    {
      category: 'Deployment',
      summary: 'Static readiness scoring (Ready, Needs attention, Blocked) to prevent broken production ships.',
    },
  ];

  return (
    <div style={{ maxWidth: '960px', margin: '3rem auto 0 auto', padding: '0 1.5rem' }}>
      {/* 3 Steps */}
      <section id="how-it-works" style={{ marginBottom: '3.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
            }}
          >
            How CodeEq Works
          </span>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginTop: '0.25rem',
              letterSpacing: '-0.02em',
            }}
          >
            Balance and harden your codebase
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {steps.map((s) => (
            <div
              key={s.num}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '10px',
                padding: '1.5rem',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-primary)',
                  }}
                >
                  {s.icon}
                </div>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  {s.num}
                </span>
              </div>

              <h3
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                {s.title}
              </h3>

              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* What it checks */}
      <section id="what-it-checks" style={{ marginBottom: '3.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
            }}
          >
            Diagnostic Coverage
          </span>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginTop: '0.25rem',
              letterSpacing: '-0.02em',
            }}
          >
            What CodeEq checks
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {checks.map((c) => (
            <div
              key={c.category}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.375rem',
                }}
              >
                <Shield size={14} style={{ color: 'var(--status-low)' }} />
                <h4 style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {c.category}
                </h4>
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {c.summary}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
