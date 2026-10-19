import { countStatus } from '../core/format';
import type { ToolModule } from '../core/types';

export const flags: ToolModule = {
  id: 'flags',
  title: 'Feature flags',
  shortTitle: 'Feature flags',
  icon: 'flag',
  color: 'green',
  description: 'Explore a small staging configuration panel. Changes stay in this browser.',
  recordLabel: 'flags',
  primaryColumn: 'Feature flag',
  secondaryColumn: 'Environment',
  secondaryValue: (r) => String(r.fields.environment),
  statuses: { Enabled: 'green', Disabled: 'neutral' },
  details: [
    { label: 'Flag key', value: (r) => r.subtitle },
    { label: 'Environment', value: (r) => String(r.fields.environment) },
    { label: 'Description', value: (r) => String(r.fields.description) },
    { label: 'Target audience', value: (r) => String(r.fields.audience) },
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
      apply: (r) => ({ ...r, status: 'Enabled' }),
    },
    {
      id: 'disable',
      label: 'Disable flag',
      tone: 'danger',
      confirmation: 'Disable this staging flag in local demo data only.',
      available: (r) => r.status === 'Enabled',
      apply: (r) => ({ ...r, status: 'Disabled' }),
    },
  ],
  metrics: (records) => [
    { label: 'Total flags', value: String(records.length), hint: 'Managed in this workspace' },
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
  validateFields: (r) =>
    r.fields.environment === 'Staging' &&
    ['description', 'audience'].every((key) => typeof r.fields[key] === 'string'),
};
