# 🛡️ CodeEq

> **Version 0.2** — A local-first safety scanner for AI-built apps.

CodeEq scans a local web project and reports framework details, environment-file safety, deployment readiness, Next.js API routes, and prioritized issues. No project data leaves your machine.

## Features

- Health score from 0 to 100, weighted by issue severity
- Deployment readiness status: Ready, Needs attention, or Blocked
- Next.js App Router and Pages Router API route listing
- `.env` and `.env.local` comparison with `.env.example` using variable names only
- Supabase service-role leak detection
- Markdown and JSON output
- Optional no-write scans and custom report paths

## Monorepo

```text
packages/
├── core/          @codeeq/core — detectors, scanner, scoring, and reports
└── cli/           codeeq       — Commander CLI and file output
```

## Setup

Requires Node.js 18 or newer and pnpm 8 or newer.

```bash
pnpm install
pnpm build
```

## Usage

```bash
# Scan the current directory and write PROJECT_HEALTH_REPORT.md
codeeq scan

# Scan another project
codeeq scan ../my-next-app

# Print a terminal summary without writing Markdown
codeeq scan --no-write

# Print machine-readable JSON (the Markdown report is still written by default)
codeeq scan --json

# Write Markdown to a custom path relative to the scanned project
codeeq scan --report reports/CODEEQ_REPORT.md
```

During development, replace `codeeq` with `pnpm --filter codeeq dev`, for example:

```bash
pnpm --filter codeeq dev scan --no-write
```

Options can be combined. Use `--json --no-write` for JSON-only output with no filesystem write.

## Health score

Every scan starts at 100 and subtracts:

| Severity | Deduction |
|----------|-----------|
| Critical | 30 |
| High | 20 |
| Medium | 10 |
| Low | 5 |

The score never falls below 0. Deployment readiness is Blocked by any critical or high issue, Needs attention when medium issues are present, and Ready otherwise.

## Report

The Markdown report contains:

- Project Info
- Health Score
- Deployment Readiness
- API Routes
- Issue Summary
- Issues
- Next Steps

Environment findings contain variable names only; CodeEq does not include secret values in reports.

## Issue codes

| Code | Severity | Trigger |
|------|----------|---------|
| `ENV_NOT_GITIGNORED` | Critical | `.env` is not ignored by Git |
| `ENV_LOCAL_NOT_GITIGNORED` | Critical | `.env.local` is not ignored by Git |
| `SUPABASE_SERVICE_ROLE_LEAKED` | Critical | A likely Supabase service-role assignment is found |
| `NEXT_PUBLIC_LIKELY_SECRET` | High | A public environment variable name looks sensitive |
| `ENV_NO_EXAMPLE` | Medium | `.env` or `.env.local` exists without `.env.example` |
| `ENV_EXAMPLE_MISSING_VARIABLES` | Medium | Required variable names are absent from `.env.example` |
| `MISSING_BUILD_SCRIPT` | Medium | `package.json` has no `build` script |
| `MISSING_START_SCRIPT` | Low | A Node/Next.js project has no `start` script |
| `NEXTJS_MISSING_CONFIG` | Low | A Next.js project has no `next.config.*` file |

## Tests

```bash
pnpm test
pnpm --filter @codeeq/core test
pnpm --filter codeeq test
```

## Scope

CodeEq v0.2 is local-only and non-destructive. It does not include an MCP server, VS Code extension, dashboard, AI API calls, or auto-fix mode.
