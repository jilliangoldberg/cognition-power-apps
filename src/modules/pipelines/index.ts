import { countStatus } from '../../core/format';
import type { ToolModule, ToolRecord } from '../../core/types';
import { samples } from './samples';

export const SCHEDULES = ['Hourly', 'Daily', 'Weekly', 'Monthly', 'One-time backfill'];
const DAY_MS = 86_400_000;

/** A real calendar day as `YYYY-MM-DD`; rejects rollovers like 2026-02-30. */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
export const neededByLabel = (r: ToolRecord) =>
  isDay(r.fields.neededBy) ? dayFormat.format(new Date(`${r.fields.neededBy}T00:00:00Z`)) : '';

const text = (r: ToolRecord, key: string) =>
  typeof r.fields[key] === 'string' ? String(r.fields[key]) : '';
const required = (values: Record<string, string>, key: string, label: string, max: number) => {
  const value = typeof values[key] === 'string' ? values[key].trim() : '';
  if (value.length < 2) throw new Error(`${label} is required.`);
  if (value.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return value;
};

export function createPipelineRequest(
  values: Record<string, string>,
  records: ToolRecord[],
  now: Date,
): ToolRecord {
  const name = required(values, 'name', 'Pipeline name', 80);
  const requester = required(values, 'requester', 'Your name', 80);
  const source = required(values, 'source', 'Source', 120);
  const destination = required(values, 'destination', 'Destination', 120);
  const schedule = values.schedule;
  if (!SCHEDULES.includes(schedule)) throw new Error('Choose a refresh schedule.');
  const neededBy = typeof values.neededBy === 'string' ? values.neededBy.trim() : '';
  if (!isDay(neededBy)) throw new Error('Enter a needed-by date as YYYY-MM-DD.');
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const due = Date.parse(`${neededBy}T00:00:00Z`);
  if (due < today) throw new Error('The needed-by date cannot be in the past.');
  if (due > today + 730 * DAY_MS) throw new Error('Choose a needed-by date within two years.');
  const purpose = typeof values.purpose === 'string' ? values.purpose.trim() : '';
  if (purpose.length > 500) throw new Error('Purpose must be 500 characters or fewer.');
  const highest = Math.max(100, ...records.map((r) => Number(/^DPR-(\d+)$/.exec(r.id)?.[1] ?? 0)));
  return {
    id: `DPR-${highest + 1}`,
    name,
    subtitle: `${source} → ${destination}`,
    status: 'Submitted',
    owner: 'Unassigned',
    updatedAt: now.toISOString(),
    version: 1,
    fields: { requester, source, destination, schedule, neededBy, purpose },
  };
}

export const pipelines: ToolModule = {
  id: 'pipelines',
  title: 'Pipeline requests',
  shortTitle: 'Pipeline requests',
  icon: 'bolt',
  recordIcon: 'bolt',
  color: 'blue',
  description:
    'Data scientists request new data pipelines here. Data engineering and Platform triage and deliver them.',
  recordLabel: 'requests',
  primaryColumn: 'Pipeline',
  secondaryColumn: 'Needed by',
  secondaryValue: neededByLabel,
  statuses: {
    Submitted: 'amber',
    'Needs info': 'purple',
    'In progress': 'blue',
    Delivered: 'green',
    Declined: 'neutral',
  },
  owners: ['Unassigned', 'You', 'Data engineering', 'Platform'],
  isOpen: (r) => ['Submitted', 'Needs info', 'In progress'].includes(r.status),
  noActionMessage: () => 'This request is closed. You can still assign it or add a note.',
  details: [
    { label: 'Requested by', value: (r) => text(r, 'requester') },
    { label: 'Needed by', value: neededByLabel },
    { label: 'Source', value: (r) => text(r, 'source') },
    { label: 'Destination', value: (r) => text(r, 'destination') },
    { label: 'Refresh schedule', value: (r) => text(r, 'schedule') },
    { label: 'Purpose', value: (r) => text(r, 'purpose'), wide: true },
  ],
  notice: 'Synthetic local demo data. No pipeline is built and no one is notified.',
  actions: [
    {
      id: 'start',
      label: 'Accept and start',
      tone: 'primary',
      confirmation: 'Accept this request and mark it in progress (local demo data only).',
      available: (r) => r.status === 'Submitted',
      blockedReason: (r) =>
        r.owner === 'Unassigned' ? 'Assign an owner before starting this request.' : undefined,
      apply: (r) => ({ ...r, status: 'In progress' }),
    },
    {
      id: 'ask',
      label: 'Ask for info',
      confirmation: 'Mark this request as waiting on the requester. Your reason is the question.',
      reasonLabel: 'Question for the requester',
      available: (r) => r.status === 'Submitted',
      apply: (r) => ({ ...r, status: 'Needs info' }),
    },
    {
      id: 'resume',
      label: 'Info received',
      confirmation: 'Return this request to the triage list.',
      available: (r) => r.status === 'Needs info',
      apply: (r) => ({ ...r, status: 'Submitted' }),
    },
    {
      id: 'deliver',
      label: 'Mark delivered',
      tone: 'primary',
      confirmation: 'Mark this pipeline as delivered (local demo data only).',
      available: (r) => r.status === 'In progress',
      apply: (r) => ({ ...r, status: 'Delivered' }),
    },
    {
      id: 'decline',
      label: 'Decline request',
      tone: 'danger',
      confirmation: 'Decline this request. The reason is kept in its history.',
      available: (r) => r.status === 'Submitted' || r.status === 'Needs info',
      apply: (r) => ({ ...r, status: 'Declined' }),
    },
  ],
  metrics: (records) => [
    {
      label: 'Awaiting triage',
      value: String(countStatus(records, 'Submitted')),
      hint: 'Submitted, not started',
    },
    {
      label: 'In progress',
      value: String(countStatus(records, 'In progress')),
      hint: 'Being built',
    },
    {
      label: 'Needs info',
      value: String(countStatus(records, 'Needs info')),
      hint: 'Waiting on the requester',
    },
  ],
  validateFields: (r) =>
    ['requester', 'source', 'destination', 'purpose'].every(
      (key) => typeof r.fields[key] === 'string',
    ) &&
    SCHEDULES.includes(String(r.fields.schedule)) &&
    isDay(r.fields.neededBy),
  intake: {
    label: 'Submit a request',
    title: 'Request a data pipeline',
    fields: [
      { key: 'name', label: 'Pipeline name', required: true, maxLength: 80 },
      { key: 'requester', label: 'Your name', required: true, maxLength: 80 },
      {
        key: 'source',
        label: 'Source',
        required: true,
        maxLength: 120,
        help: 'Where the data comes from, e.g. a table, topic or bucket.',
      },
      {
        key: 'destination',
        label: 'Destination',
        required: true,
        maxLength: 120,
        help: 'Where it should land, e.g. a warehouse table or feature store.',
      },
      {
        key: 'schedule',
        label: 'Refresh schedule',
        type: 'select',
        options: SCHEDULES,
        required: true,
      },
      { key: 'neededBy', label: 'Needed by', type: 'date', required: true },
      { key: 'purpose', label: 'What is it for?', type: 'textarea', maxLength: 500 },
    ],
    create: createPipelineRequest,
  },
  samples,
};
