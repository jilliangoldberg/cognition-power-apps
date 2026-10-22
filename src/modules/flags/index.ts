import { countStatus } from '../../core/format';
import type { ToolModule, ToolRecord } from '../../core/types';
import { flagSamples } from './samples';

const legacyContext = [
  'No prior configuration captured. Existing status is a synthetic saved value, not published state.',
  'Reason is recorded in local activity.',
];

export function flagDefaults(record: ToolRecord): ToolRecord {
  const migrated: ToolRecord = {
    ...record,
    fields: {
      workflowVersion: 1,
      previousStatus: '',
      previousAudience: '',
      changeContext: '',
      ...record.fields,
    },
  };
  if (legacyContext.includes(String(migrated.fields.changeContext)))
    migrated.fields.changeContext = '';
  return migrated;
}

const stagingBlock = (r: ToolRecord) =>
  r.fields.environment !== 'Staging'
    ? "Only Staging flags can be changed here. Production isn't connected."
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
    changeContext: reason ?? '',
  },
});
const history = (before: ToolRecord, after: ToolRecord) => ({
  before: configuration(before),
  after: configuration(after),
});
const preview = (r: ToolRecord, status: string, audience = String(r.fields.audience)) =>
  `Change in Staging: ${r.status} → ${status}. Audience: ${
    audience === r.fields.audience
      ? `${audience} (unchanged)`
      : `${r.fields.audience} → ${audience}`
  }.`;
const text = (r: ToolRecord, key: string) =>
  typeof r.fields[key] === 'string' ? String(r.fields[key]) : '';

export const flags: ToolModule = {
  id: 'flags',
  title: 'Feature flags',
  shortTitle: 'Feature flags',
  icon: 'flag',
  recordIcon: 'flag',
  color: 'green',
  description: 'Turn staging feature flags on and off, with a reason recorded for every change.',
  recordLabel: 'flags',
  primaryColumn: 'Feature flag',
  secondaryColumn: 'Environment',
  secondaryValue: (r) => String(r.fields.environment),
  statuses: { Enabled: 'green', Disabled: 'neutral' },
  owners: ['Unassigned', 'You', 'Payments', 'Growth', 'Platform', 'Operations'],
  details: [
    { label: 'Flag key', value: (r) => r.subtitle },
    { label: 'Environment', value: (r) => text(r, 'environment') },
    { label: 'Description', value: (r) => text(r, 'description'), wide: true },
  ],
  localDetails: [
    {
      title: 'Configuration',
      fields: [
        {
          label: 'State',
          value: (r) => `${r.status} for ${text(r, 'audience')}`,
          badge: (r) =>
            r.status === 'Enabled'
              ? { label: 'On', tone: 'green' }
              : { label: 'Off', tone: 'neutral' },
        },
        {
          label: 'Previous configuration',
          value: (r) =>
            r.fields.previousStatus
              ? `${r.fields.previousStatus} for ${text(r, 'previousAudience')}`
              : '',
        },
        {
          label: 'Publishing',
          value: () => 'Changes are saved in this workspace only.',
          badge: () => ({ label: 'Not connected', tone: 'neutral' }),
        },
      ],
    },
    {
      title: 'Change notes',
      fields: [
        {
          label: 'Last change reason',
          value: (r) => text(flagDefaults(r), 'changeContext'),
          wide: true,
        },
      ],
    },
  ],
  notice: 'Staging only. Changes are saved here and are not published to a flag service.',
  actions: [
    {
      id: 'enable',
      label: 'Enable flag',
      tone: 'primary',
      confirmation: 'Enable this flag in Staging.',
      available: (r) => r.status === 'Disabled',
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
      confirmation: 'Disable this flag in Staging.',
      available: (r) => r.status === 'Enabled',
      blockedReason: stagingBlock,
      preview: (r) => preview(r, 'Disabled'),
      history,
      apply: (r) => change(r, 'Disabled'),
      applyWithContext: (r, reason) => change(r, 'Disabled', reason),
    },
    {
      id: 'restore',
      label: 'Restore prior configuration',
      confirmation: 'Restore the previous state and audience as a new change.',
      available: (r) =>
        ['Enabled', 'Disabled'].includes(String(r.fields.previousStatus)) &&
        typeof r.fields.previousAudience === 'string' &&
        (r.fields.previousStatus !== r.status || r.fields.previousAudience !== r.fields.audience),
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
    { label: 'Total flags', value: String(records.length), hint: 'In Staging' },
    {
      label: 'Enabled',
      value: String(countStatus(records, 'Enabled')),
      hint: 'Currently on',
    },
    {
      label: 'Disabled',
      value: String(countStatus(records, 'Disabled')),
      hint: 'Currently off',
    },
    { label: 'Environment', value: 'Staging', hint: 'Production not connected' },
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
