# Add a new tool

A queue-style tool (a searchable list of records with details, owners, notes and decisions) is one
folder plus one registry line. The shared shell provides the UI; the tool file only describes the
workflow. This is a reviewed-code path for an engineer working with Devin, not a no-code builder.

## 1. Generate it

```sh
npm run new-tool -- vendor-requests "Vendor requests"
```

This creates `src/modules/vendor-requests/index.ts` (definition) and `samples.ts` (four fictional
records), and adds one import and one entry to `src/modules/index.ts`. It refuses invalid IDs,
built-in page IDs, existing folders, and a registry it does not recognize; nothing is written on
failure. The starter is a Pending → Approved / Rejected request queue that already passes all checks.

## 2. What the tool gets without UI code

Navigation entry and overview card · search, status/owner/age filters, sorting and saved views ·
record drawer with details · assignment, notes and reason-required actions with confirmation ·
version checks against stale edits · activity history · local persistence and reset · saved browser
work keeps working (the new tool's samples are added on next load).

## 3. Shape it to the workflow

Edit only the two generated files:

| Field in `index.ts`                      | Controls                                                  |
| ---------------------------------------- | --------------------------------------------------------- |
| `statuses`                               | Allowed states and badge colors                           |
| `primaryColumn`, `secondaryColumn/Value` | Table columns                                             |
| `details`                                | Drawer fields (render from `record.fields`)               |
| `actions`                                | Decisions: when `available`, what `apply` changes         |
| `isOpen`, `noActionMessage`              | What counts as open work; message when no action fits     |
| `owners`                                 | Assignable people/teams (must include `Unassigned`)       |
| `metrics`                                | Summary cards above the table                             |
| `validateFields`                         | Required `fields` shape; saved data failing it is refused |
| `icon`, `color`, `recordIcon`            | Existing icon names; `purple`, `blue` or `green`          |

`samples.ts` holds deterministic fictional records relative to `now`. Keep them synthetic.

## 4. Check it

```sh
npm test          # src/modules/modules.test.ts checks every registered tool automatically
npm run dev       # open http://localhost:5173/#vendor-requests
```

The contract test fails with readable messages, for example
`VR-002: undeclared status "Pendng"`, `action "approve" has no sample record to act on`, or
`owner "Sam" is not listed`. Run lint, typecheck and build before opening a PR.

## Ask Devin to build it

> Add a new Workbench tool with `npm run new-tool -- <id> "<Title>"`. Then edit only
> `src/modules/<id>/` so it matches: statuses …, columns …, drawer fields …, actions … (with which
> statuses they apply to), owners …, and 5–8 fictional sample records covering each status. Run
> `npm test`, lint, typecheck and build, and open a PR. Do not change shared code.

The resulting diff should be the new folder plus one line in `src/modules/index.ts`. Any shared-code
change is a signal to review the seam, not something to accept silently.

## Five-minute demo

1. Show the prompt or the command, then the PR diff: one folder, one registry line.
2. Open the preview: the tool appears in navigation and on the overview.
3. Filter, open a record, assign it, add a note, take an action with a reason; show Activity.
4. Introduce a typo (e.g. a sample with status `Pendng`) and run `npm test` to show the contract
   check catching it.
5. Reset demo data.

## Review checklist

- Statuses and actions match the real workflow; no action implies an external effect it lacks.
- Samples are fictional and cover every status and action.
- `notice` states what is simulated.
- No edits outside the tool folder and registry line, unless reviewed as shared changes.

## Limits

- Tools are browser-local and synthetic. They do not get Shared KYC's sign-in, server
  authorization, shared database or conflict handling; that needs a separate design.
- Actions only change local record status/fields. There is no automation, notification or connector.
- Icons and colors are limited to the existing sets in `Icon.tsx` and `styles.css`.
- Renaming or removing a tool is not migrated: saved browser data then refuses to load until reset.
- Non-queue pages (like Investigation) are hand-written custom pages; the scaffold does not
  generate them yet.
