# Vendor onboarding: demonstrate value, then expand

Investigation remains the fourth tool and the first non-queue extension. Vendor
Onboarding & Spend Approvals is a fifth business-tool example: reuse the same
foundation for requesting departments, Finance, Security, and Legal.

## Value story

1. **Land with useful financial operations.** KYC, refunds, and flags illustrate
   familiar internal work; Investigation introduces source-oriented diagnosis.
2. **Expand into another department's work.** A vendor request brings together a
   business need, annual spend, data access, departmental decisions, and a handoff.
3. **Demonstrate the mechanism, not just a sales assertion.** The new page uses
   the existing custom-page registry and shared UI, while its review policy and
   data stay inside the feature. No generic workflow engine or new dependency is
   necessary for this example.

Power Apps also supports procurement and cross-department applications. This demo
does **not** establish a unique capability beyond Power Apps, feature parity, a
no-code authoring experience, licensing savings, or production readiness. The
testable hypothesis is that an engineer-owned foundation plus Devin can deliver
valuable extensions with acceptable engineering, review, and operating cost.

## Demo walkthrough

Open **Vendor approvals** from the sidebar or the Overview tool directory (`#vendors`).

1. **Juniper Demo Analytics:** a Product request accessing synthetic customer
   data. Security approval is blocked until its synthetic assessment is reviewed.
   Enter a reason and request changes instead. Edit & resubmit, mark the assessment
   reviewed, then perform all three departmental reviews.
2. **Harbor Demo Recruiting:** People request with Finance changes requested,
   no budget owner, and an unreviewed synthetic contract. Resubmit with those
   prerequisites addressed. Earlier decisions remain visible in local history.
3. **Maple Demo Design:** public-information-only request with Finance and Legal
   already approved. Security is not required under this illustrative policy.
   "Ready for onboarding" is only a handoff marker, not provisioning or spending.
4. Create a new fictional request. Change any field on an approved request and
   resubmit: **all reviews reset**, even if only the annual spend changes.
5. Search by vendor, request ID, requester, or requesting department. Filter by
   status and confirm the no-match state. Reload to inspect browser-local work.

All amounts are illustrative annual USD estimates, not budgets, benchmark pricing,
or customer policies. Form validation accepts positive, whole-cent amounts up to
$1,000,000 as a demo input bound, not an approval threshold. Finance and Legal are
always required; Security is required for internal or customer data. These rules
are deliberately explicit examples, not configurable company policy.

## Reuse evidence and boundaries

| Reused unchanged                                    | Owned by the extension                                              | Shared integration changes                              |
| --------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| Workspace shell, hash navigation, mobile navigation | Request schema, fictional fixtures, review prerequisites            | Register one custom page; add its `Page` identifier     |
| `Badge`, `Dialog`, `Icon`                           | Required teams, derived readiness, immutable decisions per revision | Typed page summaries list it in the Overview directory  |
| `money`, `dateTime`                                 | Edit/resubmit resets, reasoned decisions, revision history          | Clarify reset scope and About's expansion narrative     |
| Metrics, panels, table, detail and timeline styling | Independent versioned browser storage and explicit vendor reset     | Feature-specific CSS; no global workflow-engine changes |

- No changes to `ToolModule`, queue record schemas, v1/v2 migrations, original
  action validation, or authentication.
- No additional npm dependencies. The feature reuses the existing Zod dependency
  to validate request details and saved state.
- Main implementation: `src/features/VendorOnboarding.tsx` and
  `src/features/vendors.ts`. Tests live beside them. The actual changed-file/line
  footprint can be inspected against this PR's base; it is not zero-core-edit
  or configuration-only extensibility.
- Source footprint against this PR's foundation base: **2 feature implementation
  files (+928 lines)** and **6 shared integration/style files (+177/−20 lines)**.
  Tests and documentation are excluded from these source totals. This is a
  changed-line inventory, not a measurement of independent extension effort.
- Original Activity remains scoped to the original three local tools. Vendor
  history lives on its page and is not imported into original Activity.
- Storage key `workbench.vendor-demo.v1` is independent of original local state. Unreadable saved bytes are preserved and sample editing is
  blocked until explicit vendor reset. Failed saves warn that changes remain
  in memory only. Original reset does not erase vendor work, and vice versa.
- Local data is browser-editable and not coordinated across tabs or users. All
  users may simulate every reviewer. Reviewer labels are **not identities**;
  checkboxes are **not evidence verification**; history is **not compliance audit**.
- No document upload, supplier due diligence, notifications, purchase orders,
  signed contracts, vendor provisioning, approved budget, or payment execution.
  Enter no real supplier, employee, customer, financial, or sensitive information.

## Validation and next commercial proof

Automated tests cover required teams, blockers, review reasons, readiness,
resubmission invalidation/history with per-revision reviewed-detail snapshots, malformed storage, persistence failures,
forms/filters, custom-page registration, independent resets, original saved-work
compatibility, Investigation navigation, and the absence of client fetches in the
vendor demo. Component tests use jsdom with a mocked native dialog API; they do
not prove browser focus trapping or responsive layout.

Real-browser testing needs separate approval. An independent engineer's extension
time, human review effort, actual workflow value, and total operating costs remain
unmeasured. A production pilot would separately require company identity, actual
department permissions and separation of duties, server-owned state/concurrency,
document access controls, retention, notifications, and validated procurement
policy. Do not reuse this local history as trusted approval history.

Local validation on hardened `main` passed: formatting, lint, strict typecheck,
**288 automated tests** (254 frontend/domain/component + 34 server), production
build, and whitespace check. The extension adds 36 tests to the 126-test hardened
foundation. Vendor IDs use the shared `randomId` helper, so they do not require
secure-context `crypto.randomUUID`. No browser or live-provider
test is implied by these automated results.

To support an expansion proposal, measure a second team's real workflow outcome
(for example, fewer handoffs or faster exception resolution), extension/review
effort, regressions, and ongoing support cost. Compare against the current process
and Power Apps with the same requirements before claiming replacement value or
expanding the deal.
