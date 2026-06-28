# 🛡️ project-safety-layer

> **Version 0.1** — Local-first project health scanner for vibe coders.

Scan any local web project and get an instant health report: detected framework, package manager, env file safety, Supabase key leaks, and more. No cloud calls. No data leaves your machine.

---

## ✨ Features (v0.1)

| Category | What it detects |
|----------|----------------|
| **Project Info** | Name, framework, language, package manager |
| **File Presence** | `src/`, `app/`, `pages/`, `.env`, `.env.local`, `.env.example`, `.gitignore`, `vercel.json` |
| **Env Safety** | `.env` / `.env.local` not in `.gitignore` |
| **Secret Leaks** | Supabase `service_role` key in source files |
| **NEXT_PUBLIC_** | Variables whose names look like private secrets |
| **Build Config** | Missing `build` script in `package.json` |
| **Next.js** | Missing `next.config.*` file (low severity warning) |

---

## 📦 Monorepo Structure

```
packages/
├── core/          @project-safety/core — all scanner + report logic
└── cli/           project-safety-cli   — Commander CLI wrapper
```

---

## 🚀 Setup

### Prerequisites

- Node.js ≥ 18
- pnpm ≥ 8 ([install](https://pnpm.io/installation))

### Install & Build

```bash
# Clone the repo and enter it
cd project-safety-layer

# Install all workspace dependencies
pnpm install

# Build both packages (TypeScript → dist/)
pnpm build
```

---

## 🖥️ Usage

### Development mode (no build needed)

```bash
# Scan the current working directory
pnpm --filter project-safety-cli dev scan

# Scan a specific project
pnpm --filter project-safety-cli dev scan /path/to/your/project
pnpm --filter project-safety-cli dev scan ../my-nextjs-app
```

### After building

```bash
# Using the compiled bin
node packages/cli/dist/index.js scan /path/to/project

# Or link globally
cd packages/cli
npm link
project-safety scan /path/to/project
```

---

## 📄 Output

### Terminal Summary

```
┌─────────────────────────────────────────────┐
│  🛡️  project-safety scan results             │
├─────────────────────────────────────────────┤
│  Project:   my-nextjs-app                   │
│  Framework: Next.js                         │
│  Stack:     TypeScript + pnpm               │
├─────────────────────────────────────────────┤
│  🔴 Critical      2                         │
│  🟠 High          1                         │
│  🟡 Medium        0                         │
│  🔵 Low           1                         │
├─────────────────────────────────────────────┤
│  Report:    ./PROJECT_HEALTH_REPORT.md      │
└─────────────────────────────────────────────┘
```

### Markdown Report

A `PROJECT_HEALTH_REPORT.md` file is written to the scanned project's root directory. It contains:

- Project info table
- Issue summary table by severity
- Full issue list with codes, titles, and fix guidance

---

## 🔍 Issue Codes

| Code | Severity | Trigger |
|------|----------|---------|
| `ENV_NOT_GITIGNORED` | 🔴 Critical | `.env` not in `.gitignore` |
| `ENV_LOCAL_NOT_GITIGNORED` | 🔴 Critical | `.env.local` not in `.gitignore` |
| `SUPABASE_SERVICE_ROLE_LEAKED` | 🔴 Critical | `service_role` text in source files |
| `ENV_NO_EXAMPLE` | 🟠 High | `.env` exists but `.env.example` missing |
| `NEXT_PUBLIC_LIKELY_SECRET` | 🟠 High | `NEXT_PUBLIC_*` var name looks like a secret |
| `MISSING_BUILD_SCRIPT` | 🟡 Medium | No `build` script in `package.json` |
| `NEXTJS_MISSING_CONFIG` | 🔵 Low | Next.js project without `next.config.*` |

---

## 🧪 Tests

```bash
# Run all tests
pnpm test

# Run tests for core package only
pnpm --filter @project-safety/core test
```

---

## 🛣️ Roadmap

- **v0.2** — More detectors (exposed API keys, hardcoded URLs, missing `lint` script)
- **v0.3** — VS Code extension integration
- **v0.4** — MCP server for AI assistants
- **v0.5** — Web dashboard

---

## 📝 Notes

- **No network calls** — everything runs locally.
- **Non-destructive** — the scanner never modifies your project files.
- **Exit codes** — exits with code `1` if any `critical` issues are found (useful in CI).
- **Report location** — `PROJECT_HEALTH_REPORT.md` is written to the scanned directory and silently overwritten on each run.

---

*Built with TypeScript, pnpm workspaces, Commander, Zod, and Vitest.*
