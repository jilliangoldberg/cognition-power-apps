# Read-only custom-page extension guide · provisional contract v1

This guide packages the **existing synthetic Investigation**, not another application. It is a
build-time, reviewed-code seam for an engineer using Devin. No runtime plugin loader, visual
builder, generic connector layer, or new backend is introduced. The independent-agent change
ledger and limits are in [extension-proof.md](extension-proof.md).

## Choose the right seam

| Need                                             | Existing seam                                                      | Review implications                                                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue, record details, versioned local decisions | `ToolModule` in `src/modules`                                      | Typed tool ID, registry, domain rules, fixtures, tests, and additive persisted-state migration. Do not add a queue solely to display a timeline.                      |
| Read-only synthetic custom rendering             | `ReadOnlyPageExtension` v1 in `src/features/extension-contract.ts` | Custom React view, deterministic fixture scenarios, explicit synthetic-read actions, proposed/assigned owner and support metadata. No persisted records.              |
| Shared/authenticated operational behavior        | Existing Shared KYC API/policy, separately reviewed                | The synthetic contract does **not** inherit authentication, record/field permissions, history, or concurrency. Server integration requires its own design and checks. |

Shared KYC keeps its existing entry in `customPages`; it is deliberately **not** advertised as a
read-only/stateless extension. No common interface can turn a client declaration into permission.

## Small starter and worked example

- `src/features/extension-starter.ts` supplies the six invariant synthetic/read-only/version fields.
- `src/features/pages.tsx` supplies Investigation's actual custom view, fixture scenarios,
  owner/support/runbook, and the two declared reads (`investigate`, `retry-source`). It registers
  that descriptor in the existing `customPages` array. `src/App.tsx` consumes the same
  `{id,title,icon,View}` surface as before; no shell copy or App edit was needed for this increment.
- `src/features/evidence.ts` owns domain data and pure fixture/retry functions. It has no API client,
  persistence, owner identity, or provider adapter. `Investigation.tsx` owns rendering and local
  component state; unmounting discards the read snapshots.

For a future approved page, copy this registration shape, not the shell or the Investigation UI:

```tsx
const extension = defineReadOnlyPage({
  ...readOnlyPageStarter,
  id: 'your-page', // Keep this literal for the shell's typed route.
  title: 'Your page',
  icon: 'search',
  View: YourCustomView,
  owner: {
    team: 'Proposed team; confirm before operational use',
    status: 'proposed',
    support: 'Repository review; no staffed on-call',
    runbook: 'docs/your-page.md',
  },
  actions: [{ id: 'inspect', label: 'Inspect fixture', effect: 'synthetic-read' }],
  fixtureScenarios: ['found', 'unavailable'],
});
```

Import `defineReadOnlyPage` from `./extension-contract`, the starter from `./extension-starter`, and
your view from its owned file. Add the descriptor to `customPages` only after review. A **new page
ID still needs an explicit `Page` union edit in `src/core/types.ts`**; review the shell's current
hard-coded mode labels in `src/App.tsx` too. This exercise reuses the already registered
`investigation` ID and does neither edit. A future persisted queue still needs its migration;
the starter is not a way around it. Do not add more sample tools to prove this seam.

`defineReadOnlyPage` rejects unsupported versions, invalid slugs/titles, missing ownership/support
metadata, duplicate or non-read action declarations, and missing/duplicate scenario names. Tests
also check registered IDs against built-in routes and queue modules. Metadata is trusted source
code, **not untrusted plugin input**. The checks cannot stop imported React code from calling an API
or writing storage. Code review and behavior tests must verify declarations match implementation.
`reviewStatus: provisional` means the contract itself still awaits independent human validation;
it is not an assertion that a security reviewer signed it off.

## Fixture and action contract demonstrated by Investigation

