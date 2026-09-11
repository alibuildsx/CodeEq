# CodeEq M6 Final Audit Remediation Plan

> Execute on `audit/m6-codex-final`; do not merge to `master`.

**Goal:** Resolve every confirmed P0/P1/P2 release issue from the independent audit while keeping the product scope unchanged.

**Approach:** Preserve the existing core/CLI/web boundaries. Add behavior-level regressions first, make the smallest compatible corrections, and commit by risk area. Security controls remain layered: strict identity parsing, explicit redirect destinations, bounded request/archive/workspace sizes, cooperative cancellation, fail-closed extraction, sanitized DTOs, and canonical public errors.

**Stack:** TypeScript, Node.js, pnpm workspaces, Vitest, Next.js App Router, React.

---

## Task 1: Reproducibility and package metadata

**Files:** fixture `.env` files under `packages/core/test-fixtures`, `packages/core/package.json`, lockfile, fixture/package-export tests.

1. Add safe fake fixture files with `apply_patch`, intentionally force-add them despite the repository-wide ignore rule.
2. Re-run the two failing fixture assertions and then all core tests.
3. Add/adjust a package metadata assertion proving runtime TypeScript is a production dependency.
4. Move TypeScript to core dependencies and refresh the lockfile.
5. Commit the reproducibility/package boundary fix.

## Task 2: Critical framework upgrade

**Files:** `apps/web/package.json`, lockfile, any migration-required web files.

1. Load the Next.js upgrade guidance and pin the maintained 15.5.24 security release with React 19 and matching type packages.
2. Install, run web tests, and build.
3. Apply only migration changes required by compiler/runtime evidence.
4. Re-run production dependency audit and commit the upgrade.

## Task 3: Core scanner correctness

**Files:** detector/traversal sources and focused tests in `packages/core/src`.

1. Write failing regressions for source-shipping packages without build scripts, import-like strings/templates, query/hash imports, `.jsx` to `.tsx`, test directories, package self-reference, nested TypeScript, JavaScript API routes, database-only auth, SSR Supabase clients, and symlink traversal.
2. Replace regex import extraction with AST-derived module specifiers shared by code-health and dependency detection.
3. Normalize resource suffixes and extension candidates; recognize self-reference and ordinary test directories.
4. Contextualize build-script findings to application frameworks.
5. Improve project intelligence and Supabase client classification.
6. Use `lstat` to skip symbolic links.
7. Run focused tests and the complete core package suite; commit.

## Task 4: Web trust-boundary hardening

**Files:** GitHub client, archive extraction, scan service, route, errors/types, and their tests.

1. Write failing tests for arbitrary redirects/token forwarding, redirect loops/hops, oversized body, canonical errors, drive/UNC/mixed traversal archive names, tracked `.env` archive semantics, cancellation, and timeout cleanup.
2. Implement explicit HTTPS GitHub host redirect policy with a hop limit and host-scoped authorization.
3. Add a bounded body reader and canonical public error mapping.
4. Reject ambiguous hostile archive names before extraction.
5. Add a shared `AbortSignal` through acquisition, extraction, and core traversal; on timeout, abort and wait for workspace cleanup before returning.
6. Pass the tracked-archive context to core env detection.
7. Run web tests and complete workspace tests; commit.

## Task 5: Frontend reliability and accessibility

**Files:** page/results components, component tests, styles if required.

1. Add failing tests for rescan failure state, keyboard finding activation, search label, dialog focus entry, Escape close, and focus restore.
2. Use semantic buttons for finding cards, provide the search label, and implement dialog focus management/trap/restore.
3. Route failed rescans into the visible error state.
4. Run web tests and browser verification; commit.

## Task 6: Documentation and final verification

**Files:** README and docs.

1. Correct deductions, timeout/cancellation behavior, exit codes, dependency/runtime versions, local links, limits, and test claims.
2. Re-run `pnpm test` and record exact package/file/test counts.
3. Re-run `pnpm build`, `pnpm audit --prod`, and all CLI fixture modes.
4. Re-scan representative public repositories and record before/after results.
5. Repeat browser and API security checks, inspect Git status/diff, and commit documentation/audit results.
