# Workbench · basic internal-tools prototype

A deliberately small React + TypeScript product sketch for a reusable internal-tools workspace built with Devin. Three synthetic tools reuse a shell, searchable/filterable/sortable table, detail drawer, local assignment and notes, reason-required changes, saved views, and local activity history.

## Run

Requires Node 22.12+ (Node 24 LTS recommended; `.nvmrc` is provided).

```sh
nvm use
npm install
npm run dev
```

Open the Vite address printed in your terminal. The dev server listens on all interfaces for the private Devin preview; use `npm run dev -- --host 127.0.0.1` on an untrusted network. No external account, API key, database, or connector is required. For a production bundle, `npm run build`, then `npm run preview`.

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Try it

1. Open **KYC review**, filter by owner/status, or try **My records**, **Unassigned**, and **Open 48h+** (a demo age filter, not an SLA). Opening age and last update are separate; new activity does not reset the opening date.
2. Open a case, **Reassign owner**, or **Add note**. All three tools share these controls. Owners including “You” are local labels, not authenticated users. Changes require 5–500 characters of context and use the same version check and activity path as workflow actions.
3. **Request information** moves a reviewable KYC case to **Waiting for information** without sending a message. **Return to review** records receipt/handoff context without deleting the earlier request or notes. Waiting and escalated cases must explicitly return to review before approval/rejection in this demo; this is not a verified client policy or enforced separation of duties.
4. **Save view locally** names the current search, owner, status, age filter, and sort. Select it later (including after reload) or delete it. Up to 8 views per tool, with unique names; views store filter definitions, not record snapshots. Saved views are not shared and are kept when demo records reset.
5. Open **Refunds** and simulate or decline a requested refund. Amounts use integer USD cents; simulation rejects requests above the remaining balance. Maya Robinson's two requests share a payment: simulation is deliberately blocked because cross-request allocation and reconciliation are not modeled. Approval, processing, and failure examples are read-only illustrations, not live provider outcomes; they still support notes and assignment. No multi-currency logic is implemented.
6. Open **Feature flags** and enable/disable a local staging flag. No running product consumes these settings.
7. Review **Activity**, reload to see local persistence, or **Reset demo data** to load the latest sample. Reset requires confirmation and clears record changes, assignments, notes, and activity; it keeps saved views and unrelated browser storage.

All names, emails (`example.com`), and records are fictional. Existing client workflows have not been verified; these are interaction examples, not a reproduction of their actual screens or rules.

## Curated sample and saved-work compatibility

The current sample contains **14 KYC cases, 10 refund requests, and 7 staging flags**. These are screen examples, not industry benchmarks or estimates of client volume. KYC includes onboarding, information refreshes, incomplete/expired/unreadable evidence, resubmissions, waiting and escalation. Countries and review-risk labels do not imply jurisdictional rules or demographic risk models. Refunds span $18–$1,250, full/partial requests, prior refunds, a remaining-balance request, and illustrative exceptions. USD is a prototype display limitation, not a client currency assumption. Deliberately related KYC/refund records use stable fictional customer IDs; there are no name-based joins. Initial context is described in the records, not fabricated as historical operator activity.

Demo data uses **schema version 2** under the original `workbench.demo.v1` storage key so older saved work is found. Loading valid v1 data upgrades its event structure without replacing records, fields, owners, versions, decisions, or activity. Missing opened dates remain **Not recorded**, not invented from last-update times. Richer fixture rows are only loaded on a new browser or explicit reset. Malformed/unsupported data remains untouched while temporary fixtures are used; reset is the explicit destructive opt-in. Saved view definitions use separate per-tool `workbench.views.v1.*` keys, are validated, and are not overwritten when unreadable unless explicitly cleared. Storage access/quota failures show warnings; unsaved changes last only for the current visit.

## Small reuse boundary

| Shared code                                                                   | Module-owned code                                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/App.tsx`: shell, routing, demo state                                     | `src/modules/kyc.ts`: review states/actions                           |
| `src/components/ToolView.tsx`: table, owner/status filters, saved views       | `src/modules/refunds.ts`: amount/shared-payment checks and simulation |
| `src/components/RecordDrawer.tsx`: details and confirmation                   | `src/modules/flags.ts`: local flag transitions                        |
| `src/core/actions.ts`: version/reason checks, assignment, notes, local events | Module metadata: columns, fields, metrics, notices, owner choices     |
| `src/core/storage.ts`: versioned local persistence                            | Synthetic fixture fields and contract tests                           |

To add a simple tool, add its ID to `ToolId`, declare a `ToolModule`, register it in `src/modules/index.ts`, and add fixtures and tests. The generic navigation, table, drawer, assignment, notes, and action path then pick it up. Declare allowed demo `owners`, optionally an `isOpen` predicate for age-filtered work and a `noActionMessage` for read-only/terminal states. Optional action `validate(record, moduleRecords)` guards related-record constraints before `apply` runs. Shared assignment/note events increment the record version and last update but never alter its domain status, opening date, or fields. Notes live as typed local events rather than a second persisted copy. Update the demo-state fixture/type contract deliberately when adding persisted data. The overview's cross-tool summary is intentionally bespoke.

This is a build-time TypeScript contract, not a runtime plugin loader or no-code builder. Ordinary views use configuration. A genuinely different view may use reviewed custom React code; do not stretch a table schema into a universal UI engine. The early contract should evolve from real workflows.

## Boundaries and tradeoffs

- **Browser-only on purpose:** local storage rather than an API/database makes the first UI quick to reshape. It is not a shared source of truth; devices and tabs are not synchronized, and clearing site data loses changes. No real customer data should be entered.
- **No security claims:** no login, authorization, approvals, separation of duties, secure audit storage, durable execution, or integrations. The demo operator and owners are display labels, not authenticated identities or enforced roles. Anyone with browser access can edit the data. Action guards are interaction checks, not a security boundary.
- **Honest failure behavior:** malformed/unknown stored schemas are not silently overwritten. The UI uses temporary fixtures and offers an explicit reset. Storage failures show a warning. Reset is local and irreversible.
- **Distinct domains:** a KYC decision is not identity verification; a simulated refund is not a provider refund; a saved flag is not observed runtime behavior. No external effects occur.
- **Basic table only:** filtering and sorting run over small local fixtures. No backend queries, pagination, document storage, exports, bulk actions, multi-source connectors, or queued jobs.
- **No framework up front:** one app, one registry, three small modules. No visual builder, generic workflow engine, runtime custom code, or connector marketplace.

## Next increments (not implemented)

| Increment                                         | Complexity   | Why later                                             |
| ------------------------------------------------- | ------------ | ----------------------------------------------------- |
| Validate KYC screens and states with the user     | Small        | Actual client workflow is unknown                     |
| API + relational persistence + identity           | Medium–large | Required before a shared operational pilot            |
| Server authorization + immutable event recording  | Large        | UI guards and local history are not security controls |
| One synthetic/sandbox connector                   | Medium–large | Provider semantics must be known first                |
| Durable financial actions/approval/reconciliation | Large        | Never infer money movement from this simulation       |
| A fourth, materially different module             | Medium       | Test reuse after the first workflow is credible       |

The v0.2 design remains the broader roadmap; its backend controls, compatibility requirements, and fourth-tool proof are **not complete** in this UI sketch.

## Checks

Vitest runs unit tests for domain transitions and storage plus React component tests in jsdom. Component tests mock the native dialog API, so they do **not** prove real-browser focus trapping, mobile layout, or full end-to-end operation. The CI workflow is configured to run lint, type checking, tests, and a production build. UI-driven testing can be added after approval.
