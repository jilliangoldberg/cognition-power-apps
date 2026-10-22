# Step 4 · independent-agent extension evidence

## Scope and reproducible baseline

- Fixed baseline: **`5d3d7191a710fe209ce5aed59ece7ce07b365b69`**, fetched before creating the
  independent branch `devin/1792433847-investigation-extension-proof`.
- This is roadmap **step 4**, not the different gate numbering in the existing v0.3 gates document.
  The older `33ae3c3` design/ledger baseline was **not** used. This ledger covers only this branch.
- Implementer: a separate child Devin session with an independent checkout. The existing
  Investigation already worked at the baseline; this increment strengthens it and packages its
  seam. It does **not** establish that an independent human engineer built/reviewed a new tool.
- [Builder guide and worked registration](extension-guide.md): typed contract v1, small starter,
  fixture/action responsibilities, explicit routing edits for a future tool, review and support.
- [Implementation session](https://app.devin.ai/sessions/f8a628916e2848fd967609287ca7d91b).

## What changed and why

1. **Owned custom view:** six reachable scenario buttons, attributed related-reference context,
   source-only timeline filtering without hiding source health, edited-input/last-result distinction,
   per-event retrieval provenance, and retained conflict/stale/incomplete/unavailable/no-match labels.
   No fourth queue, copied shell, extra registered tool, or local-state schema was introduced.
2. **Fixture retry correction:** only degraded known sources can be retried. Retrying does not
   turn no-match into success, erase a conflicting report, change another source, or confuse an
   event's occurrence with retry retrieval time. Incomplete retry supplies an omitted synthetic
   detail; unavailable retry supplies a fictional event anchored before the original attempt.
   These remain synchronous fixture operations, not provider availability or recovery evidence.
3. **Shared extension seam:** compile-time version/read-only/data-mode restrictions, static
   registration guards, declared reads, fixture-scenario inventory, proposed ownership/support,
   runbook metadata, and an unregistered starter test. No runtime loader or new safety stack.
4. **Justified shared-core upgrade:** `dateTime` adds explicit UTC/year and missing/invalid fallback.
   It is already used in all original tools' shared drawer and the Investigation timeline; no
   pointless tool-specific edits were required. Existing string inputs remain compatible, source
   data and policy are unchanged, and all existing helper consumers receive the display change.

## Exact change ledger

`git diff --numstat 5d3d7191a710fe209ce5aed59ece7ce07b365b69 -- src docs/extension-*.md`
reproduces committed added/deleted counts. Classification follows ownership, **not directory**:
the page registry and contract/starter are shared code even though they live in `features`.

| Ownership           | File                                            | Added | Deleted |
| ------------------- | ----------------------------------------------- | ----: | ------: |
| Module              | `src/features/Investigation.tsx`                |    95 |      28 |
| Module              | `src/features/evidence.ts`                      |    77 |      20 |
| Module              | `src/features/investigation.css`                |    47 |       0 |
| Shared core         | `src/core/format.ts`                            |    14 |       7 |
| Shared registry     | `src/features/pages.tsx`                        |    23 |       1 |
| Shared contract     | `src/features/extension-contract.ts`            |    62 |       0 |
| Shared starter      | `src/features/extension-starter.ts`             |    12 |       0 |
| Shared helper tests | `src/core/format.test.ts`                       |    23 |       0 |
| Module tests        | `src/features/Investigation.test.tsx`           |   111 |       0 |
| Module tests        | `src/features/evidence.test.ts`                 |   110 |       0 |
| Contract tests      | `src/features/extension-contract.test.tsx`      |    81 |       0 |
| Compatibility tests | `src/features/extension-compatibility.test.tsx` |    69 |       0 |
| Documentation       | `docs/extension-guide.md`                       |   136 |       0 |
| Documentation       | `docs/extension-proof.md`                       |   124 |       0 |

Production domain code: **3 files, +219 / −48**. Production shared code: **4 files, +111 / −8**.
Tests: **5 new files, +394 / −0**. Thus implementation plus tests: **12 files, +724 / −56**,
excluding the two documentation files. Added/deleted lines are observations, not quality scores or
productivity ratios. There is no zero-core-change claim. The view still uses the original shared
shell, `dateTime` and `money`; no duplicated navigation, auth, persistence, or mutation service.

## Observed checks and regressions

Environment: Linux, Node **v24.19.0**, existing npm scripts, no dependency/lockfile changes.

| Check                                                                  | Observed result                                                        |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Before edits: `npm test`                                               | **66 frontend / 30 server tests passed**                               |
| After edits: `npm run format:check`                                    | Passed; only touched files were formatted                              |
| `npm run lint` / `npm run typecheck`                                   | Passed                                                                 |
| `npm test`                                                             | **114 frontend tests in 11 files / 30 server tests in 4 files passed** |
| `npm run build`                                                        | Passed, 53 modules transformed                                         |
| `git diff --check`                                                     | Passed                                                                 |
| Formatter + extension compatibility suites under `TZ=Pacific/Honolulu` | **11 tests passed**                                                    |
| Same two suites under `TZ=Europe/Berlin`                               | **11 tests passed**                                                    |
| Existing setup: `npm install`                                          | 0 audit vulnerabilities reported; no package-file edits                |

All baseline test files/assertions remain unchanged. **48 new frontend tests** cover fixture
contracts/retry immutability, readable source distinctions, no fetch/storage writes during the
synthetic view's actions, version/read-only metadata rejection, registry coexistence, four-tool
formatter use, and byte-for-byte preserved v2 saved data. Full existing domain/storage/shared-client
and real HTTP/SQLite regressions passed. Provider transport tests remain mocked.

No test failures or product regressions were observed in this increment's recorded runs. Touched
files were normalized with Prettier; missing default-shell Node PATH was handled with the repo's
existing `nvm use`. No policy exceptions or server changes were made to achieve passing tests.
These checks do not prove browser keyboard/layout behavior, usable handoff, authenticated custom
extensions, real provider connectivity, compliance, or an enterprise upgrade policy.

## Effort observation window and missing evidence

| Activity                                                    | Actual observation                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| First recorded shell timestamp                              | `2026-10-19T18:17:34Z`                                                |
| Baseline test starts (frontend / server)                    | `2026-10-19T18:17:59Z` / `2026-10-19T18:18:07Z`                       |
| Focused implementation test starts                          | `2026-10-19T18:21:38Z` and `2026-10-19T18:22:30Z`                     |
| Full post-change test starts (frontend / server)            | `2026-10-19T18:23:47Z` / `2026-10-19T18:23:59Z`                       |
| First full-check/build results inspected                    | `2026-10-19T18:24:07Z`                                                |
| Timezone regression results inspected                       | `2026-10-19T18:25:02Z`                                                |
| Specification, human supervision/review, remediation effort | Not separately instrumented; human effort is **unmeasured, not zero** |
| Final verification stop; publication follows                | `2026-10-19T18:26:44Z`; commit timestamp records publication          |

These are **agent execution milestones**, not human work time or a productivity multiplier.
Documentation and final formatting/publication follow the implementation-check window. A real
independent human builder/reviewer must still record specification, review, remediation, support
handoff and release/upgrade effort. Proposed owner metadata is not a confirmed operational team.

## Integration and remaining gaps

- Parent can cherry-pick this standalone branch. Only existing shared production edits are
  `src/core/format.ts` and `src/features/pages.tsx`; new shared contract/starter files are isolated.
  No App integration is required for the existing Investigation ID. Review timestamp changes in
  every existing `dateTime` consumer, including Shared KYC/sandbox views, when combining branches.
- App, Overview, ToolView, RecordDrawer, Dialog, all modules, action/storage/type/view/fixture core,
  server, README, existing gates document, CI, dependencies, and pre-existing PR branches are
  unchanged. No PR, merge, deployment, secrets, real data, external writes or provider calls.
- **Browser validation and implementation screenshots: pending separate approval**, not performed.
  No testing agent was launched. jsdom dialog mocks are not evidence of actual Chrome behavior.
- Contract declarations are not a sandbox/auth boundary. Shared KYC remains separate; future
  operational custom pages need explicit common server-policy integration and adversarial tests.
- A static proposed upgrade/release/support checklist exists in the guide; no independent human
  review, team ownership handoff, real service load, cost savings or production readiness is proven.
