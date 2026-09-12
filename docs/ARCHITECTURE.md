# CodeEq Technical Architecture

> **Code Equilibrium** — *“Balance your AI-built code.”*  
> **Concept:** Vibe Coding Doctor  
> **Release:** v1.0.0

---

## 1. Executive Summary

CodeEq is a dual-mode static analysis and project health diagnostics platform engineered specifically for applications built with AI assistance and "vibe coding". It operates as both a local-first command-line tool and a serverless web-based GitHub repository scanner, providing actionable diagnostics and readiness assessments without executing target code.

```
┌─────────────────────────────────────────────────────────────┐
│                       Target Codebase                       │
│           (Local Workspace or Public GitHub Repo)           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────▼──────────────┐
                │   Safe Archive Ingestion   │
                │   (Memory/Size/SSRF Guards) │
                └──────────────┬──────────────┘
                               │
                ┌──────────────▼──────────────┐
                │    Project Intelligence     │
                │  (Framework, Lang, Router)  │
                └──────────────┬──────────────┘
                               │
                ┌──────────────▼──────────────┐
                │      Diagnostic Engine      │
                │  (5 Categories / Heuristics)│
                └──────────────┬──────────────┘
                               │
                ┌──────────────▼──────────────┐
                │   Health Scoring Engine     │
                │ (Category & Readiness Model)│
                └──────────────┬──────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │                                             │
┌───────▼──────────────┐                    ┌─────────▼───────────┐
│     CodeEq CLI       │                    │ Portfolio Dashboard │
│ (Terminal, MD, JSON) │                    │ (Interactive React) │
└──────────────────────┘                    └─────────────────────┘
```

---

## 2. Monorepo Structure & Boundaries

CodeEq is organized as a pnpm workspace with strict dependency isolation and typed contracts:

```text
codeeq/
├── packages/
│   ├── core/                  # @codeeq/core: Read-only filesystem analysis engine
│   │   ├── src/
│   │   │   ├── analysis/      # Category scoring, deduction math, exclusion policies
│   │   │   ├── detectors/     # Modular static rule detectors (AST & heuristic)
│   │   │   ├── reports/       # Markdown, JSON, and formatting pipelines
│   │   │   ├── scanners/      # Workspace traverser & project scanner
│   │   │   └── types/         # Canonical schemas (Finding V2, ProjectInfo, Health)
│   │   └── tsconfig.json
│   └── cli/                   # codeeq: Local-first Node.js CLI tool
│       ├── src/
│       │   ├── scanCommand.ts # Execution lifecycle, exit codes, output formatting
│       │   └── index.ts       # Commander.js entry point & binary definition
│       └── tsconfig.json
├── apps/
│   └── web/                   # codeeq-web: Public GitHub Scanner & Dashboard
│       ├── src/
│       │   ├── app/           # Next.js 15 App Router (pages & /api/scan route)
│       │   ├── components/    # Dark-first modular UI design system
│       │   └── lib/           # Scanner service, github client, tar extraction, normalizers
│       └── tsconfig.json
├── docs/                      # Technical, security, and release documentation
├── pnpm-workspace.yaml        # Workspace catalog definition
└── vercel.json                # Monorepo serverless deployment specification
```

### Boundary Invariants
* **`@codeeq/core`** has zero network awareness and zero CLI dependencies. It consumes an abstract or local filesystem directory and returns typed `ScanResult` contracts.
* **`codeeq` (CLI)** consumes `@codeeq/core` as a workspace dependency, manages file writes relative to target projects, and maps diagnostic severity to POSIX exit codes.
* **`codeeq-web`** invokes `@codeeq/core` against ephemeral temporary workspaces, then maps the result through a public DTO sanitizer that strips internal server paths.

---

## 3. The Core Diagnostic Pipeline

The analysis pipeline processes projects through five distinct phases:

### Phase 1: Project Intelligence
Before executing specialized diagnostics, CodeEq inspects package manifests, configuration files, and directory layouts to establish baseline context:
* **Framework**: Detects Next.js, Vite, React, Express, or Unknown.
* **Language**: Differentiates TypeScript from JavaScript using configuration and collected source-file signals, including nested source layouts.
* **Routing Architecture**: Maps Next.js App Router (`app/`), Pages Router (`pages/`), or Hybrid structures.
* **Package Manager**: Identifies `pnpm`, `npm`, `yarn`, or `bun`.
* **Ecosystem Signals**: Scans for Supabase, Prisma, Drizzle, Auth providers, and test harnesses.

