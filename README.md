# Workbench · internal tools built with Devin

A small React + TypeScript workspace that shows how a fintech engineering team can use Devin to build internal tools in code instead of Power Apps, and keep adding more. Three tools mirror the client's existing Power Apps: a **KYC review queue**, a **refunds dashboard** and a **feature-flag admin**. A fourth, **Investigation**, was added through the extension point to show the platform can grow without copying the shell.

All data is synthetic and fictional. Nothing verifies real identities, moves money or changes a real product.

## Run it

Requires Node 24 (`.nvmrc`).

```sh
nvm use
npm install
npm run dev
```

Open http://localhost:5173. The four tools run entirely in the browser: no backend, database or credentials. Your changes are saved in the browser's localStorage. **Reset demo data** restores the samples.

## The four tools

| Tool                                                | Synthetic data                                                                    | Try this                                                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KYC review queue**                                | 14 cases with complete, missing, expired and inconsistent evidence                | Assign an unassigned case. Request information, record the response, assess the evidence, then approve or reject with a reason. An open evidence gap blocks approval but not rejection. |
| **Refunds dashboard**                               | 10 requests ($18–$1,250) across requested, approved, processing and failed        | Approve a request for simulation, then simulate it. Capacity is rechecked at both steps. Over-capacity and shared-payment requests (Maya Robinson) stay blocked.                        |
| **Feature flags**                                   | 7 staging flags with owners, audiences and change history                         | Enable or disable a flag with a reason, inspect the proposed diff, then restore the prior configuration as a new version.                                                               |
| **Investigation** (4th tool, added as an extension) | 6 transactions, `TX-DEMO-001`…`006`, each checked against three synthetic sources | Look up each one. Results can be clean, conflicting, unavailable, stale, no-match or incomplete, and each keeps its own meaning. Retry a single degraded source.                        |

## What every tool gets from the shared shell

- **My work** overview: assigned, unassigned and waiting items, where each count opens exactly the list behind it.
- Search, filters, sort and up to 8 saved views per tool. Shareable links restore the record and the list you came from.
- A record drawer with details, assignment and handoff, notes and per-record history.
- Every action needs a confirmation and a written reason. Unavailable actions explain why before you type anything.
- Versioned browser storage with migration. Damaged or unknown saved data is kept rather than overwritten.

## How the platform extends

- **Queue tools** (KYC, refunds, flags) are defined as code in `src/modules/<tool>.ts`: fields, statuses, actions with guards, and metrics, plus sample records. The shell supplies the rest.
- **Custom pages** use a small typed contract. Investigation is its own view (`src/features/Investigation.tsx`) and its own fixtures (`src/features/evidence.ts`), registered with one `defineReadOnlyPage` entry in `src/features/pages.tsx`. The contract checks the registration (IDs, declared read-only actions, owner and support metadata), and tests confirm the existing tools and saved data are unaffected.

See the [extension guide](docs/extension-guide.md) and the [change ledger for the Investigation extension](docs/extension-proof.md).

## Optional extras (not needed for the core demo)

- **Shared KYC:** a multi-user KYC variant with a Node + SQLite API, demo logins, server-enforced operator/viewer roles, and stale-edit rejection. Setup: [docs/reference.md](docs/reference.md#run-shared-kyc).
- **Stripe test lookup:** one read-only test-mode PaymentIntent lookup, with the key kept on the server. With no key it shows "not connected".
- **Vendor approvals:** a cross-department example (Finance, Security, Legal) built on the same shell. See the [walkthrough](docs/vendor-extension.md).

## How this was built

Built with Devin in about two hours of the author's hands-on time, spread across short sessions. Devin wrote the code, tests and docs, and each milestone landed as a small reviewed PR with CI. The optional extras show how quickly further tools can be added on the same foundation.

## Limits

This is a prototype, not a Power Apps replacement ready for production. The original four tools store data only in the browser. There's no SSO, external writes, hosting or load testing, and nothing has been checked against the client's real apps. It's aimed at engineers working with Devin, not a no-code builder.

## Checks

```sh
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

`npm test` runs the frontend tests and the API/SQLite tests. CI runs the same checks on every PR.

## More detail

- [Full reference](docs/reference.md): detailed behavior, Shared KYC and Stripe setup, security and storage notes.
- [Prototype contract](docs/prototype-contract.md): what the prototype promises and how each promise is proven.
- [Gates, effort and cost](docs/gates-and-effort.md): implementation status, effort ledger, next steps.
