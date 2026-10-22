# v0.3 gates, extension effort, and operating-cost evidence

## Authoritative scope

The gate numbers here belong to the earlier delivery sequence, not the eight-step prototype roadmap. See the [prototype promise/proof contract](prototype-contract.md), [current interaction walkthrough](reference.md#try-the-workflows), and [independent-agent extension proof](extension-proof.md) for roadmap steps 1–4. Their interaction/reuse improvements do not add enterprise identity, provider writes, or a production-readiness claim. Counts and measurements below describe the earlier fixed increment, not the combined parallel change set.

This implementation follows **3 → narrow 4 → 5a; 5b is a separate decision**. Earlier attached planning documents describe a larger potential platform; they are not implementation evidence. The reusable product is for engineers working with Devin, not a no-code builder. All original tools remain synthetic/browser-local; no saved browser work is promoted to authenticated history.

| Gate                   | Evidence delivered                                                                                                                                                                                              | What it does not prove                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 3: non-queue extension | Custom-page registry; transaction lookup, summary/provenance/timeline; clean/conflicting/unavailable/stale/no-match/incomplete synthetic sources; targeted simulated retry; saved-work regression               | Actual provider reliability, client-specific workflow fidelity, zero core edits, or independent human extension effort                     |
| Narrow 4: shared KYC   | Independent password sessions, operator/viewer API policy, SQLite state/history/command transaction, optimistic concurrency, duplicate request replay, restart and backup/restore tests; async save/conflict UI | Enterprise SSO/MFA, tenant/field isolation, approvals, compliant audit retention, production operations, or a migration of all three tools |
| 5a: read-only adapter  | Protected, fixed-endpoint Stripe test-mode snapshot; strict input/output; no-key state; timeouts/status/errors/unmapped results tested with mocked transport                                                    | Live sandbox connectivity: provider choice/credential and a known useful test ID are still needed                                          |
| 5b: writes             | **Deferred / not required for these collaboration and read-only proofs**                                                                                                                                        | No external write, durable execution, provider idempotency, settlement, or reconciliation guarantee exists                                 |

Before approving 5b, name a concrete useful external-write operation and inspect provider guarantees. Its own design must include durable intent, requested/confirmed/failed/outcome-unknown states, authority rechecks, provider-supported idempotency, bounded recovery, callback ordering/deduplication, and reconciliation. Do not infer exactly-once behavior from the local KYC command-result table.

## Extension effort ledger

Baseline: `33ae3c3b6c5289f9a9c97c9a0f79be0c1197158e` (steps 1–2, already pushed before this work). Count combined steps 3–5a changes with:

```sh
git diff --numstat 33ae3c3 -- src server
git diff --name-only 33ae3c3
```

Classify by ownership, not just directory: the shared API client and custom-page registry are core, not module-only edits. Record added/deleted lines separately; neither measures engineering quality. The accompanying implementation touches **5 module/custom-view/adapter files** versus **15 shared frontend/backend files**, plus tests/tooling/documentation (see categories below). This is a combined foundation-building change set, **not** a claim that adding every subsequent tool needs—or avoids—this much core work.

| Ownership                           | Files                                                                                        | Why changed                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Custom/domain views                 | `Investigation`, `evidence`, `SharedKyc`, `SandboxLookup`                                    | New non-queue evidence workflow and separate shared KYC client                                                                   |
| Provider adapter                    | `server/sandbox.ts`                                                                          | Explicit Stripe read-only test contract; no generic connector framework                                                          |
| Shared frontend (10 files)          | App, About, ToolView, RecordDrawer, actions, types, views, styles, API helper, page registry | Route seam, truthful mode labels, async saving, conflict review, account-scoped preferences, active-account assignment choices   |
| Shared backend (5 files)            | app, store, index, backup, measure                                                           | Authentication/policy, relational tables, transactional history/replay, lifecycle, backup and reproducible resource measurements |
| Regression/security tests (6 files) | Feature tests, shared-client tests, API tests, adapter tests, backup test, setup CLI test    | Keep original behavior and exercise new contracts; not a browser E2E suite                                                       |
| Tooling/docs                        | Node 24 requirement, package/lockfile, TS/Vite/Vitest/CI, ignore rules, README, this ledger  | No pre-existing server was present; CI now includes server tests and formatting                                                  |

Measured source diff for this increment (excluding tests, tooling, and docs): module/custom-view/adapter code **+714 / −0 lines** across 5 files; shared frontend/backend code **+781 / −60 lines** across 15 files. These counts are observational, not target ratios. Lockfile changes are deliberately excluded.

Step 3 alone is primarily two module-owned files plus a small page-registry/navigation/type/style seam. It does **not** add a fake table module or a fourth persisted record array. Existing browser schema v2 and v1→v2 migration remain unchanged. A future persisted queue still needs an additive migration. The later shared slice deliberately reuses table/drawer/domain rules but makes API authorization and database ownership explicit; navigation is not a security boundary.

### Review and regression accounting

- Baseline: **58** frontend unit/component tests. This increment adds **8** investigation/compatibility/error-state and shared-client tests, plus **30** real HTTP/SQLite, setup/backup CLI, and mocked-provider tests. The original suites remain in the same test run; no baseline assertions were deleted to hide regressions.
- Implementation checks: formatting, ESLint, strict TypeScript (including server code), frontend tests, Node API/SQLite tests, production bundle, dependency audit, whitespace check. See CI for the final revision's result.
- Security scenarios: unauthenticated reads/writes, direct viewer mutations, forged actors/module/input, invalid assignment targets, origin/CSRF rejection, expired/revoked/logout sessions, competing versions, replay/mismatched replay payload, history-insert rollback, database restart, WAL backup/restore, unconfigured provider, only-test keys/results, provider error/status/timeout contracts, allowlisted non-secret response.
- Real-browser UI testing: **not performed**. jsdom mocks dialogs; cookie policy in Chrome, focus management, layout, and two-profile UI interaction are not independently proven by these tests.
- Human specification/review time: **not measured yet—not zero**. This was built by the same agent that created the seam; an independent engineer has not added a fifth tool. Do not substitute test count or agent wall time for human review effort.
- During implementation, test-query ambiguity/fixture-name assumptions were corrected and the conflict-refresh control was moved inside the modal so users need not close it and lose text. Async client tests assert retained input, replay ID reuse, and explicit review before rebasing a version.

For the next independent extension, record start/stop timestamps for specification, Devin supervision, review, and remediation; module/core files and diff sizes; regression failures caused; policy exceptions; and deployment/operating work. Ask the reviewer to explain evidence conflicts/missing sources and reject a forged mutation. Gate expansion on that evidence, not a fourth screen count.

## Measured local resource envelope

Reproduce with `npm run measure`. It creates/removes a throwaway SQLite database, generates ephemeral credentials without printing them, and runs one login, **100 sequential authenticated reads + 20 notes**, on loopback in one process. It makes **zero** provider calls. It is a tiny diagnostic, not a load/capacity test, service-level target, or cloud cost quote. The same process includes the HTTP client, TypeScript runtime, and server overhead.

One observed run on this VM / Node **v24.19.0**:

| Measurement                                       | Observed           |
| ------------------------------------------------- | ------------------ |
| Login                                             | 64.40 ms           |
| Read p50 / p95                                    | 1.95 / 3.87 ms     |
| Note-write p50 / p95                              | 2.87 / 11.11 ms    |
| Diagnostic elapsed / CPU                          | 360.70 / 289.24 ms |
| Process RSS                                       | 153.07 MiB         |
| Database + WAL + shared-memory files before close | 514,816 bytes      |

These fluctuate with VM contention, tsx runtime, disk, queue/history size, and concurrency. Login uses synchronous scrypt; SQLite calls are synchronous. No extrapolation to 60 engineers or 13 operational apps is justified. Bundle generation and audit results are build-time checks, not runtime availability evidence.

## Operating-cost worksheet (inputs not yet priced)

| Cost driver            | Current evidence                                                          | Input required for an operational estimate                                                                             |
| ---------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| App compute / disk     | Single Node process + SQLite; small local resource sample above           | Approved hosting, concurrency, availability, region, persistent storage pricing                                        |
| Backups / restore      | Online backup CLI + automated restore smoke test                          | Backup frequency, encrypted offsite storage, retention, restore objectives, named owner                                |
| Identity / access      | Demo passwords; one workspace                                             | SSO/MFA provider, provisioning/deprovisioning, tenant/field scope, role review                                         |
| Provider connectivity  | One manual GET, no automatic retries, local request budget; no live usage | Chosen provider/plan, quotas, test resources, expected lookup volume, support obligations                              |
| Monitoring / support   | Local stdout startup/errors sanitized; no managed observability           | Logs/metrics/alerting spend, on-call coverage, incident ownership                                                      |
| Engineering / security | Module/core ledger and regression suite; independent review time unknown  | Loaded hourly cost × measured implementation/review/maintenance/migration hours                                        |
| Licensing transition   | Reported $250K/year existing spend only                                   | Avoidable portion, contract term/exit fees, required remaining Microsoft capabilities/licenses, overlap during rollout |

Use: **annual TCO = 12 × (hosting + disk + backups + network + identity + monitoring + provider costs) + ongoing engineering/support hours × loaded rate**, with migration/security rollout as separate one-time cost. Compare to the **verified avoidable** license portion, not automatically $250K. No cloud services were provisioned, no bill was inspected, and no savings amount is claimed.

## Potential next steps — validate the current prototype

**Status: scoped proposals, not executed or authorized by this planning update.** The code paths exist; credential provisioning, real sandbox validation, and browser evidence are separate remaining work. Keep synthetic data, the engineer-with-Devin reuse boundary, and step 5b's external-write deferral.

### Sequence and decisions

| Package                                       | Dependency / decision                                                                                                                       | Relative complexity                                                                         | Proposed responsibility                                                    | Completion evidence                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A. Enable secure Shared KYC demo login        | Choose approved demo environment, data path, credential custodian, and session-only vs future secret storage                                | Small configuration task with existing scripts; account recovery/SSO would be separate work | Demo owner supplies/approves secrets; engineer/Devin provisions and checks | Two operators and one viewer sign in; separate sessions, persistence, and logout confirmed without leaking credentials          |
| B. Validate one real read-only sandbox lookup | Confirm Stripe or a different provider; obtain a restricted test read key and an existing matching test object ID; authenticated API from A | Small–medium if using current Stripe adapter; re-scope if provider changes                  | Sandbox account owner grants access; engineer/Devin verifies               | Sanitized provider response matches expected test snapshot; errors are not mistaken for success; live-call limitations recorded |
| C. Record real-browser validation             | Explicit UI-testing approval; A for shared flows. B only for the real-provider portion                                                      | Medium, driven by multi-profile and failure-state checks; fixes not yet estimated           | Engineer/Devin testing agent executes; demo owner reviews evidence         | Annotated recording + pass/fail/untested matrix tied to a revision, environment, and starting state                             |

**Recommended order: A → C (core workflows), with B → C (provider checks) when credentials are available.** Do not block useful browser validation on a provider decision: without B, test the explicit **not-connected** state and leave actual connectivity marked **untested**. No hosting migration or new platform abstraction is needed just to run these checks.

### A. Secure demo-password setup

**Scope / inputs**

- Use the existing identities: `alex@example.test` and `jamie@example.test` are operators; `viewer@example.test` is read-only. These remain fictional demo accounts, not enterprise identity or segregation-of-duties policy.
- Before changing anything, establish whether the selected database is already provisioned, using non-sensitive account metadata only. Preserve existing records and history. Use an explicitly approved disposable database for destructive/isolated testing, never a silent reset of someone's saved work.
- Choose **skip for now**, **session-only secure provision**, or **save for future Devin sessions**. If saving, choose access scope deliberately: a repository-scoped secret is not automatically injected into shells; bind it explicitly when running setup. Do not put passwords in chat, committed files, command arguments/history, logs, screenshots, or the blueprint.
- Supply unique, unpredictable 12–128 character values for `DEMO_ALEX_PASSWORD`, `DEMO_JAMIE_PASSWORD`, and `DEMO_VIEWER_PASSWORD` through the secure secret flow. Run existing `npm run server:setup` once against the intended database; unset setup-only variables afterward. Configure exact `APP_ORIGIN`, HTTPS preview access, and persistent private database storage; keep the API loopback-only.

**Acceptance**

1. Each identity signs in with its own credentials; invalid passwords fail and no default credentials are accepted.
2. Independent browser profiles hold Alex and Jamie concurrently. A saved assignment/note is visible to the other operator after refresh, with correct actor and version.
3. Viewer can inspect authorized cases/history but cannot mutate, including via a direct authenticated request; unauthenticated access is denied.
4. Logout invalidates that session; reload/restart preserves shared records/history. HTTPS cookies have the intended HttpOnly/Secure/SameSite policy.
5. Browser-local work is unchanged and no credential appears in the frontend bundle, captured evidence, or logs.

**Tradeoffs / edge cases:** session-only secret storage does **not** remove the SQLite password hashes or invalidate sessions automatically. Setup leaves existing accounts unchanged: rerunning it with new values is **not password rotation or recovery**. If credentials are lost, stop and agree on an explicit recovery/rotation follow-up; do not overwrite the database. End-of-demo session revocation, test-account handling, and secret retention/revocation need an owner. SSO/MFA, self-service recovery, and an account-management UI are outside this package.

### B. Real sandbox connectivity, still read-only

**Scope / inputs**

- Confirm that the useful question is “what status and amount does this test PaymentIntent report?” Stripe remains illustrative, not evidence of the client's provider. Another provider requires a new capability/permission review and adapter estimate, not just swapping a URL.
- The sandbox owner supplies a restricted **test-mode read** credential, the intended account/environment, one existing synthetic `pi_…` object, and expected amount, currency, and provider status. Prefer least privilege; do not automatically broaden permissions when access fails. Creating provider objects or changing provider configuration is not an action exposed by Workbench.
- Offer the same skip/session-only/future-secret choices as A. Bind `STRIPE_TEST_KEY` to the server only, never a `VITE_` variable. Restart the API securely and make a small number of manual authenticated GET lookups. Do not create/confirm/refund/cancel payments or stress the provider to provoke rate limits.

**Acceptance**

1. A real test-account lookup returns the expected ID, original provider status, amount in currency minor units, provider-created time, source, and retrieval timestamp. It remains a **single-object snapshot**, not full history, settlement, or reconciliation.
2. Invalid input is rejected locally; a known missing test object is clearly not-found **in the configured test account**, not proof the object is absent everywhere. Rejected/revoked credentials or missing read permission are unavailable, never a successful fallback; check account/environment before changing permissions.
3. Missing credentials, invalid/live key classes, timeouts, 429/5xx, malformed/incomplete responses, and unknown statuses retain honest UI meanings. Use existing mocked contracts or controlled test faults for failures that cannot safely be produced live; label their evidence **mocked**, not provider-validated.
4. A later failed refresh marks an earlier good snapshot stale; it is not silently merged into the synthetic investigation timeline or presented as current. Unknown provider status is visibly unmapped, not a confirmed business outcome.
5. Record only sanitized expected/actual fields, revision, timestamp, request count, and which checks were real vs mocked/untested. No API keys, cookies, Authorization headers, or unredacted network exports in evidence.

**Tradeoffs / exit:** if no provider/key/object is supplied, keep **not-connected / live validation untested**; do not substitute fixture success. A broad test secret key is not equivalent to read-only credentials even though this adapter issues only GETs. Account owners handle key rotation/revocation and scope review. Stop/clear the runtime key after a session-only exercise; agree separately whether saved secrets remain. No external-write design or approval is implied.

### C. Real-browser UI validation

**Scope / prerequisites**

- Obtain explicit approval before handing off to the testing agent. This request scopes testing; it is **not** permission to execute it. The agent owns server/browser/login setup and recording when approved.
- Test a named commit against the intended exact-origin preview/local environment. Start with known synthetic cases, pre-action versions, isolated operator/viewer profiles, a protected disposable shared database or explicitly approved test records, and captured local-state expectations. Stop if those preconditions cannot be established.
- Pre-authenticate recording profiles without capturing passwords or tokens. Use only fictional notes and test provider objects. Do not reset the user's browser data, silently replace a shared database, or expose the raw API port.

**Required matrix**

1. **Shared operation:** two operators edit the same case; refresh exposes the first change, the stale second change is rejected, draft text survives, and an explicit refresh/review/version choice is required before retry.
2. **Save ambiguity:** duplicate clicks are blocked while saving. With a controlled lost-response simulation, unchanged retry within the mounted page resolves once; after reload/close, inspect history/version rather than assuming the old request ID survives. If the fault cannot be simulated, mark that browser scenario untested rather than inferring it from unit tests.
3. **Identity and failure UX:** viewer remains read-only; logout/controlled expired session clears trusted state; API outage and save failure do not announce success. Do not wait eight hours or modify active shared sessions just to force expiry; use a disposable test setup.
4. **Synthetic Investigation:** all six examples, per-source provenance, conflicting/stale/incomplete/unavailable/no-match distinctions, and a targeted simulated retry. No claim that retry tested real provider reliability.
5. **Original tools / saved work:** KYC waiting/resume, local assignment/notes/views, refund simulation guards/read-only examples, staging flags, and unchanged older saved data. Any reset is limited to an explicitly disposable browser profile.
6. **Browser behavior:** keyboard navigation, modal focus/escape/return focus, scroll/drawer layout at desktop and a narrow viewport, cookie/session behavior, and clear separation of local vs shared data. This is a bounded usability/accessibility check, not a compliance certification.
7. **Sandbox:** always cover not-connected. If B is completed, record the real test snapshot and distinguish actual provider results from controlled stale/error demonstrations. Otherwise leave real-provider checks untested.

**Acceptance / output:** one primary annotated recording plus a concise pass/fail/untested report with revision, environment, test starting state, and any reproducible defects. Blocking identity/data-loss/permission/concurrency defects must be fixed and rechecked before calling the tested slice passed; prioritize other findings explicitly. Keep unit/API/mock evidence separate from browser observations. Browser success is not a production, capacity, compliance, or license-savings gate.

### Measurements and scope boundaries

For each package, log setup time, human review/supervision time (unmeasured until captured), remediation time, module vs core edits, regressions, and operator handoff burden. For B record observed lookup latency and provider usage; these are not provider reliability or throughput estimates. Use actual approved infrastructure/provider quotes before pricing operating cost. The independent next-tool extension exercise and human review measurement remain outstanding; these three validation packages do not replace them.

**No action authorized by this document:** no secret requests/provisioning, live provider calls, browser testing, production data, external writes, additional tools, automatic DB resets, or PR merge. Choose which package to execute in a follow-up.
