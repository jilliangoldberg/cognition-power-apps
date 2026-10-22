import { countStatus } from '../../core/format';
import type { ToolModule, ToolRecord } from '../../core/types';
import { flagSamples } from './samples';

export function flagDefaults(record: ToolRecord): ToolRecord {
  return {
    ...record,
    fields: {
      workflowVersion: 1,
      previousStatus: '',
      previousAudience: '',
      changeContext:
        'No prior configuration captured. Existing status is a synthetic saved value, not published state.',
      ...record.fields,
    },
  };
}

const stagingBlock = (r: ToolRecord) =>
  r.fields.environment !== 'Staging'
    ? 'Only synthetic Staging configuration can change. Production and other environments are not supported.'
    : undefined;
const configuration = (r: ToolRecord) =>
  `${r.fields.environment} · desired ${r.status} · audience: ${r.fields.audience}`;
const change = (
  r: ToolRecord,
  status: string,
  reason?: string,
  audience = String(r.fields.audience),
): ToolRecord => ({
  ...r,
  status,
  fields: {
    ...flagDefaults(r).fields,
    previousStatus: r.status,
    previousAudience: String(r.fields.audience),
    audience,
    changeContext: reason ?? 'Reason is recorded in local activity.',
  },
});
const history = (before: ToolRecord, after: ToolRecord) => ({
  before: configuration(before),
  after: configuration(after),
});
const preview = (r: ToolRecord, status: string, audience = String(r.fields.audience)) =>
  `Proposed local diff: desired ${r.status} → ${status}; environment stays Staging; audience ${r.fields.audience} → ${audience}. Publication: not connected. Observed consumer state: unknown.`;

export const flags: ToolModule = {
  id: 'flags',
  title: 'Feature flags',
  shortTitle: 'Feature flags',
  icon: 'flag',
  recordIcon: 'flag',
  color: 'green',
  description: 'Explore a small staging configuration panel. Changes stay in this browser.',
  recordLabel: 'flags',
  primaryColumn: 'Feature flag',
  secondaryColumn: 'Environment',
  secondaryValue: (r) => String(r.fields.environment),
  statuses: { Enabled: 'green', Disabled: 'neutral' },
  owners: ['Unassigned', 'You', 'Payments', 'Growth', 'Platform', 'Operations'],
  details: [
    { label: 'Flag key', value: (r) => r.subtitle },
    { label: 'Environment', value: (r) => String(r.fields.environment) },
    { label: 'Description', value: (r) => String(r.fields.description) },
    { label: 'Target audience', value: (r) => String(r.fields.audience) },
    { label: 'Desired local state', value: (r) => r.status },
    { label: 'Publication state', value: () => 'Not connected · not published to any service' },
    {
      label: 'Observed consumer state',
      value: () => 'Unknown · no product consumes this configuration',
    },
    {
      label: 'Prior desired configuration',
      value: (r) =>
        r.fields.previousStatus
          ? `${r.fields.previousStatus} · audience: ${r.fields.previousAudience}`
          : 'Not captured; older history is not inferred',
    },
    { label: 'Last change context', value: (r) => String(flagDefaults(r).fields.changeContext) },
  ],
  notice:
    'Local staging configuration only. No product or flag-evaluation service reads these values.',
  actions: [
    {
      id: 'enable',
      label: 'Enable flag',
      tone: 'primary',
      confirmation: 'Enable this staging flag in local demo data only.',
      available: (r) => r.status === 'Disabled',
      eligibility: () =>
        'Synthetic Staging only. Owner labels are not publish permissions; this change never publishes.',
      blockedReason: stagingBlock,
      preview: (r) => preview(r, 'Enabled'),
      history,
      apply: (r) => change(r, 'Enabled'),
      applyWithContext: (r, reason) => change(r, 'Enabled', reason),
    },
    {
      id: 'disable',
      label: 'Disable flag',
      tone: 'danger',
      confirmation: 'Disable this staging flag in local demo data only.',
      available: (r) => r.status === 'Enabled',
      eligibility: () =>
        'Synthetic Staging only. Disabling is a new desired configuration, not a production kill switch.',
      blockedReason: stagingBlock,
      preview: (r) => preview(r, 'Disabled'),
      history,
      apply: (r) => change(r, 'Disabled'),
      applyWithContext: (r, reason) => change(r, 'Disabled', reason),
    },
    {
      id: 'restore',
      label: 'Restore prior configuration',
      confirmation:
        'Restore the previous local desired Boolean value and audience as a new reasoned, versioned change. This cannot undo external effects.',
      available: (r) =>
        ['Enabled', 'Disabled'].includes(String(r.fields.previousStatus)) &&
        typeof r.fields.previousAudience === 'string' &&
        (r.fields.previousStatus !== r.status || r.fields.previousAudience !== r.fields.audience),
      eligibility: () =>
        'Requires a captured prior local value. Restoring adds a new history entry; it does not erase or rewind history.',
      blockedReason: stagingBlock,
      preview: (r) =>
        preview(r, String(r.fields.previousStatus), String(r.fields.previousAudience)),
      history,
      apply: (r) =>
        change(r, String(r.fields.previousStatus), undefined, String(r.fields.previousAudience)),
      applyWithContext: (r, reason) =>
        change(r, String(r.fields.previousStatus), reason, String(r.fields.previousAudience)),
    },
  ],
  withDefaults: flagDefaults,
  metrics: (records) => [
    { label: 'Sample flags', value: String(records.length), hint: 'Curated staging examples' },
    {
      label: 'Enabled',
      value: String(countStatus(records, 'Enabled')),
      hint: 'Local configuration only',
    },
    {
      label: 'Disabled',
      value: String(countStatus(records, 'Disabled')),
      hint: 'Available to enable',
    },
    { label: 'Environment', value: 'Staging', hint: 'No production connection' },
  ],
  samples: flagSamples,
  validateFields: (r) =>
    r.fields.environment === 'Staging' &&
    ['description', 'audience'].every((key) => typeof r.fields[key] === 'string') &&
    (r.fields.workflowVersion === undefined || r.fields.workflowVersion === 1) &&
    (r.fields.previousStatus === undefined ||
      ['', 'Enabled', 'Disabled'].includes(String(r.fields.previousStatus))) &&
    (r.fields.changeContext === undefined || typeof r.fields.changeContext === 'string') &&
    (r.fields.previousAudience === undefined || typeof r.fields.previousAudience === 'string'),
};
