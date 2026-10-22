import { countStatus, dayLabel, isIsoDay } from '../../core/format';
import type { ToolModule, ToolRecord } from '../../core/types';
import { samples } from './samples';

export const schedules = ['Streaming', 'Hourly', 'Daily', 'Weekly', 'Monthly', 'One-time load'];
const textFields = ['requester', 'source', 'destination', 'purpose'];
const MAX_DAYS_AHEAD = 730;

const text = (r: ToolRecord, key: string) =>
  typeof r.fields[key] === 'string' ? String(r.fields[key]) : '';
const move = (status: string) => (r: ToolRecord) => ({ ...r, status });
const needsOwner = (r: ToolRecord) =>
  r.owner === 'Unassigned'
    ? 'Assign Data engineering or Platform before starting work.'
    : undefined;

export const pipelines: ToolModule = {
  id: 'pipelines',
  title: 'Pipeline requests',
  shortTitle: 'Pipeline requests',
  icon: 'bolt',
  color: 'blue',
  description:
    'Data scientists request new data pipelines. Data engineering and Platform triage, build and deliver them.',
  recordLabel: 'requests',
  primaryColumn: 'Request',
  secondaryColumn: 'Needed by',
  secondaryValue: (r) => dayLabel(text(r, 'neededBy')),
  statuses: {
    Submitted: 'amber',
    'Needs info': 'blue',
    'In progress': 'purple',
    Delivered: 'green',
    Declined: 'neutral',
  },
  owners: ['Unassigned', 'You', 'Data engineering', 'Platform'],
  isOpen: (r) => ['Submitted', 'Needs info', 'In progress'].includes(r.status),
  noActionMessage: () => 'This request is closed. You can still assign it or add a note.',
  details: [
    { label: 'Requested by', value: (r) => text(r, 'requester') },
    { label: 'Needed by', value: (r) => dayLabel(text(r, 'neededBy')) },
    { label: 'Source', value: (r) => text(r, 'source') },
    { label: 'Destination', value: (r) => text(r, 'destination') },
    { label: 'Refresh schedule', value: (r) => text(r, 'schedule') },
    { label: 'What it is for', value: (r) => text(r, 'purpose'), wide: true },
  ],
  notice: 'Synthetic requests. No pipeline, warehouse or scheduler is connected.',
  actions: [
    {
      id: 'start',
      label: 'Accept and start',
      tone: 'primary',
      confirmation: 'Accept this request and mark it in progress.',
      available: (r) => r.status === 'Submitted',
      blockedReason: needsOwner,
      apply: move('In progress'),
    },
    {
      id: 'ask',
      label: 'Ask for details',
      confirmation: 'Send this request back to the requester for more details.',
      reasonLabel: 'What details are missing?',
      available: (r) => r.status === 'Submitted',
      apply: move('Needs info'),
    },
    {
      id: 'details-received',
      label: 'Details received',
      confirmation: 'Return this request to the triage list with the new details.',
      available: (r) => r.status === 'Needs info',
      apply: move('Submitted'),
    },
    {
      id: 'deliver',
      label: 'Mark delivered',
      tone: 'primary',
      confirmation: 'Mark this pipeline as delivered to the requester.',
      available: (r) => r.status === 'In progress',
      apply: move('Delivered'),
    },
    {
      id: 'decline',
      label: 'Decline request',
      tone: 'danger',
      confirmation: 'Decline this request. Your reason is kept in its history.',
      available: (r) => ['Submitted', 'Needs info'].includes(r.status),
      apply: move('Declined'),
    },
  ],
  intake: {
    label: 'Submit a request',
    description:
      'Describe the data you need. It joins the list below for Data engineering and Platform to triage.',
    idPrefix: 'DPR',
    fields: [
      { key: 'name', label: 'Pipeline name', placeholder: 'e.g. Daily churn features' },
      { key: 'requester', label: 'Your name' },
      {
        key: 'source',
        label: 'Source',
        placeholder: 'e.g. Product events stream (app_events)',
        maxLength: 200,
      },
      {
        key: 'destination',
        label: 'Destination',
        placeholder: 'e.g. Analytics warehouse · ds_churn.features_daily',
        maxLength: 200,
      },
      { key: 'schedule', label: 'Refresh schedule', kind: 'select', options: schedules },
      { key: 'neededBy', label: 'Needed by', kind: 'date' },
      {
        key: 'purpose',
        label: 'What is it for?',
        kind: 'textarea',
        hint: 'The model, dashboard or analysis it feeds, and any freshness needs.',
      },
    ],
    example: {
      name: 'Weekly retention cohorts',
      requester: 'Sample Requester',
      source: 'Billing Postgres replica',
      destination: 'Analytics warehouse · ds.retention_weekly',
      schedule: 'Weekly',
      neededBy: '2026-02-01',
      purpose: 'Feeds the retention dashboard.',
    },
    create: (values, now) => {
      const today = now.toISOString().slice(0, 10);
      const latest = new Date(now.getTime() + MAX_DAYS_AHEAD * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (values.neededBy < today) throw new Error('Needed by must be today or later.');
      if (values.neededBy > latest) throw new Error('Needed by must be within two years.');
      const { name, ...fields } = values;
      return {
        name,
        subtitle: `Requested by ${values.requester}`,
        status: 'Submitted',
        fields,
      };
    },
  },
  metrics: (records) => [
    {
      label: 'Awaiting triage',
      value: String(countStatus(records, 'Submitted')),
      hint: 'Submitted, not started',
    },
    {
      label: 'Needs info',
      value: String(countStatus(records, 'Needs info')),
      hint: 'Waiting on the requester',
    },
    {
      label: 'In progress',
      value: String(countStatus(records, 'In progress')),
      hint: 'Being built',
    },
    {
      label: 'Delivered',
      value: String(countStatus(records, 'Delivered')),
      hint: 'Handed to the requester',
    },
  ],
  validateFields: (r) =>
    textFields.every((key) => typeof r.fields[key] === 'string' && r.fields[key] !== '') &&
    schedules.includes(String(r.fields.schedule)) &&
    isIsoDay(r.fields.neededBy),
  samples,
};
