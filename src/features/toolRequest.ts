export const SEND_PATH = '/api/devin/session';
export const MIN_PROMPT = 40;
export const MAX_PROMPT = 2000;

export const toolKinds = [
  {
    id: 'queue',
    label: 'Approval queue',
    starter:
      'An approval queue where [who] review [what is being requested]. Each item shows [key details]. They can approve or reject, and must [check before approving].',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    starter:
      'A dashboard for [who] that shows [numbers or charts], so they can spot [what problem] quickly.',
  },
  {
    id: 'lookup',
    label: 'Lookup / search',
    starter:
      'A search page where [who] look up [what] by [name, ID or email] and see [details] in one place.',
  },
  {
    id: 'intake',
    label: 'Intake form',
    starter:
      'A form where [who] submit [what request]. It asks for [fields], and [team] work through the submissions as a list.',
  },
  { id: 'other', label: 'Something else', starter: '' },
] as const;

export type ToolKind = (typeof toolKinds)[number]['id'];

export const checklist = [
  'Who uses it',
  'What information it shows',
  'What people do with it',
  'Anything that must never happen',
];

const placeholders = new Set(
  toolKinds.flatMap((kind) => [...kind.starter.matchAll(/\[[^\]]+\]/g)].map((m) => m[0])),
);
const starters = new Set<string>(toolKinds.map((kind) => kind.starter));

export const isStarter = (prompt: string) => starters.has(prompt.trim());

export function promptProblems(prompt: string) {
  const text = prompt.trim();
  if (!text) return ['Describe the tool you want.'];
  const problems: string[] = [];
  const left = [...text.matchAll(/\[[^\]]+\]/g)]
    .map((m) => m[0])
    .filter((p) => placeholders.has(p));
  if (left.length)
    problems.push(`Replace the bracketed parts with your details: ${left.join(', ')}.`);
  if (text.length < MIN_PROMPT)
    problems.push(`Add a little more detail (at least ${MIN_PROMPT} characters).`);
  if (text.length > MAX_PROMPT) problems.push(`Keep it under ${MAX_PROMPT} characters.`);
  return problems;
}

export function devinRequest(prompt: string, kind: ToolKind | null) {
  const label = toolKinds.find((item) => item.id === kind && item.id !== 'other')?.label;
  return `Build a new Workbench tool in github.com/jilliangoldberg/cognition-power-apps.

## What the requester wants${label ? ` (${label.toLowerCase()})` : ''}

${prompt.trim()}

## How to build it

- Choose a short name and a lowercase id for the sidebar.
- If it is a list of records that people review and act on, run \`npm run new-tool -- <id> "<Name>"\` and follow docs/new-tool.md. The shared shell then provides search, filters, saved views, notes and history.
- Otherwise, build it as a custom page: add a view in \`src/features/\`, register it in \`customPages\` in \`src/features/pages.tsx\` (see Investigation and Vendor approvals), and add its id to \`RESERVED\` in \`scripts/new-tool.ts\`.
- Use fictional sample data only. No real systems, network calls or secrets.
- Reuse the existing components and styles. Keep changes to shared code as small as possible.
- If anything above is ambiguous, make a sensible choice and note it in the PR.

## Before opening the PR

- Add focused tests for the new tool.
- Run \`npm run format:check\`, \`npm run lint\`, \`npm run typecheck\`, \`npm test\` and \`npm run build\`.
- Open a PR with a screenshot of the new tool.`;
}
