# CodeEq 1.0.0 Release Notes

> **Code Equilibrium** — *“Balance your AI-built code.”*  
> **Concept:** Vibe Coding Doctor  
> **Target Release:** v1.0.0 Portfolio Release Candidate  
> **Prepared For:** Independent Codex 5.6 Audit

---

## 1. Release Overview

CodeEq 1.0.0 is the complete, portfolio-grade release of the static project health scanner for AI-assisted and "vibe-coded" applications. It bridges the gap between rapid generative AI code production and production deployment readiness.

---

## 2. Key Capabilities Delivered

### Core Diagnostic Engine (`@codeeq/core`)
* **Project Intelligence**: Automatic detection of frameworks (Next.js App/Pages Router, Vite, React, Express), languages (TypeScript, JavaScript), package managers (`pnpm`, `npm`, `yarn`, `bun`), database clients, authentication providers, and testing harnesses.
* **Finding V2 Schema**: Structured diagnostics providing Category, Severity, Confidence, Location, Code Evidence, Why It Matters, Deployment Impact (`blocking` | `risk` | `none`), and Actionable Remediation.
* **Five Diagnostic Families**:
  1. *Security*: Leaked API secrets, committed `.env` files, Supabase service-role key exposures, sensitive public env naming.
  2. *Configuration*: Missing `.env.example` templates, broken or missing `build`/`start` scripts, next.config omissions.
  3. *Code Health*: Unresolved relative imports, missing source files, unparseable syntax errors.
  4. *Dependencies*: Undeclared imports, monorepo workspace package boundary violations, missing peer dependencies.
  5. *Vibe-Code Heuristics*: Unfinished code markers (`TODO`, `FIXME`, `HACK`), hardcoded localhost URLs, duplicate files.
* **Health Scoring & Deployment Readiness**: Deterministic deduction scoring (0–100) across overall and 5 categories, outputting unequivocal readiness indicators (`Ready`, `Needs attention`, `Blocked`).
* **Reporting Pipelines**: Standardized Markdown and machine-readable JSON output generators.

### Developer CLI (`packages/cli`)
* Local-first command-line scanning with zero network transmission:
  - `codeeq scan [dir]`: Scans directory and writes `PROJECT_HEALTH_REPORT.md`.
  - `--json`: Outputs machine-readable JSON for CI/CD integration.
  - `--no-write`: Pure terminal summary without modifying target files.
  - `--report [path]`: Custom output destination.
* POSIX exit codes: `0` for Ready, `1` for Blocked, `2` for Needs attention, `3` for runtime errors.

### Portfolio Web Scanner & Dashboard (`apps/web`)
* **Public GitHub Scanner**: Pure static analysis of public repositories via streaming tarball decompression.
* **Hardened Ephemeral Sandboxing**: Zero target execution, SSRF-resistant URL parsing, zip-slip protection, 15 MB / 75 MB / 5,000 files quota enforcement, automatic sandbox directory cleanup.
* **Client Shorthand Normalizer**: Transparently accepts both `owner/repo` and `https://github.com/owner/repo`.
* **Dark-First Modern Dashboard**:
  - Live animated scanning states and contextual error banners.
  - Overall health radial score with plain-English doctor summary.
  - 5-category breakdown progress bars.
  - 10-point Project Intelligence architectural grid.
  - Multi-dimensional filtering (full-text search, severity toggles, category dropdowns).
  - Diagnostic drawer with complete code evidence, impact evaluation, and remediation steps.
  - Static analysis scope disclosures.

---

## 3. Test Coverage & Verification

CodeEq 1.0.0 is backed by a comprehensive, fully offline, and deterministic automated test suite:

```text
test files: 36
tests: 285
passing: 285
failing: 0

@codeeq/core: 23 test files, 158 passing
codeeq CLI:    2 test files,   9 passing
codeeq-web:   11 test files, 118 passing
```

### Production Build Verification
All workspace projects compile cleanly under strict TypeScript and Next.js production bundler:
* `@codeeq/core`: `tsc -p tsconfig.json` $\rightarrow$ PASS
* `packages/cli`: `tsc -p tsconfig.json` $\rightarrow$ PASS
* `apps/web`: `next build` (Next.js 14.2.35) $\rightarrow$ PASS

---

## 4. Known Limitations

* **Pure Static Analysis**: CodeEq does not install `node_modules` or execute test suites. Dynamic runtime errors or runtime-injected secrets are outside static scope.
* **JavaScript / TypeScript Ecosystem**: Diagnostics are focused on Node.js, Next.js, Vite, and React projects.
* **Public GitHub Repositories Only**: Web scanner exclusively analyzes public GitHub repositories.
* **GitHub Rate Limits**: Unauthenticated instances are bounded by GitHub’s public IP rate limits (60 req/hr), expandable to 5,000 req/hr via server-side `GITHUB_TOKEN`.

---

## 5. Audit Handoff

This release candidate is frozen and prepared for the independent Codex 5.6 final audit.
