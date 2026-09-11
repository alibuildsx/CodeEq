'use client';

import React, { useMemo, useState } from 'react';
import type { Finding } from '@codeeq/core';
import { CategoryHealth } from '../components/CategoryHealth';
import { CliPromotion } from '../components/CliPromotion';
import { EmptyFindingsState } from '../components/EmptyFindingsState';
import { FindingCard } from '../components/FindingCard';
import { FindingDrawer } from '../components/FindingDrawer';
import { FindingsToolbar } from '../components/FindingsToolbar';
import { Header } from '../components/Header';
import { HowItWorks } from '../components/HowItWorks';
import { OverallHealth } from '../components/OverallHealth';
import { ProjectOverview } from '../components/ProjectOverview';
import { RepositoryScanForm } from '../components/RepositoryScanForm';
import { ResultsHeader } from '../components/ResultsHeader';
import { ScanErrorState } from '../components/ScanErrorState';
import { ScanningState } from '../components/ScanningState';
import { SeveritySummaryBar } from '../components/SeveritySummaryBar';
import { FrontendScanError, scanRepository } from '../lib/api/client';
import type { RepositoryScanResponse } from '../lib/scanner/types';

export default function CodeEqDashboardPage() {
  const [repoUrl, setRepoUrl] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [scanResult, setScanResult] = useState<RepositoryScanResponse | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [isRescanning, setIsRescanning] = useState(false);

  const handleScan = async (url: string) => {
    setRepoUrl(url);
    setScanStatus('scanning');
    setError(null);
    setSelectedFinding(null);
    setSeverityFilter(null);
    setCategoryFilter(null);
    setSearchQuery('');

    try {
      const result = await scanRepository(url);
      setScanResult(result);
      setScanStatus('success');
    } catch (err: unknown) {
      setScanStatus('error');
      if (err instanceof FrontendScanError) {
        setError({ code: err.code, message: err.message });
      } else {
        setError({
          code: 'SCAN_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
        });
      }
    }
  };

  const handleRescan = async () => {
    if (!repoUrl || isRescanning) return;
    setIsRescanning(true);
    try {
      const result = await scanRepository(repoUrl);
      setScanResult(result);
    } catch (err: unknown) {
      if (err instanceof FrontendScanError) {
        setError({ code: err.code, message: err.message });
      }
    } finally {
      setIsRescanning(false);
    }
  };

  const handleNewScan = () => {
    setScanStatus('idle');
    setScanResult(null);
    setSelectedFinding(null);
    setError(null);
  };

  // Filter findings based on active severity, category, and search query
  const filteredFindings = useMemo(() => {
    if (!scanResult) return [];
    let findings = scanResult.scan.findings;

    if (severityFilter) {
      findings = findings.filter((f) => f.severity === severityFilter);
    }

    if (categoryFilter) {
      findings = findings.filter((f) => f.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      findings = findings.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.summary.toLowerCase().includes(q) ||
          f.code.toLowerCase().includes(q) ||
          (f.file && f.file.toLowerCase().includes(q))
      );
    }

    return findings;
  }, [scanResult, severityFilter, categoryFilter, searchQuery]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onReset={handleNewScan} />

      <main style={{ flex: 1, padding: '0 1.5rem' }}>
        {scanStatus === 'idle' && (
          <div className="animate-fade-in">
            <RepositoryScanForm onScan={handleScan} />
            <HowItWorks />
            <CliPromotion />
          </div>
        )}

        {scanStatus === 'scanning' && (
          <div className="animate-fade-in">
            <ScanningState repoUrl={repoUrl} />
          </div>
        )}

        {scanStatus === 'error' && (
          <div className="animate-fade-in">
            <RepositoryScanForm initialUrl={repoUrl} onScan={handleScan} />
            {error && <ScanErrorState error={error} onDismiss={() => setError(null)} />}
            <HowItWorks />
            <CliPromotion />
          </div>
        )}

        {scanStatus === 'success' && scanResult && (
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              paddingBottom: '4rem',
            }}
            className="animate-fade-in"
          >
            {/* Header with repo info and rescan */}
            <ResultsHeader
              data={scanResult}
              onRescan={handleRescan}
              onNewScan={handleNewScan}
              isRescanning={isRescanning}
            />

            {/* Health and Category Breakdown Grids */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <OverallHealth
                score={scanResult.scan.healthScore}
                readiness={scanResult.scan.deploymentReadiness}
              />
              <CategoryHealth categories={scanResult.scan.health.categories} />
            </div>

            {/* Project Intelligence Overview */}
            <ProjectOverview projectInfo={scanResult.scan.projectInfo} />

            {/* Findings Toolbar and Severity Summary */}
            <SeveritySummaryBar
              findings={scanResult.scan.findings}
              activeSeverity={severityFilter}
              onSelectSeverity={setSeverityFilter}
            />

            <FindingsToolbar
              totalCount={scanResult.scan.findings.length}
              filteredCount={filteredFindings.length}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedSeverity={severityFilter}
              onSelectSeverity={setSeverityFilter}
              selectedCategory={categoryFilter}
              onSelectCategory={setCategoryFilter}
              onResetFilters={() => {
                setSeverityFilter(null);
                setCategoryFilter(null);
                setSearchQuery('');
              }}
            />

            {/* Findings List or Empty State */}
            {filteredFindings.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {filteredFindings.map((finding, idx) => (
                  <FindingCard
                    key={`${finding.code}-${finding.file ?? ''}-${finding.line ?? idx}`}
                    finding={finding}
                    isSelected={selectedFinding?.code === finding.code && selectedFinding?.file === finding.file}
                    onSelect={setSelectedFinding}
                  />
                ))}
              </div>
            ) : (
              <EmptyFindingsState isFiltered={scanResult.scan.findings.length > 0} />
            )}

            {/* Static Readiness Note */}
            <div
              style={{
                marginTop: '3rem',
                padding: '1rem 1.25rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              <strong>STATIC DEPLOYMENT READINESS:</strong> The online CodeEq scanner performs pure static analysis.
              It does not install dependencies, execute repository code, or run test suites.
            </div>

            {/* CLI Promotion */}
            <CliPromotion />

            {/* Detail Drawer (when finding selected) */}
            <FindingDrawer
              finding={selectedFinding}
              onClose={() => setSelectedFinding(null)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
