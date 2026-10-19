# Prototype contract · promise and proof

**Pitch:** One workspace for employees to complete important internal work, with a reviewed foundation engineers can reuse with Devin to deliver, release, and support the next tools.

Roadmap **step 1**, not old gate 1. Source-reviewed baseline: `5d3d7191a710fe209ce5aed59ece7ce07b365b69`; no new application tests run. See [current scope](../README.md) and [gate/effort ledger](gates-and-effort.md).

## Promise, not platform parity

- **Three existing workflows:** replacement required **after client parity discovery**: screens, exceptions, permissions, dependencies, outcomes. Today's KYC/refunds/flags are representative synthetic stories, not verified parity.
- **Internal-tool delivery:** central hypothesis: repeatable, reviewed delivery for ten-plus planned tools, independent module ownership, compatible upgrades, release, and support—not copied screens.
- **Entire Microsoft surface:** not a prototype target. Record replace/retain decisions for actual dependencies; a custom frontend need not eliminate licensing.

The prospective Series C fintech reports 60+ engineers and $250K/year platform spend. Business model, operator/user counts, concurrency, policies, providers, dependencies, and cancellable costs remain unverified; this is not a savings claim.

## Five needs, one demonstration

These are acceptance targets, **not five portals, client roles, or claims of completed proof**.

| User                         | One useful task                                               | Observable proof                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Operator                     | Resolve the next reviewable KYC item                          | Find why it needs attention, inspect fictional evidence, act with context, and return to the same queue.                                  |
| Reviewer/team lead           | Allocate a waiting/unassigned case                            | Scoped counts drill into the same set; assignment and waiting/resumption history explain the handoff. No independent approval is implied. |
| Tool-building engineer       | Extend the investigation tool through the starter             | Review a module/core diff, reused contracts/tests, compatibility result, and separately recorded human authoring/review effort.           |
| Platform/on-call owner       | Diagnose and recover a failed change                          | Follow a request/version to its owner/runbook; demonstrate safe write disablement and restore, with limitations recorded.                 |
| Security/compliance reviewer | Reject unauthorized access and reconstruct an accepted change | Direct API denials and actor/reason/request/version history, explicitly separated from editable local Activity.                           |

**Small story:** find and assign a synthetic KYC case, record missing information, resume, decide with reasons, inspect history. Contrast a refund and staging flag, then investigate conflicting/missing evidence. Do not invent links between independent datasets.

- **Happy path:** retain queue filters/sort/position; stable record references reopen the intended record without granting access. KYC waiting returns to review before decision. Show refund capacity and decision versus simulated execution; flag owner/environment, proposed diff, publication state, and prior-configuration restoration. Missing capabilities remain pending.
- **Exceptions:** explain ineligibility before reason entry; retain drafts on recoverable failures. Block an over-capacity/shared-payment refund without implying provider failure. Distinguish configured, published, and observed flag state. In `TX-DEMO-002`/`003`/`004`/`005`/`006`, preserve disagreement, unavailable, stale, no-match, and incomplete meanings; retry only the selected synthetic source. Unavailable never means no activity or success.
- **Separate Shared KYC check:** provision demo accounts explicitly; test two authenticated profiles, direct viewer denial, stale-version rejection with retained input/explicit refreshed-version review, same-request retry, and restart persistence. This does not cover the original tools.

## Claim / evidence / gap scorecard

Links identify baseline behavior/test definitions, **not newly observed passes**. Roadmap rows identify evidence to collect, not implementation prescriptions; this contract itself is new.