### Phase 2: Diagnostic Rule Execution
Detectors evaluate the codebase against five diagnostic categories:
1. **Security**: Committed secrets, unignored `.env` files, leaked Supabase service keys, high-risk credentials.
2. **Configuration**: Missing `.env.example` templates, broken build scripts, misconfigured frameworks.
3. **Code Health**: Broken local relative imports, unresolved modules, unparseable syntax errors.
4. **Dependencies**: Undeclared imported packages, missing dependencies, monorepo manifest boundaries.
5. **Vibe-Code Heuristics**: Unfinished markers (`TODO`, `FIXME`, `HACK`), hardcoded localhost URLs, duplicate files.

### Phase 3: Exclusion & Sanitization Policies
CodeEq enforces strict exclusion boundaries:
* Ignored paths (`node_modules/`, `dist/`, `.next/`, `.git/`) are never scanned.
* Test fixtures and regression packs inside test directories are isolated so that deliberate test errors do not flag host projects.
* Detected secret values are permanently redacted at the capture point; only variable names and key locations are reported.

---

## 4. Finding V2 Contract

Every diagnostic finding conforms to the strict `Finding` contract:

```typescript
export interface Finding {
  code: string;              // Unique rule identifier (e.g. UNDECLARED_DEPENDENCY)
  title: string;             // Human-readable title
  category: Category;        // 'security' | 'configuration' | 'codeHealth' | 'dependencies' | 'deployment'
  severity: Severity;        // 'critical' | 'high' | 'medium' | 'low'
  confidence: Confidence;    // 'high' | 'medium' | 'low'
  summary: string;           // Concise plain-English explanation
  file?: string;             // File path relative to project root
  line?: number;             // 1-indexed source line
  evidence?: string;         // Concrete code snippet or configuration proof
  whyItMatters: string;      // Rationale and runtime risk explanation
  deploymentImpact: Impact;  // 'blocking' | 'risk' | 'none'
  remediation: string;       // Actionable developer fix instructions
}
```

---

## 5. Health Scoring & Readiness Model

CodeEq applies a deterministic deduction algorithm:
* **Starting Base**: 100 points.
* **Deductions**:
  - `Critical`: -25 points
  - `High`: -15 points
  - `Medium`: -8 points
  - `Low`: -3 points
* **Floor**: Scores cannot drop below 0.
* **Category Breakdown**: Computed independently across all 5 categories (`Security`, `Configuration`, `Code Health`, `Dependencies`, `Deployment`).

### Static Deployment Readiness
Readiness translates diagnostic findings into deployment safety:
* **`Blocked`**: Triggered immediately by any `critical` or `high` finding, or any finding flagged with `deploymentImpact: 'blocking'`.
* **`Needs attention`**: Triggered when `medium` findings exist without blockers.
* **`Ready`**: Awarded when zero blocking or risky findings are identified.

---

## 6. Web Scanner Architecture & Sandbox Isolation

When invoked via `POST /api/scan`:
1. **Client Normalization**: The browser normalizes shorthand (`owner/repo`) to canonical HTTPS URLs before request transmission.
2. **Strict Route Validation**: The API validates HTTPS protocol, exact `github.com` hostname, and two-part path tokens.
3. **Archive Streaming**: GitHub’s tarball stream is piped directly into a bounded parser enforcing:
   - Max 15 MB compressed archive size.
   - Max 75 MB extracted size.
   - Max 5,000 extracted files.
   - 15-second acquisition timeout and 30-second overall cooperative-cancellation guard.
4. **Ephemeral Sandbox**: Extracted into an OS temporary directory with random entropy (`codeeq-scan-XXXXXX`).
5. **Memory-Only Scan**: `@codeeq/core` analyzes the directory without executing any target scripts or installing dependencies.
6. **Guaranteed Cleanup**: A `finally` block recursively deletes the temporary directory, regardless of whether the scan succeeded, failed, or timed out.
7. **Response Sanitization**: Internal filesystem paths (`targetDir`, `reportPath`) are stripped before returning the JSON payload to the client.
