# Workbench: internal tools built with Devin

Workbench is a working prototype of a code-first alternative to a licensed low-code platform such as Microsoft Power Apps. Engineers working with Devin build internal operational tools as ordinary TypeScript in their own repository. Each tool is reviewed in pull requests, tested in CI, and runs on one shared application foundation.

## Executive summary

- **Representative versions of three current Power Apps, built as code:** a KYC review queue, a refunds dashboard and a feature-flag admin. Each covers its main workflow, including exception handling.
- **A shared foundation, so new tools are mostly business logic.** Navigation, work queues, search, saved views, record detail, assignment, notes and history are written once and reused by every tool.
- **Extensibility shown with a fourth tool.** Investigation, a transaction lookup across several data sources, was added through a typed extension point. It needed no copy of the shell and no change to the existing tools.
- **Operational controls are on by default.** Every action requires a confirmation and a written reason, eligibility rules are enforced before an action is allowed, and each record keeps its own history.
- **Synthetic data that exercises the edge cases:** missing and inconsistent evidence, over-limit refunds, staging rollbacks, and conflicting or unavailable data sources.

## Why this approach fits a growing engineering team

With roughly 60 engineers and more than ten additional tools planned, the main cost is delivering and maintaining each new tool, not building the first one. In this model internal tools follow the same practices as the rest of your software: version control, code review, automated tests and CI. Devin does most of the implementation, so engineers spend their time specifying the work and reviewing it. A consistent foundation also gives every tool the same behavior for queues, action reasons and eligibility checks.

## What the prototype demonstrates

| Capability your team relies on today | How Workbench demonstrates it                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Queue-based operational apps         | Shared queue with search, filters, sorting, saved views and links that reopen a specific record     |
| Forms, business rules and validation | Typed actions with eligibility guards that explain why an action is unavailable                     |
| Approval-style workflows             | KYC request-information and resume cycle; refunds approved for simulation before they are simulated |
| Change management                    | Feature flags with proposed diffs, change history and restore of the prior configuration            |
| Multi-source operational lookups     | Investigation preserves conflicting, stale, unavailable and missing results instead of hiding them  |
| Building new tools quickly           | Typed tool modules and a custom-page extension contract, checked automatically in CI                |

## The four tools

| Tool                          | Synthetic dataset                                                  | Suggested walkthrough                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **KYC review queue**          | 14 cases with complete, missing, expired and inconsistent evidence | Assign a case, request information, record the response, assess the evidence, and decide with a reason. An open evidence gap blocks approval.    |
| **Refunds dashboard**         | 10 requests ($18–$1,250) across the refund lifecycle               | Approve a request for simulation, then simulate it. Capacity is rechecked at each step, and over-limit and shared-payment requests stay blocked. |
| **Feature flags**             | 7 staging flags with owners, audiences and change history          | Change a flag with a reason, review the proposed diff, and restore the prior configuration as a new version.                                     |
| **Investigation** (extension) | 6 transactions (`TX-DEMO-001`…`006`) checked against three sources | Compare clean, conflicting, unavailable, stale, no-match and incomplete results, then retry a single degraded source.                            |

## Extending the platform

- **Queue tools** are defined in `src/modules/<tool>.ts`: fields, statuses, guarded actions, metrics and sample records. The shared shell provides the rest of the experience.
- **Custom pages** register through a small typed contract. Investigation consists of its own view (`src/features/Investigation.tsx`) and data (`src/features/evidence.ts`), plus one `defineReadOnlyPage` entry in `src/features/pages.tsx`. Automated tests check the registration and confirm that existing tools and saved data are unaffected.

Details: [extension guide](docs/extension-guide.md) and the [change ledger for the Investigation extension](docs/extension-proof.md).

## Running the demo

Requires Node 24 (`.nvmrc`).

```sh
nvm use
npm install
npm run dev
```

Open http://localhost:5173. The four tools run entirely in the browser and need no backend, database or credentials. Work is saved in the browser, and **Reset demo data** restores the original samples.

To run the quality checks used in CI:

```sh
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

## Scope and path to a pilot

This prototype shows workflow fit and extensibility. It is not a production deployment. All data is fictional: no identity is verified, no money moves, and no product configuration changes. The four core tools store data only in the browser.

A pilot would add:

1. Discovery against your current apps: screens, exceptions, permissions and integrations.
2. Single sign-on and role-based access.
3. Shared server-side storage for all tools.
4. Hosting, backups and monitoring.
5. Approved integrations with your providers.
6. A total-cost comparison based on measured engineering effort and the portion of current licensing that can actually be avoided.

## Additional extensions

These were built on the same foundation and aren't required for the core demo:

- **Shared KYC:** a multi-user version with a Node + SQLite API, demo sign-in, server-enforced operator and viewer roles, and protection against conflicting edits. Setup: [reference guide](docs/reference.md#run-shared-kyc).
- **Payment-provider lookup:** a read-only Stripe test-mode lookup. The key stays on the server, and the page reports "not connected" when no key is configured.
- **Vendor onboarding and spend approvals:** a cross-department workflow (Finance, Security, Legal) showing reuse beyond financial operations. [Walkthrough](docs/vendor-extension.md).

## How it was built

Workbench was built with Devin in about two hours of hands-on engineering time, spread across short sessions. Devin wrote the application, tests and documentation, and each milestone was delivered as a small reviewed pull request that passed CI.

## Documentation

- [Reference guide](docs/reference.md): detailed behavior, multi-user setup, security and storage.
- [Prototype contract](docs/prototype-contract.md): what the prototype claims and the evidence for each claim.
- [Gates, effort and cost](docs/gates-and-effort.md): implementation status, effort ledger and next steps.
