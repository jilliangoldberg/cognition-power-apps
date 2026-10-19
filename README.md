# Workbench · reusable internal-tools prototype

A small React + TypeScript workspace for **engineers working with Devin**, not a no-code builder or complete Power Apps replacement. The original three browser-local tools remain intact. v0.3 adds a materially different synthetic investigation page, a separate authenticated shared KYC slice, and an optional protected read-only Stripe test adapter. No real customer data or external writes.

## Run the local demo

Requires **Node 24 LTS** (`.nvmrc`), including its built-in `node:sqlite`. No separate database service is needed. Its API is still evolving; keep the pinned major and rerun the server suite on upgrades.

```sh
nvm use
npm install
npm run dev
```

Open the Vite address. The dev server listens on all interfaces for the private Devin preview; on an untrusted network use `npm run dev -- --host 127.0.0.1`. Original KYC, Refunds, Flags, and synthetic Investigation work without the API. `npm run preview` serves the built frontend **only**.

## Run shared KYC

1. Supply **unique**, 12–128 character `DEMO_ALEX_PASSWORD`, `DEMO_JAMIE_PASSWORD`, and `DEMO_VIEWER_PASSWORD` environment variables using a secret manager, secure prompt, or Devin secrets—not committed files, command arguments, or shell history. Identities are `alex@example.test` and `jamie@example.test` (operators), and `viewer@example.test` (read-only). There are **no built-in passwords**. Browser-local owner labels are not authenticated users.
2. Run `npm run server:setup` once. It creates a fresh independent synthetic KYC dataset in `.workbench/workbench.sqlite` and salted password hashes. It never imports browser work or invents historical authenticated activity. Rerunning setup leaves existing credentials and shared work unchanged; it is **not** a password-rotation command. Unset password variables after setup.
3. Run `npm run server` in a second terminal alongside Vite on **5173**. Vite proxies `/api` to the loopback-only server on **3001**. Default allowed origin is `http://localhost:5173`; set `APP_ORIGIN` to the **exact HTTPS preview origin** for a Devin preview (not the repository URL). Restart the API when that origin changes. Both browser profiles must use the same frontend origin.
4. Open **Shared KYC**, sign in, change a case, then refresh in a separately authenticated browser profile. Regular/private profiles can hold different identities. No realtime push is implemented. Stale edits are rejected; **Refresh latest case (keep input)** works inside the drawer, then review the updated details, explicitly **Use refreshed version**, and confirm again. Nothing automatically rebases a decision onto a new version.
5. If only the save response was lost, retry **unchanged** input before closing/reloading: the mounted page retains the same request ID to resolve the original save once. After reload or an ambiguous close, inspect version/history before submitting a new command.

`WORKBENCH_DB` selects an explicit database path. A fresh path creates independent fixtures; switching paths does **not** migrate data. Keep this single-instance demo's database on persistent local disk. Browser reset cannot reset it. Initial SQLite schema is version 1, independent of browser schema v2. Unknown newer database schemas refuse startup rather than being reseeded.

For a built single-origin demo, `npm run build`, then `npm run server` behind an approved HTTPS reverse proxy to loopback 3001. Set `APP_ORIGIN` to that HTTPS origin; cookies become `Secure`. `NODE_ENV=production` refuses startup without an explicit HTTPS origin. Do not expose the raw API port or use Vite as a production web server. This is a deployment recipe, **not a production-readiness claim**.

## Optional sandbox lookup · step 5a

The illustrative question is: **what status and amount does one sandbox PaymentIntent currently report?** Stripe is a demo adapter choice, not a client-provider assumption.

Set server-only `STRIPE_TEST_KEY` (prefer an `rk_test_` restricted key granting PaymentIntent read access; `sk_test_` is also accepted), restart the API, then retrieve a known test `pi_…` ID from **Shared KYC**. Never prefix the key with `VITE_`. No key gives **not-connected**, never synthetic fallback. Live/publishable keys are rejected at startup; live-mode responses are rejected at runtime.

The adapter uses only `GET https://api.stripe.com/v1/payment_intents/:id`, pinned to `2025-06-30.basil`, with a five-second timeout, no redirects, and **no automatic retries**. It returns an allowlisted snapshot with original status, normalized display label, source, and retrieval/attempt timestamps. Amounts remain integer **currency minor units**; not all currencies have two decimals. Keys, customer details, metadata, and `client_secret` never leave the server.

It distinguishes not-found, rejected credentials/permissions, rate limits, temporary failures, invalid/incomplete responses, and unmapped statuses. Manual refresh retains previous good data as **stale** after failure, not as current evidence. This single-object scope deliberately does **not** paginate/list events or claim full payment history, settlement, or reconciliation. Missing required snapshot fields are unavailable, not partial success. Results are never merged with the synthetic investigation timeline.

