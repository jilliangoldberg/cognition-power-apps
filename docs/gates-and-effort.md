# v0.3 gates, extension effort, and operating-cost evidence

## Authoritative scope

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

Measured source diff for this increment (excluding tests, tooling, and docs): module/custom-view/adapter code **+714 / −0 lines** across 5 files; shared frontend/backend code **+881 / −60 lines** across 15 files. These counts are observational, not target ratios. Lockfile changes are deliberately excluded.

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

## Remaining decision / validation log

1. Configure unique preview demo passwords securely if Shared KYC should be exercised interactively. There are no default passwords and no production identities.
2. Confirm Stripe or select the client's actual relevant sandbox. Supply a restricted test read credential and known test PaymentIntent before marking 5a live connectivity validated. Skip credentials, supply session-only, or save for future Devin sessions; never paste a key into chat.
3. Approve real-browser UI testing separately if desired. Do not interpret jsdom/HTTP coverage as a recorded two-user browser test.
4. Independent engineer/reviewer validates extension and operating effort before expanding the shared architecture or claiming licensing replacement.
