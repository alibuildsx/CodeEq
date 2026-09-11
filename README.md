# CodeEq

> **Balance your AI-built code.**  
> *Concept: Vibe Coding Doctor*

CodeEq is a local-first and web-based static project health scanner designed for AI-assisted and "vibe-coded" applications. It inspects your project, understands its architecture, detects critical issues across security, configuration, dependencies, and code health, and gives the project an unambiguous health and deployment-readiness assessment.

---

## Why CodeEq?

Generative AI coding tools (Claude, Cursor, Copilot, ChatGPT, v0) allow developers to build full-stack web applications at unprecedented velocity. However, velocity often comes with hidden risks:

* **Exposed Credentials**: Accidental commits of `.env` files, leaked Supabase service-role keys, or client-exposed API secrets.
* **Broken Modules & Imports**: Hallucinated imports, missing source files, and broken relative paths that silently pass until runtime.
* **Misconfiguration**: Missing `.env.example` templates, unconfigured build scripts, and omitted gitignore entries that cause CI/CD deployments to fail.
* **Undeclared Dependencies**: Packages imported in code but missing from `package.json`, or monorepo workspace boundary leaks.
* **Vibe-Code Debt**: Piles of `TODO` markers, hardcoded `http://localhost` URLs in production pathways, and duplicate files.

CodeEq acts as a **Vibe Coding Doctor**—diagnosing these problems before you ship, explaining *why* they matter in plain English, and providing actionable remediation steps.

---

## How It Works

```text
┌─────────────────────────────────────────────────────────────┐
│          GitHub Repository  or  Local File System           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────▼──────────────┐
                │        CodeEq Core          │
                │     @codeeq/core engine     │
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
                │ Health + Readiness Engine   │
                │  (Score 0-100 & Ready/Block)│
                └──────────────┬──────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │                                             │
┌───────▼──────────────┐                    ┌─────────▼───────────┐
│     Developer CLI    │                    │ Portfolio Dashboard │
│ (Terminal, MD, JSON) │                    │ (Interactive Web UI)│
└──────────────────────┘                    └─────────────────────┘
```

---

## What CodeEq Detects

CodeEq groups diagnostics into five clear categories:

| Category | Description & Representative Checks |
| :--- | :--- |
| **Security** | Leaked Supabase service-role keys, unignored `.env` / `.env.local` files, sensitive credential variable naming, exposed secrets. |
| **Configuration** | Missing `.env.example` templates, missing or broken `build` / `start` scripts, missing `next.config.*`, missing `.gitignore`. |
| **Code Health** | Unresolved local relative imports, missing target source files, unparseable JavaScript/TypeScript syntax errors. |
| **Dependencies** | Undeclared package imports (missing from `package.json`), monorepo package boundary violations, conflicting lockfiles. |
| **Vibe-Code Heuristics** | Excessive unfinished code markers (`TODO`, `FIXME`, `HACK`), hardcoded localhost URLs, duplicate files. |
| **Deployment Readiness** | Synthesized deployment status (`Ready`, `Needs attention`, `Blocked`) to prevent broken production deployments. |

---

## Finding Model (Finding V2)

Every issue detected by CodeEq provides a complete, structured diagnosis:

```markdown
### 🔴 Critical — SUPABASE_SERVICE_ROLE_LEAKED
* **Location**: `src/lib/supabaseClient.ts:4`
* **Summary**: A likely Supabase service-role secret key assignment was detected in source code.
* **Evidence**: `const supabase = createClient(url, 'eyJhbGciOiJIUzI1NiIsInR5cCI6...')`
* **Why It Matters**: Service-role keys bypass Row Level Security (RLS) entirely. If bundled into client-side code, any user can read, modify, or delete your entire database.
* **Deployment Impact**: `blocking` — Do not deploy this project to production.
* **Recommended Fix**: Move service-role operations to a secure server-side API route or edge function, and reference the key via a non-public environment variable.
```

---

## Health Scoring & Readiness

CodeEq calculates a deterministic health score from **0 to 100**:
* Every scan starts at **100**.
* **Deductions**: `Critical`: -30 pts | `High`: -20 pts | `Medium`: -10 pts | `Low`: -5 pts.
* Independent scores are calculated across all five categories: **Security**, **Configuration**, **Code Health**, **Dependencies**, and **Deployment**.

### Static Deployment Readiness
* 🟢 **Ready**: Zero blocking or risky findings. Safe to proceed with standard build and deployment.
* 🟡 **Needs attention**: Non-critical warnings (e.g. missing documentation or low-severity debt).
* 🔴 **Blocked**: One or more critical/high severity findings or deployment-blocking issues exist.

---

## Web Scanner & Dashboard (`apps/web`)

The CodeEq web application provides a browser-based repository health dashboard:

1. **Input**: Paste any public GitHub URL (`https://github.com/owner/repo`) or shorthand (`owner/repo`).
2. **Safe Static Scan**: The server downloads a temporary compressed archive, analyzes the code in a sandboxed directory, and purges all files upon completion.
3. **Interactive Results**: Explore overall health, category breakdown, project intelligence grid, interactive severity filters, and slide-over finding drawers.

