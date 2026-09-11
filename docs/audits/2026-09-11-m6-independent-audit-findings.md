# CodeEq M6 Independent Audit Findings

Audit date: 2026-09-11  
Auditor: Codex, independent from the implementation agent  
Base: `feat/m5-portfolio-release` at `b838af2b35dd783d51dd308985b8836dd374f47b`  
Audit branch: `audit/m6-codex-final`

## Baseline

- The source checkout was clean and matched the requested commit.
- Runtime: Node.js `v24.18.0`; pnpm initially reported `11.19.0` and the workspace install used pnpm `11.10.0`.
- `pnpm install` succeeded with no lockfile change.
- `pnpm build` passed for core, CLI, and the Next.js application.
- The claimed clean baseline of 285/285 tests is not reproducible. Actual clean-worktree result: 36 files, 285 tests, 283 passing, 2 failing.
- Both failures are in `fixturePack.test.ts`. The configuration and security fixtures require `.env` files that existed only as ignored files in the original developer checkout and were absent from Git.
- CLI fixture scans completed without crashes. Healthy returned 100/Ready; broken, security, and dependency fixtures returned Blocked/exit 1; messy returned Needs attention/exit 0. JSON, normal output, `--no-write`, and explicit `--report` behavior were exercised.
- Production dependency audit: 29 advisories (2 critical, 12 high, 13 moderate, 2 low), dominated by the unsupported/vulnerable Next.js 14 line.

## Architecture Assessment

The monorepo boundaries are generally sound: core owns static analysis and result construction, CLI owns local presentation and exit behavior, and web owns GitHub acquisition, sanitization, and the dashboard. No target-repository build, package installation, dynamic import, or execution path was found in the web flow.

The principal architectural weaknesses are at trust boundaries rather than package layout: web acquisition relies on automatic redirects, the overall timeout does not cancel work, tracked-file semantics are lost in GitHub archives, and the API reads unbounded JSON before validation. Core also imports TypeScript at runtime while declaring it as a development-only dependency.

## Confirmed Issues

### M6-001

- Priority: P0
- Area: Dependency security
- Evidence: `pnpm audit --prod` reports 29 production advisories against Next.js 14.2.35, including two critical unauthenticated RCE-class advisories. The first maintained patch line containing both fixes is Next.js 15.5.24.
- User Impact: A deployed release would run a framework version with known critical remote vulnerabilities.
- Recommended Fix: Upgrade to maintained Next.js 15.5.24 with React 19 and matching type packages, then run all tests, build, and browser verification.

### M6-002

- Priority: P1
- Area: Reproducibility / tests
- Evidence: Clean worktree tests fail because two required fixture `.env` files are ignored and untracked; the original checkout happened to contain local copies.
- User Impact: Fresh clones and CI cannot reproduce the claimed release state, and security/configuration acceptance coverage silently depends on developer-local state.
- Recommended Fix: Commit safe, obviously fake fixture environment files intentionally and retain regression assertions.

### M6-003

- Priority: P1
- Area: Web resource exhaustion / cleanup
- Evidence: `scanGithubRepository` uses `Promise.race()` for the 30-second overall timeout. It does not cancel download, extraction, or core scanning, and workspace cleanup waits for the losing promise to settle.
- User Impact: Timed-out requests can continue consuming disk, I/O, and CPU and can retain temporary workspaces beyond the HTTP response.
- Recommended Fix: Introduce a shared abort signal, make acquisition/extraction/static traversal cooperative, and await cancellation/cleanup before returning the timeout error.

### M6-004

- Priority: P1
- Area: SSRF / redirect boundary
- Evidence: GitHub metadata and archive requests use Fetch's implicit `redirect: follow`. Redirect destinations are not validated. The archive request may legitimately redirect to GitHub-controlled codeload infrastructure, but arbitrary destinations are not rejected by CodeEq itself.
- User Impact: A compromised or unexpected upstream redirect can weaken the server's outbound-request allowlist and may expose authorization behavior to destinations outside the intended GitHub boundary.
- Recommended Fix: Follow redirects manually with a small hop cap and an explicit HTTPS host allowlist; send the GitHub token only to `api.github.com`.

