import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  mockBlockedResult,
  mockHealthyResult,
  mockNeedsAttentionResult,
} from '../../lib/fixtures/mockResults';
import { CategoryHealth } from '../CategoryHealth';
import { EmptyFindingsState } from '../EmptyFindingsState';
import { FindingCard } from '../FindingCard';
import { FindingDrawer } from '../FindingDrawer';
import { FindingsToolbar } from '../FindingsToolbar';
import { OverallHealth } from '../OverallHealth';
import { ProjectOverview } from '../ProjectOverview';
import { RepositoryScanForm } from '../RepositoryScanForm';
import { ResultsHeader } from '../ResultsHeader';
import { ScanErrorState } from '../ScanErrorState';
import { SeveritySummaryBar } from '../SeveritySummaryBar';

const clean = (html: string) => html.replace(/<!--.*?-->/g, '');

describe('Dashboard Component Rendering', () => {
  describe('RepositoryScanForm', () => {
    it('renders hero headline, input placeholder, and trust signal', () => {
      const html = renderToString(
        <RepositoryScanForm onScan={() => {}} />
      );

      expect(html).toContain('Balance your AI-built code.');
      expect(html).toContain('https://github.com/owner/repo or owner/repo');
      expect(html).toContain('Scan Repository');
      expect(html).toContain('Try demo repository');
      expect(html).toContain('Static analysis only — never executes repository code');
    });

    it('renders scanning button text when isScanning is true', () => {
      const html = renderToString(
        <RepositoryScanForm isScanning={true} onScan={() => {}} />
      );

      expect(html).toContain('Scanning...');
    });
  });

  describe('ResultsHeader', () => {
    it('renders repository identity and formatted tech stack tags', () => {
      const html = clean(
        renderToString(
          <ResultsHeader
            data={mockHealthyResult}
            onRescan={() => {}}
            onNewScan={() => {}}
          />
        )
      );

      expect(html).toContain('alibuildsx / CodeEq');
      expect(html).toContain('branch: main');
      expect(html).toContain('Next.js');
      expect(html).toContain('TypeScript');
      expect(html).toContain('pnpm');
      expect(html).toContain('Rescan');
      expect(html).toContain('Scan another');
    });
  });

  describe('OverallHealth', () => {
    it('renders Ready score and explanation', () => {
      const html = clean(
        renderToString(<OverallHealth score={96} readiness="Ready" />)
      );

      expect(html).toContain('96');
      expect(html).toContain('/ 100');
      expect(html).toContain('Ready');
      expect(html).toContain('No blocking static issues were detected.');
    });

    it('renders Needs attention status', () => {
      const html = clean(
        renderToString(<OverallHealth score={78} readiness="Needs attention" />)
      );

      expect(html).toContain('78');
      expect(html).toContain('Needs attention');
      expect(html).toContain('CodeEq found issues worth reviewing before deployment.');
    });

    it('renders Blocked status', () => {
      const html = clean(
        renderToString(<OverallHealth score={42} readiness="Blocked" />)
      );

      expect(html).toContain('42');
      expect(html).toContain('Blocked');
      expect(html).toContain('CodeEq found issues likely to block or seriously affect deployment.');
    });
  });

  describe('CategoryHealth', () => {
    it('renders all 5 core category breakdowns and scores', () => {
      const html = clean(
        renderToString(
          <CategoryHealth categories={mockNeedsAttentionResult.scan.health.categories} />
        )
      );

      expect(html).toContain('Security');
      expect(html).toContain('90');
      expect(html).toContain('Configuration');
      expect(html).toContain('70');
      expect(html).toContain('Code Health');
      expect(html).toContain('80');
      expect(html).toContain('Dependencies');
      expect(html).toContain('75');
      expect(html).toContain('Deployment');
    });
  });

  describe('ProjectOverview', () => {
    it('renders tech stack intelligence with friendly labels', () => {
      const html = clean(
        renderToString(
          <ProjectOverview projectInfo={mockNeedsAttentionResult.scan.projectInfo} />
        )
      );

      expect(html).toContain('Next.js');
      expect(html).toContain('TypeScript');
      expect(html).toContain('App Router');
      expect(html).toContain('npm');
      expect(html).toContain('Supabase');
      expect(html).toContain('Supabase Auth');
      expect(html).toContain('Vercel');
    });
  });

  describe('SeveritySummaryBar', () => {
    it('summarizes findings counts by severity', () => {
      const html = clean(
        renderToString(
          <SeveritySummaryBar findings={mockBlockedResult.scan.findings} />
        )
      );

      expect(html).toContain('2 Critical');
      expect(html).toContain('1 High');
      expect(html).toContain('0 Medium');
      expect(html).toContain('0 Low');
      expect(html).toContain('Findings: 3');
    });
  });

  describe('FindingCard', () => {
    it('renders finding details, location, and severity', () => {
      const finding = mockNeedsAttentionResult.scan.findings[0];
      const html = clean(
        renderToString(<FindingCard finding={finding} onSelect={() => {}} />)
      );

      expect(html).toContain('Medium');
      expect(html).toContain('Configuration');
      expect(html).toContain('Missing .env.example template');
      expect(html).toContain('.env:1');
      expect(html).toContain('View diagnosis');
    });

    it('exposes keyboard button semantics for the interactive card', () => {
      const finding = mockNeedsAttentionResult.scan.findings[0];
      const html = clean(
        renderToString(<FindingCard finding={finding} onSelect={() => {}} />)
      );

      expect(html).toContain('role="button"');
      expect(html).toContain('tabindex="0"');
    });
  });

  describe('FindingsToolbar', () => {
    it('gives the findings search field an accessible name', () => {
      const html = renderToString(
        <FindingsToolbar
          totalCount={1}
          filteredCount={1}
          searchQuery=""
          onSearchChange={() => {}}
          selectedSeverity={null}
          onSelectSeverity={() => {}}
          selectedCategory={null}
          onSelectCategory={() => {}}
          onResetFilters={() => {}}
        />
      );

      expect(html).toContain('aria-label="Search findings"');
    });
  });

  describe('FindingDrawer', () => {
    it('renders full Finding V2 diagnostic information', () => {
      const finding = mockBlockedResult.scan.findings[0];
      const html = renderToString(
        <FindingDrawer finding={finding} onClose={() => {}} />
      );

      expect(html).toContain(finding.code);
      expect(html).toContain(finding.title);
      expect(html).toContain(finding.summary);
      expect(html).toContain('Evidence');
      expect(html).toContain(finding.evidence!);
      expect(html).toContain('Why This Matters');
      expect(html).toContain(finding.whyItMatters);
      expect(html).toContain('Deployment Impact');
      expect(html).toContain('Recommended Fix');
      expect(html).toContain(finding.remediation);
    });

    it('returns null when finding is null', () => {
      const html = renderToString(
        <FindingDrawer finding={null} onClose={() => {}} />
      );

      expect(html).toBe('');
    });
  });

  describe('EmptyFindingsState', () => {
    it('renders positive clean project state without claiming perfection', () => {
      const html = renderToString(<EmptyFindingsState isFiltered={false} />);

      expect(html).toContain('No issues detected');
      expect(html).toContain('CodeEq did not find any problems covered by the current static checks.');
      expect(html).not.toContain('completely secure');
      expect(html).not.toContain('no bugs');
    });

    it('renders filtered empty state message when filters are active', () => {
      const html = renderToString(<EmptyFindingsState isFiltered={true} />);

      expect(html).toContain('No matching findings');
      expect(html).toContain('Try adjusting your severity or category filters');
    });
  });

  describe('ScanErrorState', () => {
    const errorCodes = [
      'INVALID_GITHUB_URL',
      'REPOSITORY_NOT_ACCESSIBLE',
      'GITHUB_RATE_LIMITED',
      'REPOSITORY_TOO_LARGE',
      'ARCHIVE_DOWNLOAD_FAILED',
      'REQUEST_TOO_LARGE',
      'SCAN_TIMEOUT',
      'SCAN_FAILED',
    ];

    for (const code of errorCodes) {
      it(`renders user-friendly advice for ${code}`, () => {
        const html = renderToString(
          <ScanErrorState error={{ code, message: 'Server error' }} />
        );

        expect(html).toContain(code.replace(/_/g, ' '));
        // Must never leak server path or stack
        expect(html).not.toContain('C:\\');
        expect(html).not.toContain('/tmp/');
      });
    }

    it('renders preferred copy for REPOSITORY_TOO_LARGE without hardcoded 25 MB limit', () => {
      const html = renderToString(
        <ScanErrorState error={{ code: 'REPOSITORY_TOO_LARGE', message: 'Size limit exceeded' }} />
      );

      expect(html).toContain('This repository is too large for the online CodeEq scanner.');
      expect(html).toContain('Try a smaller repository or use the local CLI.');
      expect(html).not.toContain('25 MB');
      expect(html).not.toContain('25MB');
    });

    it('safely falls back to generic message for unknown future error codes', () => {
      const html = renderToString(
        <ScanErrorState error={{ code: 'UNKNOWN_FUTURE_CODE', message: '' }} />
      );

      expect(html).toContain('An unexpected error occurred while analyzing the repository. Please try again.');
      expect(html).toContain('UNKNOWN FUTURE CODE');
    });
  });

  describe('Sanitization Invariants', () => {
    it('never renders targetDir, reportPath, issues alias, or temp paths in any component', () => {
      const components = [
        <OverallHealth score={mockNeedsAttentionResult.scan.healthScore} readiness={mockNeedsAttentionResult.scan.deploymentReadiness} />,
        <ResultsHeader data={mockNeedsAttentionResult} onRescan={() => {}} onNewScan={() => {}} />,
        <CategoryHealth categories={mockNeedsAttentionResult.scan.health.categories} />,
        <ProjectOverview projectInfo={mockNeedsAttentionResult.scan.projectInfo} />,
        <SeveritySummaryBar findings={mockNeedsAttentionResult.scan.findings} />,
        <FindingCard finding={mockNeedsAttentionResult.scan.findings[0]} onSelect={() => {}} />,
        <FindingDrawer finding={mockNeedsAttentionResult.scan.findings[0]} onClose={() => {}} />,
      ];

      for (const comp of components) {
        const html = renderToString(comp);
        expect(html).not.toContain('targetDir');
        expect(html).not.toContain('reportPath');
        expect(html).not.toContain('codeeq-scan-');
        expect(html).not.toContain('/tmp/');
        expect(html).not.toContain('AppData\\Local\\Temp');
      }
    });
  });
});
