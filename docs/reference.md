# Workbench reference · full behavior, setup and boundaries

A small React + TypeScript workspace for **engineers working with Devin**, not a no-code builder or complete Power Apps replacement. The original three browser-local tools remain intact. v0.3 adds a materially different synthetic investigation page. Everything runs in the browser: there is no server, sign-in, real customer data or external write.

**Cross-department expansion:** Vendor Onboarding & Spend Approvals adds a fifth business-tool example using the existing custom-page extension point. Requesting departments, Finance, Security, and Legal share a local simulated request/review flow. Investigation remains the fourth tool. See [the vendor walkthrough, reuse evidence, and expansion hypothesis](vendor-extension.md). This is not authenticated procurement or a claim of capability unique to Workbench versus Power Apps.

## Run the local demo

Requires **Node 24 LTS** (`.nvmrc`). No server or database is needed.

```sh
nvm use
npm install
npm run dev
```

Open the Vite address. The dev server listens on all interfaces for the private Devin preview; on an untrusted network use `npm run dev -- --host 127.0.0.1`. `npm run preview` serves the built frontend.

## Try the workflows

- **My work:** start with assigned decision-ready local items, unassigned backlog, or waiting/guarded decisions. Each count opens the exact local list; views overlap and must not be summed. Flags are configurations, not pending tasks. Investigation and Vendor approvals never enter these local counts. The searchable tool directory is secondary.
- **Local KYC:** inspect fictional evidence and recorded follow-up; filter status/owner, **My records**, **Unassigned**, or **Open 48h+** (not an SLA). Reassign with a reasoned handoff. An evidence gap can prevent approval without preventing information requests or rejection.
- **KYC waiting:** Request information → record fictional response → return to review → assess fictional evidence → reasoned decision. Missing/expired/inconsistent evidence needs recorded replacement context before assessment; the request remains unsent. These local illustrative rules are not client policy, identity verification, or independent review.
- **Local views:** Save named filter/sort definitions (up to 8 per tool), not record snapshots. They persist after reset. They are not cross-device or a security boundary.
- **Refunds:** requested → approve for simulation → simulate, with separate decision/execution reasons and current integer-cent capacity checks at both steps. Maya Robinson's shared-payment requests remain blocked until cross-request allocation/reconciliation is modeled. Other approval/processing/failure examples are read-only illustrations, not actual provider outcomes. No payment is submitted or reserved; USD is a demo limitation.
- **Flags:** inspect environment/owner, proposed diff, and local change history; restore the prior desired Boolean/audience as a new versioned change. Staging only; publication is unconnected and consumer state is unknown. No running product consumes these values.
- **Stable local references:** copy a queue record ID link. Hash URLs preserve filters/search/sort and return context through reload/back/forward; missing/invalid records fail safely. References require matching browser-local data. Cancel retains drafts only inside the open drawer; close prompts before discard. Reload/unmount/browser-history navigation still discards in-memory drafts.
- **Local Activity/My work:** summarize **only original browser-local data**. Reset clears local records, notes, and activity, not views, vendor storage, or unrelated storage.
- **Investigation:** search `TX-DEMO-001` through `TX-DEMO-006`: clean, conflicting, unavailable, stale, no-match, and incomplete sources. Expand timeline provenance; event time is separate from retrieval time. Targeted retries are simulated reads of one source, not connector reliability tests. Unavailable is not “no matching activity”; conflicts are not collapsed to an authoritative status.
- **Vendor approvals:** create a fictional request with annual spend, budget owner, department, and data access. Simulate reasoned Finance, Security, and Legal decisions. Finance/Legal always review; Security is required for internal/customer data under this illustrative policy. Missing prerequisites block approval, not requests for changes. Edit/resubmit resets every review and retains prior revision history. Ready for onboarding is a simulated handoff, not authorized spend or a provisioned vendor. Any user can simulate any department; no actual role authorization is implied. Vendor state/history use separate `workbench.vendor-demo.v1` browser storage and their own explicit reset. No documents, notifications, contracts, or external writes.

## Synthetic data / saved-work compatibility

