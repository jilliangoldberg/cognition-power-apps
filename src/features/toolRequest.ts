import { modules } from '../modules';
import { BUILT_IN_PAGES } from '../modules/contract';
import type { Tone } from '../core/types';
import { customPages } from './pages';

// Mirrors the `npm run new-tool` id/title rules in scripts/new-tool.ts.
const RESERVED_IDS = [...BUILT_IN_PAGES, ...customPages.map((page) => page.id)];
const TITLE = /^[A-Za-z0-9][A-Za-z0-9 &,/-]{0,39}$/;
const MAX_ITEMS = 12;
const MAX_TEXT = 600;

export interface ToolSpec {
  title: string;
  purpose: string;
  recordNoun: string;
  fields: string;
  statuses: string;
  actions: string;
  rules: string;
}

export interface ParsedAction {
  label: string;
  from: string;
  to: string;
}

export const exampleSpec: ToolSpec = {
  title: 'Expense claims',
  purpose: 'Finance reviews employee expense claims before they are reimbursed.',
  recordNoun: 'claim',
  fields: 'Employee\nCategory\nAmount (USD)\nReceipt attached',
  statuses: 'Submitted\nApproved\nRejected\nReimbursed',
  actions:
    'Approve: Submitted -> Approved\nReject: Submitted -> Rejected\nMark reimbursed: Approved -> Reimbursed',
  rules: 'Approve only when a receipt is attached. Claims over $500 need a written reason.',
};

export const emptySpec: ToolSpec = {
  title: '',
  purpose: '',
  recordNoun: '',
  fields: '',
  statuses: '',
  actions: '',
  rules: '',
};

const tones: Tone[] = ['amber', 'green', 'neutral', 'blue', 'purple', 'red'];
export const statusTone = (index: number): Tone => tones[index % tones.length];

export const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export function toolId(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '');
}

export function parseAction(line: string): ParsedAction | null {
  const match = /^([^:]+):\s*(.+?)\s*(?:->|→)\s*(.+)$/.exec(line);
  if (!match) return null;
  const [label, from, to] = match.slice(1).map((part) => part.trim());
  return label && from && to ? { label, from, to } : null;
}

export function specProblems(spec: ToolSpec, existingIds = modules.map((m) => m.id)) {
  const problems: string[] = [];
  const title = spec.title.trim();
  const id = toolId(title);
  if (!TITLE.test(title))
    problems.push('Tool name: 1–40 letters, numbers, spaces or & , / - characters.');
  else if (!/^[a-z]/.test(id)) problems.push('Tool name must start with a letter.');
  else if (RESERVED_IDS.includes(id) || existingIds.includes(id))
    problems.push(`A tool or page called "${id}" already exists. Choose another name.`);
  if (spec.purpose.trim().length < 10)
    problems.push('Describe who uses the tool and why (at least 10 characters).');
  if (!spec.recordNoun.trim()) problems.push('Say what one record is, for example "claim".');
  for (const key of ['purpose', 'recordNoun', 'fields', 'statuses', 'actions', 'rules'] as const)
    if (spec[key].length > MAX_TEXT) problems.push(`Keep each box under ${MAX_TEXT} characters.`);
  const fields = lines(spec.fields);
  const statuses = lines(spec.statuses);
  const actions = lines(spec.actions);
  if (!fields.length) problems.push('List at least one field.');
  if (statuses.length < 2) problems.push('List at least two statuses, one per line.');
  if ([fields, statuses, actions].some((list) => list.length > MAX_ITEMS))
    problems.push(`Keep each list to ${MAX_ITEMS} lines or fewer.`);
  const lower = statuses.map((status) => status.toLowerCase());
  if (new Set(lower).size !== lower.length) problems.push('Each status must be different.');
  if (!actions.length) problems.push('List at least one action.');
  const labels = new Set<string>();
  for (const line of actions) {
    const action = parseAction(line);
    if (!action) {
      problems.push(`Action "${line}" should look like "Approve: Submitted -> Approved".`);
      continue;
    }
    if (labels.has(action.label.toLowerCase()))
      problems.push(`Action "${action.label}" is listed twice.`);
    labels.add(action.label.toLowerCase());
    for (const status of [action.from, action.to])
      if (!lower.includes(status.toLowerCase()))
        problems.push(`Action "${action.label}" uses "${status}", which is not a listed status.`);
  }
  return [...new Set(problems)];
}

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join('\n');

export function devinRequest(spec: ToolSpec) {
  const title = spec.title.trim();
  const id = toolId(title);
  const statuses = lines(spec.statuses);
  const actions = lines(spec.actions)
    .map(parseAction)
    .filter((a) => a !== null);
  const rules = spec.rules.trim();
  return `Add a new Workbench tool to github.com/jilliangoldberg/cognition-power-apps.

1. Run \`npm run new-tool -- ${id} "${title}"\`.
2. Edit only \`src/modules/${id}/\` (follow docs/new-tool.md) so it matches this description:

**Purpose:** ${spec.purpose.trim()}
**One record is a:** ${spec.recordNoun.trim()}

**Fields** (shown in the table and record drawer):
${bullets(lines(spec.fields))}

**Statuses** (new records start as "${statuses[0]}"):
${bullets(statuses)}

**Actions:**
${bullets(actions.map((a) => `${a.label}: available when the status is "${a.from}"; changes it to "${a.to}"`))}
${rules ? `\n**Rules:** ${rules}\n` : ''}
3. Add 6–8 fictional sample records in \`samples.ts\` that cover every status and give every action a record to act on. Store money as integer cents.
4. Run \`npm run format:check\`, \`npm run lint\`, \`npm run typecheck\`, \`npm test\` and \`npm run build\`, then open a PR. Do not change shared code; the diff should be the new folder plus one line in \`src/modules/index.ts\`.`;
}