| Claim / roadmap step                   | Evidence at the fixed baseline                                                                                                                                                                                     | Remaining proof to collect                                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 · Explain the promise honestly**   | This bounded contract and existing scope/effort ledger                                                                                                                                                             | Builder and salesperson explain the pitch and label every proof's mode/gap; client validates required workflows.                                                                                                             |
| **2 · Useful daily workspace**         | [Overview](../src/components/Overview.tsx), local queues/views; [App](../src/App.tsx) has page-only hashes                                                                                                         | My work, secondary searchable/favoritable directory, scoped drill-through counts, stable record links, preserved return context. Capture expected/actual results.                                                            |
| **3 · Complete narrow stories**        | [KYC](../src/modules/kyc.ts) waiting/resume; [refund](../src/modules/refunds.ts) capacity guards; [flags](../src/modules/flags.ts) local toggles                                                                   | Context → action → outcome/history → exception for each; evidence/diff/restoration and draft/context gaps; no provider execution or flag-consumer claim.                                                                     |
| **4 · Repeatable extension**           | Existing custom [Investigation](../src/features/Investigation.tsx), [evidence fixtures](../src/features/evidence.ts), [page registry](../src/features/pages.tsx), [regressions](../src/features/features.test.tsx) | Starter/ownership/support contract, independent extension diff, one cross-tool core upgrade, duplication/regressions and effort ledger. Another agent is not proof of real second-engineer usability or human review effort. |
| **Shared KYC subset exists**           | [API/SQLite tests](../server/app.test.ts), [client conflict tests](../src/features/SharedKyc.test.tsx), [backup test](../server/backup.test.ts)                                                                    | Approved browser/two-profile validation; enterprise SSO/MFA, broader record/field/environment policy, all-module sharing, protected retention and operating controls. Password demo sessions are not enterprise identity.    |
| **Provider boundary is narrow**        | Optional protected Stripe test GET; [transport tests](../server/sandbox.test.ts) are mocked                                                                                                                        | Live connectivity unverified: no credential/account assumption. No-key means not-connected, never synthetic fallback; failed refresh keeps prior data stale. No external writes, durable execution, or reconciliation proof. |
| **Release/support/load is not proven** | [CI checks](../.github/workflows/checks.yml), backup smoke test, [sequential diagnostic](../server/measure.ts)                                                                                                     | Steps 5–7: approved shared controls, integration recovery, release/upgrade/restore drill, named owners, measured load and human effort. Existing diagnostic is not a concurrent-capacity result.                             |

**Synthetic boundary:** original tools persist in that browser; owner labels/Activity are not authenticated identity/compliant audit. Investigation is stateless fiction, not a connector. Shared KYC uses independent SQLite data, local password sessions and operator/viewer enforcement; no browser-history import. Database administrators can alter history. Local KYC verifies no identity; information requests send no message; refunds move no money; flags affect no product. Enterprise/pilot controls require separate approval.

## Declared PROPOSED synthetic envelope · later step 7

**Proposal, not achieved load, client SLA, or approved client requirement.** Confirm before execution; report deviations.

- **Data:** one company/workspace; 1,000 fictional records per original tool (3,000 total), up to five history events each; six fixed investigation scenarios with three sources. Benchmark Shared KYC separately with 1,000 independently seeded cases and up to 5,000 events. Do not import local history or sum independent datasets as shared coverage.
- **Sessions/workload:** one isolated API instance; ten authenticated synthetic sessions (eight operators, two viewers), one-minute warm-up then ten measured minutes; each session reads every five seconds, each operator attempts one authorized synthetic change every thirty seconds. Add one deliberate two-operator version race and one viewer-denial probe. No provider load or external writes. Browser-local interaction checks are separate; sessions are not independent human participants. Expand to all modules only after they actually share the approved core.
- **Measurements:** record revision, machine/runtime, seed/counts, actual active sessions, request mix/duration, response sizes, login and query/action p50/p95 latency, throughput, unexpected error rate, expected denials/conflicts, CPU/RSS and database growth. Verify complete filters/counts/pagination against the seed, no unauthorized accepted changes, and no lost accepted versions. Agree latency/error budgets before running; none are client promises here. Also collect keyboard/zoom/narrow-screen and release/recovery evidence, subject to approval.

**Distinct counts:** engineers are potential builders/owners; licensed users/entitlements require discovery; operators perform workflows; concurrent users are simultaneous active sessions. Infer none from another, tool count, or agent count.

## Stop rule and exclusions

Pause feature expansion once the narrow proofs are reproducible and seek a bounded pilot with an accountable owner, success criteria, and security/privacy approval. Until steps 5–7 pass, call this an **interaction/reuse prototype**, not a reliable company-wide replacement. Client-workflow validation and real human authoring/review remain unproven even when component tests pass.

Out of scope: visual builder/Power Fx, generic workflow language, connector marketplace, full Dataverse/governance parity, BI platform, native/offline mobile, compliance certification, production migration, real data/credentials, payment writes, production flags, and extra tools merely to inflate coverage. If discovery requires these, stop and decide replace/retain/rescope before promising parity or savings.
