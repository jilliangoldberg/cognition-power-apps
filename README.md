# Workbench · basic internal-tools prototype

A deliberately small React + TypeScript product sketch for a reusable internal-tools workspace built with Devin. Three synthetic tools reuse a shell, searchable/filterable/sortable table, detail drawer, reason-required action flow, and local activity history.

## Run

Requires Node 22.12+ (Node 24 LTS recommended; `.nvmrc` is provided).

```sh
nvm use
npm install
npm run dev
```

Open the Vite address printed in your terminal. The dev server listens on all interfaces for the private Devin preview; use `npm run dev -- --host 127.0.0.1` on an untrusted network. No external account, API key, database, or connector is required. For a production bundle, `npm run build`, then `npm run preview`.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Try it

1. Open **KYC review**, search or filter the queue, and open a customer. Approve, reject, or escalate a case after providing a reason.
2. Open **Refunds** and simulate or decline a request. Amounts use integer USD cents; simulation rejects a request above the remaining refundable amount. Each fixture has a distinct payment; cross-request allocation and multi-currency logic are not implemented.
3. Open **Feature flags** and enable/disable a local staging flag. No running product consumes these settings.
4. Review **Activity**, reload to see local persistence, or **Reset demo data** to restore the starting records. Reset requires confirmation and leaves unrelated browser storage untouched.

All names, emails (`example.com`), and records are fictional. Existing client workflows have not been verified; these are interaction examples, not a reproduction of their actual screens or rules.

## Small reuse boundary

| Shared code                                                 | Module-owned code                                  |
| ----------------------------------------------------------- | -------------------------------------------------- |
| `src/App.tsx`: shell, routing, demo state                   | `src/modules/kyc.ts`: review states/actions        |
| `src/components/ToolView.tsx`: table, search/filter/sort    | `src/modules/refunds.ts`: amount checks/simulation |
| `src/components/RecordDrawer.tsx`: details and confirmation | `src/modules/flags.ts`: local flag transitions     |
| `src/core/actions.ts`: version/reason checks + local event  | Module metadata: columns, fields, metrics, notices |
| `src/core/storage.ts`: versioned local persistence          | Synthetic fixture fields and contract tests        |

To add a simple tool, add its ID to `ToolId`, declare a `ToolModule`, register it in `src/modules/index.ts`, and add fixtures and tests. The generic navigation, table, drawer, and action path then pick it up. Update the demo-state fixture/type contract deliberately when adding persisted data. The overview's cross-tool summary is intentionally bespoke.

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
