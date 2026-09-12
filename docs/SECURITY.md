# CodeEq Security Architecture & Threat Model

> **Code Equilibrium** — *“Balance your AI-built code.”*  
> **Classification:** Public Developer Tooling  
> **Release:** v1.0.0

---

## 1. Threat Model & Security Objectives

CodeEq accepts untrusted public GitHub repositories and scans them in a multi-tenant cloud environment. The platform is designed under a **Zero-Execution, Zero-Trust** security architecture.

### Primary Security Objectives
1. **Prevent Code Execution**: Untrusted repository code, scripts, build steps, or install hooks must never be executed on the scanning host.
2. **Prevent Server-Side Request Forgery (SSRF)**: The scanner must never be coerced into requesting internal cloud metadata endpoints, localhost ports, or private intranet resources.
3. **Prevent Directory Traversal & Host Modification**: Malicious archive tarballs must never write, overwrite, or access files outside their ephemeral sandbox directory.
4. **Prevent Denial of Service (DoS)**: Maliciously crafted "decompression bombs", recursive tarballs, or unbounded file trees must be halted before exhausting server memory, disk, or CPU.
5. **Protect Sensitive Secrets**: Detected credentials, private keys, and tokens must never be echoed in web responses or server logs.
6. **Guarantee Resource Disposal**: Temporary workspaces must be destroyed immediately after analysis.

---

## 2. In-Depth Defensive Controls

### 2.1 Untrusted Input & SSRF Mitigation
User-supplied repository URLs undergo strict syntactic and semantic validation in [`apps/web/src/lib/github/urlParser.ts`](../apps/web/src/lib/github/urlParser.ts):
* **Protocol Whitelist**: Only `https:` is accepted. `http:`, `ftp:`, `file:`, and scheme-relative URLs (`//`) are rejected.
* **Exact Hostname Match**: Hostname must be strictly `github.com`. Subdomains (`api.github.com`, `raw.githubusercontent.com`), lookalikes, IP addresses, and CIDR blocks are rejected.
* **Credential & Port Blocking**: URLs with embedded credentials (`user:pass@host`) or non-standard ports (`:8080`) are rejected immediately.
* **Path Token Sanitization**: Pathnames must contain exactly two validated segments (`/owner/repo`). Owner and repository names accept only their documented alphanumeric, hyphen, underscore, and repository-dot character sets; traversal tokens are forbidden.
* **Redirect Policy**: Outbound requests follow redirects manually for at most three hops. Metadata remains on `api.github.com`; archives may use only `api.github.com` or `codeload.github.com`, always over HTTPS.

### 2.2 Archive Decompression & "Zip Slip" Protection
GitHub archives are downloaded as compressed tarballs (`.tar.gz`) and processed via a hardened stream extractor in [`apps/web/src/lib/archive/extract.ts`](../apps/web/src/lib/archive/extract.ts):
* **Path Traversal Guards**: Every entry's extraction target is verified using `path.resolve`. If the target does not resolve strictly within the designated temporary directory, extraction aborts with an error.
* **Link & Special-Entry Rejection**: Symlinks, hardlinks, devices, FIFOs, and other unsupported entry types fail extraction. An attacker cannot use a crafted link to write outside the workspace.
* **Stream-Level Enforcement**: Entries are inspected as they arrive in the stream before writing bytes to disk.

### 2.3 Resource Quotas & Decompression Bomb Defense
To prevent compute, memory, and disk exhaustion attacks, CodeEq enforces five thresholds:
1. **Maximum Compressed Archive**: 15 MB (`MAX_ARCHIVE_BYTES = 15 * 1024 * 1024`).
2. **Maximum Extracted Workspace**: 75 MB (`MAX_EXTRACTED_BYTES = 75 * 1024 * 1024`).
3. **Maximum File Count**: 5,000 files (`MAX_EXTRACTED_FILES = 5000`).
4. **Acquisition Timeout**: 15 seconds (`DOWNLOAD_TIMEOUT_MS = 15000`) for GitHub metadata/archive operations.
5. **Global Pipeline Timeout**: 30 seconds (`SCAN_TIMEOUT_MS = 30000`) enforced with a shared `AbortController`.

If any limit is breached, the pipeline raises `REPOSITORY_TOO_LARGE` or `SCAN_TIMEOUT`. Acquisition, extraction, and scanner traversal observe the shared abort signal cooperatively; the request waits for the active scan task to acknowledge cancellation and purge its temporary files before returning the timeout.

### 2.4 Prohibition of Target Code Execution
* **Static Analysis Only**: CodeEq parses source code purely into Abstract Syntax Trees (AST) using TypeScript compiler APIs in memory or scans with regex patterns.
* **No Package Installation**: CodeEq never executes `npm install`, `pnpm install`, or `yarn install` inside the scanned repository.
* **No Script Invocation**: CodeEq never runs `npm run build`, `npm test`, or package lifecycle scripts (`postinstall`, `preinstall`).

### 2.5 Secret Redaction & Leak Prevention
When security detectors identify API secrets, Supabase service keys, private keys, or environment tokens:
* The detected secret value is never copied to findings or serialized in reports.
* The rule captures only the variable key name, line number, and a redacted preview (e.g., `sk_live_••••••••`).
* Reports and UI components display only the key name and remediation guidance.

### 2.6 Ephemeral Workspace Lifecycle
* Workspaces are created in the OS temporary directory with cryptographically secure random suffixes (`codeeq-scan-${crypto.randomUUID()}`).
* The scanning lifecycle is wrapped in a `try ... finally` block:
  ```typescript
  const workspace = await createTempWorkspace();
  try {
    return await analyze(workspace.path);
  } finally {
    await workspace.cleanup(); // Forcefully deletes directory and all contents
  }
  ```
* Internal filesystem paths (`targetDir`, `reportPath`) are sanitized from public API payloads before returning to the browser.

### 2.7 GitHub Token Isolation
* If an operator configures `GITHUB_TOKEN` to increase API rate limits (from 60 to 5,000 requests/hour), the token is accessed exclusively on the server runtime.
* The token is never prefixed with `NEXT_PUBLIC_` and is never shipped in client bundles, headers, logs, or error responses.
* Authorization is attached only to requests whose current destination is exactly `api.github.com`; it is not forwarded to codeload or rejected redirect hosts.

---

## 3. Known Limitations & Security Boundaries

* **Public Repositories Only**: CodeEq web scanner only accesses public GitHub repositories. Private repositories are intentionally unsupported to prevent token leakage and permission elevation.
* **Static Limitations**: Static analysis cannot detect vulnerabilities that only emerge during dynamic execution or complex runtime state changes.
* **Rate Limits**: Unauthenticated public instances share GitHub's IP rate limit (60 requests/hour per outbound IP).
* **Hard CPU Preemption**: Cancellation is cooperative. One long synchronous parser operation cannot be forcibly interrupted inside the same JavaScript thread; strict archive, extracted-byte, and file-count limits bound the accepted input, while absolute preemption would require a worker/process boundary.

---

## 4. Reporting Vulnerabilities

If you discover a potential security issue in CodeEq, please submit a responsible disclosure report via GitHub Security Advisories at [https://github.com/alibuildsx/CodeEq/security/advisories](https://github.com/alibuildsx/CodeEq/security/advisories).