The curated sample is **14 KYC cases, 10 refund requests ($18–$1,250), and 7 staging flags**: screen examples, not industry benchmarks, client volume, currency, jurisdictions, policy, or a particular fintech model. Names and `example.com`/`example.test` emails are fictional. Risk labels do not define a demographic/regulatory model. Customer IDs deliberately link some local examples; there are no name-based joins. Initial record context is not fabricated operator history.

Browser data remains **schema v2**, original key `workbench.demo.v1`. Valid v1 work migrates event structure without replacing records, IDs, owners, fields, versions, decisions, or activity. Missing opening dates stay **Not recorded**, not inferred from update time. Rich fixtures require a new browser or explicit destructive reset. Malformed/unknown storage is preserved while temporary fixtures are used. Storage/quota failures warn that changes last for the current visit only. Saved view definitions use separate validated `workbench.views.v1.*` keys and are not overwritten if unreadable unless explicitly cleared.

Investigation is a stateless custom page, **not a fourth persisted queue array**: no browser schema change or destructive migration is needed. The existing v1→v2 tests and new saved-work regression verify compatibility.

Optional flat workflow defaults preserve saved v1/v2 decisions, notes, owners, and history without inventing evidence or past outcomes. Unknown newer workflow versions remain blocked. Reset is needed only to opt into richer fixtures, not to retain saved work.

## Extension contracts

| Reused core                                                                 | Domain / custom-view code                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/App.tsx`: shell, navigation, original demo state                       | `src/modules/<id>/`: fields, metrics, states, actions, sample records    |
| `ToolView`: queue search/filter/sort/views                                  | `src/features/pages.tsx`: tiny custom-page registry                      |
| `RecordDrawer`: details, notes, assignment, async saves/conflicts           | `Investigation` + `evidence`: read-only non-queue UI and source fixtures |
| `executeAction`: domain version/reason/transition checks, not authorization | `VendorOnboarding` + `vendors`: local cross-department workflow          |

For an ordinary queue, run `npm run new-tool -- <id> "<Title>"` (see [new-tool.md](new-tool.md)), or add a `src/modules/<id>/` folder (`index.ts` definition + `samples.ts` synthetic records) and one line in `src/modules/index.ts`. `src/modules/modules.test.ts` checks every registered tool automatically: unique route-safe ID, valid deterministic samples, declared owners/statuses, and actions that stay inside declared statuses. Saved browser work gains the new tool's samples on next load instead of being discarded; removing or renaming a tool is still not migrated. Metadata defines owners, allowed actions, details, and optional open-work/related-record guards. Assignment/notes increment version and update time, not opening time or domain status.

For a custom page, add its `Page` ID and `{id,title,icon,View}` entry in `src/features/pages.tsx`. Its React code need not fake table columns/actions/statuses or enter the local queue schema. Both registries are build-time TypeScript, not a runtime plugin loader, and app routing still needs a typed-ID edit.

Custom-page entries also include `description`, `scope`, and `color` for generic Overview cards. Vendor request rules/storage remain feature-owned in `src/features/vendors.ts`, separate from local queue data. [Vendor extension evidence](vendor-extension.md) distinguishes unchanged shared components, integration edits, demo limits, and unmeasured commercial claims.

## Security / operating boundary

- **No sign-in or authorization.** Everyone is the demo operator and can see every tool. Owner labels are not authenticated users, and the header's **Sign in** button only explains that SSO with per-tool access is planned for the pilot. Client-side guards guide users; they do not enforce permissions.
- **Browser-local data.** Records, notes, history, saved views and vendor requests live in this browser's storage. They are editable, not shared across users or devices, and not compliance-grade audit.
- **No external effects:** KYC is not identity verification; refunds are local simulations; flags do not control a product; Investigation reads fixed fixtures. Nothing contacts a provider.

## Status and next steps

Implemented: the three browser-local tools, Investigation, Vendor approvals, and the new-tool scaffold. Before a pilot, the main open items are validating workflows with the client's operators, enterprise sign-in and per-tool access enforced on a server, shared storage for all tools, approved read-only provider integrations, and real-browser end-to-end testing. Provider writes (for example, issuing real refunds) are out of scope and would need their own design for idempotency and reconciliation.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

`npm test` runs frontend domain/storage/component regressions in jsdom, then the Node tests for the `new-tool` scaffold.

Component tests mock the native dialog API, so real-browser focus trapping, mobile layout, and full end-to-end flows are not covered by automated tests.