**Live connectivity remains unverified**: no sandbox credential was configured in this implementation session. Provider transport tests are mocked, not evidence that a real account works. No external write endpoint exists.

References reviewed: [retrieve a PaymentIntent](https://docs.stripe.com/api/payment_intents/retrieve), [test/restricted keys](https://docs.stripe.com/keys), [API versioning](https://docs.stripe.com/api/versioning), [Node SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html), [Express security](https://expressjs.com/en/advanced/best-practice-security.html).

## Try the workflows

- **Local KYC:** filter status/owner, **My records**, **Unassigned**, or **Open 48h+** (not an SLA). Opening age and last update are separate. Reassign or add a fictional note with 5–500 characters of context.
- **KYC waiting:** Request information → Waiting for information → Return to review preserves context without sending a customer message. Waiting/escalated cases must return to review before approval/rejection. This is an illustrative rule, not verified client policy or separation of duties.
- **Local views:** Save named filter/sort definitions (up to 8 per tool), not record snapshots. They persist after reset. Shared KYC preferences have separate per-account/browser keys; they are not cross-device or a security boundary.
- **Refunds:** simulate or decline a requested refund, constrained by remaining balance. Maya Robinson's shared-payment requests deliberately block simulation until cross-request allocation/reconciliation is modeled. Approval, processing, and failure examples are read-only provider-like illustrations. USD is a local-demo limitation; no currency/FX model is implemented.
- **Flags:** change local staging settings; no running product consumes them.
- **Activity/Overview:** summarize **only original browser-local data**. Reset explicitly clears local records, notes, and activity, not views, unrelated storage, or the shared database.
- **Investigation:** search `TX-DEMO-001` through `TX-DEMO-006`: clean, conflicting, unavailable, stale, no-match, and incomplete sources. Expand timeline provenance; event time is separate from retrieval time. Targeted retries are simulated reads of one source, not connector reliability tests. Unavailable is not “no matching activity”; conflicts are not collapsed to an authoritative status.
- **Shared KYC:** view attributable notes/history in each drawer. Operators can change shared cases; viewers cannot, including through direct API requests.

## Synthetic data / saved-work compatibility

The curated sample is **14 KYC cases, 10 refund requests ($18–$1,250), and 7 staging flags**: screen examples, not industry benchmarks, client volume, currency, jurisdictions, policy, or a particular fintech model. Names and `example.com`/`example.test` emails are fictional. Risk labels do not define a demographic/regulatory model. Customer IDs deliberately link some local examples; there are no name-based joins. Initial record context is not fabricated operator history.

Browser data remains **schema v2**, original key `workbench.demo.v1`. Valid v1 work migrates event structure without replacing records, IDs, owners, fields, versions, decisions, or activity. Missing opening dates stay **Not recorded**, not inferred from update time. Rich fixtures require a new browser or explicit destructive reset. Malformed/unknown storage is preserved while temporary fixtures are used. Storage/quota failures warn that changes last for the current visit only. Saved view definitions use separate validated `workbench.views.v1.*` keys and are not overwritten if unreadable unless explicitly cleared.

Investigation is a stateless custom page, **not a fourth persisted queue array**: no browser schema change or destructive migration is needed. The existing v1→v2 tests and new saved-work regression verify compatibility. Shared KYC seeds independently and never promotes browser labels/activity to authenticated history.

## Extension contracts

| Reused core                                                                 | Domain / custom-view code                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/App.tsx`: shell, navigation, original demo state                       | `src/modules/{kyc,refunds,flags}.ts`: fields, metrics, states, actions   |
| `ToolView`: queue search/filter/sort/views                                  | `src/features/pages.tsx`: tiny custom-page registry                      |
| `RecordDrawer`: details, notes, assignment, async saves/conflicts           | `Investigation` + `evidence`: read-only non-queue UI and source fixtures |
| `executeAction`: domain version/reason/transition checks, not authorization | `SharedKyc`: authenticated client, server-owned records                  |
| `server/app.ts`: strict API schemas, session policy, read-only proxy        | `server/store.ts`: cases, atomic history, per-actor command results      |

For an ordinary queue, add `ToolId`, `ToolModule`, registry entry, fixtures, tests, and an **additive persisted-state migration**. Metadata defines owners, allowed actions, details, and optional open-work/related-record guards. Assignment/notes increment version and update time, not opening time or domain status.

For a custom page, add its `Page` ID and `{id,title,icon,View}` entry in `src/features/pages.tsx`. Its React code need not fake table columns/actions/statuses or enter the local queue schema. Both registries are **build-time TypeScript**, not a runtime plugin loader. App routing still has a typed-ID edit; this is an explicit small seam, not zero-core-change extensibility. Reviewed code is allowed; no visual/formula/workflow engine is being built.

Shared KYC reuses pure KYC rules on the server only **after** authenticating/authorizing, validating strict command input, and checking active assignment targets. The caller cannot supply actors, timestamps, transitions, resulting fields, or another module. Client guards never replace API policy. A future custom operational module must use that server boundary deliberately; custom pages do not automatically inherit authorization merely by joining navigation.

## Security / operating boundary

- **One synthetic workspace:** active operators can read all cases, assign to active operators or Unassigned, add notes, and run KYC transitions. Viewers can read the same cases/history and sandbox snapshots but cannot mutate KYC. No tenant hierarchy, field masking, client-specific rules, SSO/MFA, approvals, or separation of duties.
- **Sessions:** scrypt-salted hashes; opaque 256-bit session tokens stored hashed; eight-hour expiry; server-side logout/revocation checks; HttpOnly/SameSite=Strict cookies, Secure with HTTPS. Mutations require same-origin/custom-header JSON requests. Strict body/field limits, parameterized SQL, private/no-store API responses.
- **Abuse limits:** in-process IP budget of 30 login or sandbox attempts per 15 minutes per category, deliberately coarse. A reverse proxy shares its IP. Not distributed abuse control; do not enable `trust proxy` or broad CORS without reviewing that boundary.
- **Transactions:** optimistic versions; record update + attributable event + command result commit together. Same actor/request ID/payload replays; reused ID with changed input conflicts. This is local database deduplication, **not** provider exactly-once execution.
- **Persistence:** SQLite WAL/full synchronization, one instance/local persistent disk. Case fields are JSON alongside relational account/session, case/version, history, and command tables; no dynamic entity engine. Whole small authorized case/history set is returned; search/counts share that scope. No production query pagination, document storage, bulk changes, queued jobs, high availability, or multi-region claim. Synchronous DB/scrypt work must be reassessed under load.
- **Audit limits:** API has no history-edit route, but database administrators can change SQLite. History is attributable, not tamper-resistant/compliance-grade. Local Activity is editable browser data and never trusted server audit.
- **No external effects:** KYC is not identity verification; refunds are local simulations; flags do not control a product. Only the configured sandbox GET can contact a provider.

### Backup and retention

`npm run db:backup -- /existing/private/directory/new-backup.sqlite` uses SQLite's online backup, including committed WAL state, with private file permissions; existing destination files are refused. Backups include hashes and sessions: protect them like the source. CI includes a backup/restore smoke test.

To restore, stop the API and point `WORKBENCH_DB` at a private copy of a backup, **not an active database file**. Revoke restored sessions through an authorized database operator (`DELETE FROM sessions`) before exposure, restart, then check schema/history. Automatic backup scheduling, remote encryption, point-in-time recovery, retention expiry, password recovery/rotation, and disaster-recovery operations are not implemented. An operational pilot needs an owner, recovery objectives, retention policy, and restore drills.

## Gates / next decisions

[Gate evidence, effort ledger and operating cost](docs/gates-and-effort.md) is the authoritative implementation status for v0.3; older design attachments are broader hypotheses, not completed production requirements.

| Gate     | Here                                                                                                               | Remaining                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 1–2      | Original tools, richer samples, daily-work interactions                                                            | Client workflow validation                                                                                          |
| 3        | Custom investigation/source failures/retry UI; saved-work compatibility                                            | Independent extension exercise and human review effort                                                              |
| Narrow 4 | Password demo accounts, shared KYC, API policy, transactional history, concurrency/replay tests, backup smoke test | Enterprise identity, tenant/field scope, production operations, migration of other tools                            |
| 5a       | Protected read-only Stripe test adapter, failure contracts, explicit not-connected                                 | Confirm provider, provision credential, validate live sandbox                                                       |
| 5b       | **Deferred; not required for these read-only/collaboration proofs**                                                | Separate write use case, provider idempotency review, durable intent/outcome-unknown/reconciliation/recovery design |

A fourth screen or sandbox call proves neither Power Apps replacement nor $250K/year savings. Use measured extension/review effort and total operating cost before comparing licensing alternatives.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit
npm run measure
```

`npm test` runs frontend domain/storage/component regressions in jsdom **and** Node tests against real loopback HTTP/SQLite. They cover independent sessions, forged requests, role denial, stale edits, replay, rollback, restart persistence, and backup/restore. Stripe transport is mocked; no live provider behavior is claimed. `npm run measure` reports reproducible local RSS, database/WAL size, latency and CPU for a disposable synthetic dataset—not a capacity test or hosting quote.

Component tests mock the native dialog API: they do **not** prove real-browser focus trapping, mobile layout, Chrome cookie behavior, or full UI end-to-end operation. UI-driven testing requires separate approval.