### M6-005

- Priority: P1
- Area: Web API hardening
- Evidence: `/api/scan` calls `request.json()` before imposing a byte limit, and known `ScanError.message` values are returned verbatim. Several internal errors may embed filesystem paths or low-level stream messages.
- User Impact: Oversized bodies can consume unnecessary memory, and crafted failures can disclose local paths or server internals.
- Recommended Fix: Read a bounded request body, parse JSON explicitly, map public messages from canonical error codes, and keep internal details server-side.

### M6-006

- Priority: P1
- Area: Online environment-file security
- Evidence: The tracked-env detector runs `git ls-files` only when the scan root contains `.git`. GitHub source archives contain tracked files but no `.git`, so a committed `.env` can evade `ENV_FILE_TRACKED`; if `.gitignore` also names it, no equivalent finding is guaranteed.
- User Impact: The public scanner can miss one of the highest-value repository hygiene failures it advertises.
- Recommended Fix: Add an explicit trusted scan-context flag indicating that archive contents represent tracked repository files and use it when evaluating environment files.

### M6-007

- Priority: P2
- Area: Configuration false positive / readiness
- Evidence: Every valid package without `scripts.build` receives blocking `MISSING_BUILD_SCRIPT`. Live scan of `sindresorhus/emittery`, a legitimate source-shipping JavaScript library, returned Blocked for this reason.
- User Impact: Credible libraries, CLIs, and simple Node packages are incorrectly declared undeployable.
- Recommended Fix: Require a build script only for detected frontend/build frameworks where a production build is semantically expected; preserve coverage for actual applications.

### M6-008

- Priority: P2
- Area: Import and dependency analysis false positives
- Evidence: Regex-based extraction reads import-looking text inside strings/templates. Resolution does not normalize query/hash suffixes and misses `.jsx` specifiers backed by `.tsx`. Ordinary `test/` and `tests/` directories are not treated as tests. Package self-references can be reported undeclared. Real scans of Vite's React plugin and Express reproduced these cases.
- User Impact: Mature repositories receive large, embarrassing batches of false unresolved-import, undeclared-dependency, and large-source findings.
- Recommended Fix: Extract imports from the TypeScript AST, normalize resource suffixes, expand compatible extension resolution, exclude ordinary test directories from production diagnostics, and recognize package self-reference.

### M6-009

- Priority: P2
- Area: Archive extraction
- Evidence: POSIX absolute and traversal paths are rejected, but drive-letter paths are sanitized into relative paths instead of rejected; mixed separator handling is incomplete. Existing tests omit several requested hostile entry types and malformed archive cleanup behavior.
- User Impact: Current containment checks prevent the observed paths from escaping, but ambiguous hostile names are accepted rather than failed closed and regression confidence is incomplete.
- Recommended Fix: Reject drive-letter, UNC, root-relative, and mixed-separator traversal names before extraction; add entry-type and malformed-archive regressions.

### M6-010

- Priority: P2
- Area: Project intelligence accuracy
- Evidence: Language detection checks only a handful of root paths, API route discovery is TypeScript-only, and authentication inference treats generic database SDK presence as authentication usage.
- User Impact: Nested TypeScript and JavaScript route projects are underreported, while some database-only projects are mislabeled as using an auth provider.
- Recommended Fix: Infer language from collected source files, include JS/JSX/MJS/CJS route forms, and require explicit auth-library evidence.

### M6-011

- Priority: P2
- Area: Vibe-code heuristic quality
- Evidence: Two Supabase client files always trigger `MULTIPLE_SUPABASE_CLIENTS`, including the normal SSR pattern of one browser client and one server client.
- User Impact: Recommended Supabase architectures can be flagged as unhealthy.
- Recommended Fix: Distinguish browser, server, and generic client factories and flag only duplicate factories of the same kind.

### M6-012