| Fixture                    | Meaning                                                | Retry behavior                                                                                |
| -------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `TX-DEMO-001`              | Three complete fictional reports                       | None needed                                                                                   |
| `TX-DEMO-002`              | Reconciliation disagrees with other statuses           | No retry offered to erase a disagreement; never infer an authoritative status                 |
| `TX-DEMO-003`              | Reconciliation unavailable; outcome unknown            | Simulated read of that source only; recovers an existing-time fictional event                 |
| `TX-DEMO-004`              | Reconciliation retrieved 90 minutes before the attempt | Refresh retrieval metadata; preserve source-reported event time and status                    |
| `TX-DEMO-005` / unknown ID | All sources return no match                            | No money, parties, events, or retry-created success                                           |
| `TX-DEMO-006`              | Processing response is incomplete                      | Simulated recovery adds the omitted fictional processing detail; other sources stay unchanged |

Event references and related record/account/counterparty context stay attributed to each source.
These identifiers are not a join into browser-local decisions or shared KYC. Only the internal
source reports the illustrative USD amount. Complete means a complete **fictional lookup response**,
not complete history. The timeline sorts reported event times, not causality, and filtering it
never hides source availability cards. Edited input is distinguished from the last searched ID.

The retry helper is synchronous fixture manipulation, has no real reliability/backoff claim, and
will not turn a clean, conflicting, or no-match snapshot into a new outcome. Only unavailable,
stale, or incomplete known fixture sources are eligible. Fixture event occurrence times are
distinct from retrieval/attempt time; retry does not insert provider or operator history.

## Shared upgrade and regression review

The justified shared upgrade here is `dateTime` in `src/core/format.ts`: explicit **UTC + year**
prevents timezone ambiguity in evidence and in all three original tools' shared drawer timestamps.
Missing/invalid timestamps display `Not recorded`, never `Invalid Date`. Existing string calls
remain valid; accepting `undefined` is additive. USD formatting and queue short-date formatting
are unchanged. This intentionally changes displayed absolute timestamps, including Shared KYC and
sandbox views that already use the helper; it does not migrate source data or affect policies.

Review a shared change separately from domain code. Run:

```sh
nvm use # Node 24, as required by the repo
npm install
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

`format.test.ts` checks UTC/offset/year/missing/invalid behavior; `extension-compatibility.test.tsx`
renders KYC/refunds/flags through the existing drawer, then Investigation through its custom
view, and checks saved v2 data remains unchanged. The full existing migration/domain/shared-API
suites must stay green. These are unit/jsdom/HTTP checks, **not** real-browser layout, keyboard,
session-cookie, or end-to-end usability validation. Request approval separately for browser tests.

## Review, release, upgrade, support checklist

1. Name the operator question, scope, read-only actions, fixture scenarios, and missing-source
   interpretation. Have a reviewer explain a disagreement without choosing an authoritative answer.
2. Confirm a real owner and support route; current Investigation metadata is proposed and provides
   no staffed on-call/SLA. Human review, policy validation, and support handoff remain unmeasured.
3. Compare the branch to its fixed baseline. Separate owned domain files, registry/contract/core
   edits, tests, and docs. Capture added/deleted lines, failures/remediation, and actual human review
   time; never use an agent duration or test count as a productivity multiplier.
4. Keep source version `1` pinned. A breaking contract change requires a new version, explicit
   registry-consumer review, compatibility tests and module-owner sign-off, not silent reinterpretation.
   This is a proposed review process, not a proven enterprise upgrade policy or runtime upgrader.
5. Release through the repository's reviewed integration workflow. Revert reviewed commits to roll
   back this stateless page/core display change; preserve stored local and shared work. No independent
   plugin deployment, feature flag, production rollout, or support automation is implemented here.
6. Investigate a source-display issue by reproducing the fixed-clock fixture tests and recording the
   source ID, lookup, event time, retrieval time, and completeness. Do not request real customer data
   or secrets to debug this synthetic page. Escalate operational/API requirements for separate review.

**Still not proven:** an independent human builder's delivery/review effort; production secure
reuse of custom pages; full shared identity/policy adoption across modules; real provider reliability;
capacity, cost savings, compliance, and cross-team release/support behavior at enterprise scale.