> [!NOTE]
> **Static Analysis Only**: CodeEq web scanner never executes target repository code, never runs build scripts, and never installs dependencies. Repositories are analyzed purely via static AST parsing and heuristic detectors.

---

## Local Developer CLI (`packages/cli`)

Run CodeEq locally on your machine with zero external network communication:

### Development Execution
```bash
# Scan current directory and write PROJECT_HEALTH_REPORT.md
pnpm --filter codeeq dev scan .

# Scan another project directory
pnpm --filter codeeq dev scan ../my-ai-app

# Print terminal summary without writing a Markdown report
pnpm --filter codeeq dev scan --no-write

# Output machine-readable JSON (ideal for CI/CD pipelines)
pnpm --filter codeeq dev scan --json --no-write

# Write report to a custom path
pnpm --filter codeeq dev scan --report reports/HEALTH_AUDIT.md
```

### Production Binary Build
```bash
# Build all packages
pnpm build

# Run the compiled CLI
node packages/cli/dist/index.js scan .
```

---

## Tech Stack & Architecture

CodeEq is built as a typed monorepo using modern web technologies:

* **Language**: TypeScript 5.5 (strict mode)
* **Runtime**: Node.js 18+ (tested through Node.js 24)
* **Monorepo**: pnpm workspaces
* **Frontend**: Next.js 14 (App Router), React 18, Vanilla CSS Design System
* **CLI Engine**: Commander.js, Chalk-free zero-dependency ANSI styling
* **Archive Engine**: `tar` (hardened stream extraction)
* **Test Suite**: Vitest 2.1

### Workspace Packages
* [`packages/core`](file:///e:/Dev/CodeEq/packages/core): Pure diagnostic engine, AST parsers, detector registry, scoring algorithms, and report formatters. Zero network or CLI dependencies.
* [`packages/cli`](file:///e:/Dev/CodeEq/packages/cli): Commander CLI application mapping scanner outputs to terminal displays, Markdown files, JSON streams, and POSIX exit codes.
* [`apps/web`](file:///e:/Dev/CodeEq/apps/web): Next.js portfolio application featuring the public GitHub repository scanner backend and dark-first diagnostic dashboard.

---

## Security Architecture

CodeEq is built under a **Zero-Execution, Zero-Trust** model:

* **No Target Code Execution**: Source code is inspected purely via static Abstract Syntax Trees and regular expressions. No scripts, postinstall hooks, or builds are ever executed.
* **SSRF Mitigation**: Public URL parser strictly accepts `https://github.com/:owner/:repo` and rejects credentials, non-standard ports, IP addresses, and non-GitHub hosts.
* **Zip-Slip Protection**: Tarball extractor verifies that every extracted entry resolves strictly within the designated sandbox, completely ignoring symlinks and hardlinks.
* **Resource Quotas**: Hard quotas enforce a maximum 15 MB archive size, 75 MB extracted size, 5,000 files limit, and 60-second execution timeout.
* **Secret Redaction**: Detected secret keys are redacted at the capture point; raw secret values are never displayed in reports or UI components.
* **Ephemeral Workspaces**: Scanned repositories are written to temporary OS directories with cryptographically random identifiers and are deleted in `finally` blocks immediately upon scan completion.

*For complete threat modeling, see [docs/SECURITY.md](docs/SECURITY.md).*

---

## Automated Verification & Test Suite

CodeEq features an extensive, offline, deterministic test suite:

```text
test files: 36
tests:      285
passing:    285
failing:    0
```

### Suite Breakdown
* **`@codeeq/core`**: 23 test files, 158 tests passing
* **`codeeq` (CLI)**: 2 test files, 9 tests passing
* **`codeeq-web`**: 11 test files, 118 tests passing

Run the complete test suite locally:
```bash
pnpm test
```

---

## Known Limitations

* **Static Analysis Scope**: CodeEq does not execute repository code or test suites. Vulnerabilities that depend on dynamic runtime state or external database contents are outside static scope.
* **Ecosystem Focus**: Currently tailored for JavaScript and TypeScript ecosystems (Node.js, Next.js, Vite, React, Express).
* **Public Repositories Only**: The online web scanner exclusively processes public GitHub repositories. Private repositories can be scanned locally using the CLI.
* **GitHub Rate Limits**: Public unauthenticated web instances share GitHub's 60 req/hr public IP limit (expandable to 5,000 req/hr via server-side `GITHUB_TOKEN`).

---

## Future Roadmap

* Private repository authentication via GitHub OAuth / GitHub Apps
* Model Context Protocol (MCP) server for Claude Code and Cursor integration
* Interactive VS Code extension for inline diagnostic gutter badges
* Verified local Docker sandbox for dynamic build and test execution

---

## License

MIT © [Ali Raza](https://github.com/alibuildsx)