- Priority: P2
- Area: Frontend reliability and accessibility
- Evidence: A failed rescan stores an error while leaving the success screen active, where that error is not rendered. Finding cards are clickable `<article>` elements without keyboard semantics. Browser inspection confirmed the search field has no accessible label and the diagnosis dialog neither receives focus nor restores it.
- User Impact: Rescan failures can appear to do nothing, and keyboard/screen-reader users cannot reliably open or navigate findings.
- Recommended Fix: Transition failed rescans to the error state, use button semantics for cards, label search, and implement dialog focus entry/trap/restore.

### M6-013

- Priority: P2
- Area: Package metadata
- Evidence: `@codeeq/core` imports `typescript` in runtime detector code but declares it only in `devDependencies`.
- User Impact: Consumers installing the core package independently can receive a runtime module-not-found failure.
- Recommended Fix: Move TypeScript to core production dependencies and verify package exports/build.

### M6-014

- Priority: P2
- Area: Local filesystem traversal
- Evidence: recursive source traversal uses `stat`, follows directory symlinks, and has no visited-realpath guard.
- User Impact: A local scan can recurse through cycles or unexpectedly scan outside the requested tree.
- Recommended Fix: use `lstat` and skip symbolic links consistently in traversal helpers.

### M6-015

- Priority: P3
- Area: Documentation / release claims
- Evidence: README and architecture docs describe severity deductions as 30/20/10/5 rather than 25/15/8/3; security docs claim a 60-second aborting timeout rather than a 30-second non-cancelling race; release docs describe CLI exit codes 0/1/2/3 while implementation uses 0 for Ready/Needs attention and 1 for Blocked/runtime; README uses machine-local `file:///` links and claims 285 passing tests on a clean clone.
- User Impact: Operators and reviewers receive incorrect security, scoring, CLI, and reproducibility information.
- Recommended Fix: Align concrete claims with verified implementation after fixes and replace local links with repository-relative links.

## Suspected But Unconfirmed Issues

- Same-thread JavaScript static analysis cannot provide a hard CPU preemption boundary. Cooperative cancellation plus strict archive/file/byte caps should materially bound work, but a worker/process boundary would be needed for absolute preemption.
- The root-level Vercel configuration builds successfully locally and is structurally valid, but deployment project dashboard Root Directory settings are external state and cannot be proven from the repository.
- Core's local tracked-env check launches `git`, which is host tooling rather than target code. It is safe in the GitHub-archive path because archives have no `.git`, but it should remain explicit in security documentation.

## Areas Verified Correct

- GitHub URL parsing rejects non-HTTPS URLs, alternate hosts, deceptive suffix hosts, credentials, ports, excessive path segments, and invalid owner/repository characters.
- Archive containment uses a resolved destination-root check and rejects symlink/hardlink/device-style entries already represented by the implementation.
- Downloaded and extracted byte/file caps are present: 15 MB archive, 75 MB extracted, and 5,000 files; download timeout is 15 seconds.
- Temporary workspaces use random UUID directories and clean up on normal success and ordinary failure.
- No target repository code execution path was found: no target package install, build, test, dynamic import, eval, spawn, or require occurs in the online scan.
- Public result sanitization removes `targetDir`, `reportPath`, and the legacy `issues` alias and converts finding paths to repository-relative form.
- Secret evidence is redacted in detector findings; safe fake credentials did not appear raw in CLI JSON or Markdown output.
- Health calculations are deterministic, clamped to 0..100, and order-invariant in existing behavior tests.
- Frontend uses core-provided health/readiness rather than recomputing it.
- The dashboard rendered meaningful content with no framework overlay or browser console errors, and the public demo flow reached a canonical result.

## Proposed Fix Set

1. Restore clean-clone fixture reproducibility and repair package runtime metadata.
2. Upgrade the web stack to the maintained patched Next.js 15 line and verify its React 19 migration.
3. Harden API input/error handling, redirect policy, archive names, cancellation, and cleanup.
4. Correct online tracked-env semantics.
5. Reduce confirmed scanner false positives and project-intelligence false negatives with focused regression tests.
6. Correct the Supabase heuristic and symlink traversal behavior.
7. Repair rescan error handling and dashboard accessibility without redesigning the interface.
8. Update release/security/architecture documentation to match the verified implementation.
9. Re-run all package tests, production build, CLI fixtures, browser checks, dependency audit, and representative real-repository scans.
