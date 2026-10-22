import { countStatus, dateTime, money } from '../../core/format';
import type { DetailSection, ToolModule, ToolRecord, Tone } from '../../core/types';
import { refundSamples, sharedSummary } from './samples';

const legacyContext = new Set([
  'No related-request snapshot recorded in saved demo; current siblings are checked before an action.',
  'No sibling in the initial synthetic snapshot; current siblings are rechecked before actions.',
  'No decision reason recorded here; inspect existing activity.',
  'No simulation detail recorded here; no provider outcome is known.',
  'Illustrative request against a completed payment. Amounts are sample USD, not client averages or policy thresholds.',
]);
const legacySharedSummary =
  'Two sample requests share this payment. Simulation is blocked: shared refundable capacity and reconciliation are not modeled. Investigate the other request first.';
const legacySnapshotSuffix =
  ' · initial synthetic snapshot, not reconciliation; current siblings are rechecked before actions';

const migrateText = (value: unknown) => {
  if (typeof value !== 'string') return value;
  if (legacyContext.has(value)) return '';
  if (value === legacySharedSummary) return sharedSummary;
  if (!value.endsWith(legacySnapshotSuffix)) return value;
  return value
    .slice(0, -legacySnapshotSuffix.length)
    .replace(' example · ', ' · ')
    .replace(/(\d+) cents$/, (_, cents: string) => money(Number(cents)));
};

export function refundDefaults(record: ToolRecord): ToolRecord {
  const fields: ToolRecord['fields'] = {
    workflowVersion: 1,
    relatedRequests: '',
    sharedPaymentContext: false,
    decisionContext: '',
    simulationContext: '',
    ...record.fields,
  };
  for (const key of ['relatedRequests', 'decisionContext', 'simulationContext', 'summary'])
    if (key in fields) fields[key] = migrateText(fields[key]) as string;
  return { ...record, fields };
}

const text = (r: ToolRecord, key: string) =>
  typeof r.fields[key] === 'string' ? String(r.fields[key]) : '';
const remaining = (r: ToolRecord) => Number(r.fields.paymentCents) - Number(r.fields.refundedCents);

const sharedMessage =
  'Multiple requests share this payment. Resolve the other request before approving or simulating this one.';

function balanceBlock(r: ToolRecord): string | undefined {
  if (
    !['amountCents', 'paymentCents', 'refundedCents'].every(
      (key) => Number.isSafeInteger(r.fields[key]) && Number(r.fields[key]) >= 0,
    ) ||
    Number(r.fields.amountCents) <= 0 ||
    Number(r.fields.refundedCents) > Number(r.fields.paymentCents) ||
    Number(r.fields.amountCents) > remaining(r)
  )
    return 'The requested amount exceeds the remaining refundable balance or the amounts are invalid.';
}

function capacityBlock(r: ToolRecord): string | undefined {
  return balanceBlock(r) ?? (r.fields.sharedPaymentContext === true ? sharedMessage : undefined);
}

function validateCapacity(r: ToolRecord, records: ToolRecord[]) {
  const blocked = capacityBlock(r);
  if (blocked) throw new Error(blocked);
  if (records.some((other) => other.id !== r.id && other.fields.paymentId === r.fields.paymentId))
    throw new Error(sharedMessage);
}

const badge = (label: string, tone: Tone) => ({ label, tone });

const approval: Record<string, [string, string, Tone]> = {
  Requested: ['Waiting for a reviewer decision', 'Pending', 'amber'],
  'Approved for simulation': ['Approved in this workspace', 'Approved', 'green'],
  Simulated: ['Approved in this workspace', 'Approved', 'green'],
  Declined: ['Declined in this workspace', 'Declined', 'neutral'],
  'Awaiting second approval': ['Waiting for a second approver', 'Waiting', 'purple'],
  Processing: ['Approved before submission', 'Approved', 'green'],
  Failed: ['Approved before submission', 'Approved', 'green'],
};
const outcome: Record<string, [string, string, Tone]> = {
  Simulated: ['Simulated · no money moved', 'Simulated', 'green'],
  Processing: ['Submitted · waiting for the provider result', 'Processing', 'blue'],
  Failed: ['Provider returned an error · investigate before retrying', 'Failed', 'red'],
};

const localDetails: DetailSection[] = [
  {
    title: 'Payment',
    fields: [
      { label: 'Payment ID', value: (r) => text(r, 'paymentId') },
      {
        label: 'Payment date',
        value: (r) => (typeof r.fields.paymentAt === 'string' ? dateTime(r.fields.paymentAt) : ''),
      },
      { label: 'Customer ID', value: (r) => text(r, 'customerId') },
      { label: 'Original payment', value: (r) => money(Number(r.fields.paymentCents)) },
      { label: 'Previously refunded', value: (r) => money(Number(r.fields.refundedCents)) },
      { label: 'Remaining balance', value: (r) => money(remaining(r)) },
    ],
  },
  {
    title: 'Refund checks',
    fields: [
      {
        label: 'Refundable balance',
        value: (r) =>
          `${money(Number(r.fields.amountCents))} requested of ${money(remaining(r))} remaining`,
        badge: (r) =>
          balanceBlock(r) ? badge('Exceeds balance', 'red') : badge('Within balance', 'green'),
      },
      {
        label: 'Other requests on this payment',
        value: (r) => text(refundDefaults(r), 'relatedRequests') || 'None',
        badge: (r) =>
          r.fields.sharedPaymentContext === true
            ? badge('Shared payment', 'amber')
            : badge('Clear', 'green'),
      },
      {
        label: 'Approval',
        value: (r) => approval[r.status]?.[0] ?? '',
        badge: (r) =>
          badge(approval[r.status]?.[1] ?? r.status, approval[r.status]?.[2] ?? 'neutral'),
      },
      {
        label: 'Refund',
        value: (r) => outcome[r.status]?.[0] ?? 'Not issued',
        badge: (r) =>
          badge(outcome[r.status]?.[1] ?? 'Not issued', outcome[r.status]?.[2] ?? 'neutral'),
      },
    ],
  },
  {
    title: 'Case notes',
    fields: [
      {
        label: 'Decision reason',
        value: (r) => text(refundDefaults(r), 'decisionContext'),
        wide: true,
      },
      {
        label: 'Simulation note',
        value: (r) => text(refundDefaults(r), 'simulationContext'),
        wide: true,
      },
    ],
  },
];

export const refunds: ToolModule = {
  id: 'refunds',
  title: 'Refunds dashboard',
  shortTitle: 'Refunds',
  icon: 'refund',
  color: 'blue',
  description: 'Review refund requests, check balances, and simulate approved refunds.',
  recordLabel: 'requests',
  primaryColumn: 'Customer / payment',
  secondaryColumn: 'Requested amount',
  secondaryValue: (r) => money(Number(r.fields.amountCents)),
  statuses: {
    Requested: 'amber',
    'Approved for simulation': 'purple',
    Simulated: 'green',
    Declined: 'neutral',
    'Awaiting second approval': 'purple',
    Processing: 'blue',
    Failed: 'red',
  },
  legacyStatuses: {
    'Awaiting approval example': 'Awaiting second approval',
    'Processing example': 'Processing',
    'Failed example': 'Failed',
  },
  owners: ['Unassigned', 'You', 'Alex Morgan', 'Jamie Brooks'],
  isOpen: (r) => !['Simulated', 'Declined'].includes(r.status),
  noActionMessage: (r) =>
    ['Awaiting second approval', 'Processing', 'Failed'].includes(r.status)
      ? 'Sample request in a provider or second-approval state. Those steps are not connected here, so you can only reassign it or add a note.'
      : 'This request is resolved. You can still reassign it or add a note.',
  details: [
    { label: 'Request reason', value: (r) => text(r, 'reason') },
    { label: 'Requested refund', value: (r) => money(Number(r.fields.amountCents)) },
    { label: 'Summary', value: (r) => text(refundDefaults(r), 'summary'), wide: true },
  ],
  localDetails,
  notice:
    'Refunds are simulated. No payment provider is connected and no money moves. Processing and failed requests are sample states.',
  actions: [
    {
      id: 'approve-refund',
      label: 'Approve for simulation',
      tone: 'primary',
      confirmation:
        'Approve this refund. Simulating it is a separate step; no payment is submitted.',
      blockedReason: capacityBlock,
      validate: validateCapacity,
      available: (r) => r.status === 'Requested',
      apply: (r) => ({ ...r, status: 'Approved for simulation' }),
      applyWithContext: (r, reason) => ({
        ...r,
        status: 'Approved for simulation',
        fields: { ...refundDefaults(r).fields, decisionContext: reason },
      }),
    },
    {
      id: 'simulate',
      label: 'Simulate refund',
      tone: 'primary',
      confirmation: 'Simulate this approved refund. No money is sent to the customer.',
      available: (r) => r.status === 'Approved for simulation',
      eligibility: () => 'Balance and other requests on this payment are checked again first.',
      blockedReason: capacityBlock,
      validate: validateCapacity,
      apply: (r) => {
        const amount = Number(r.fields.amountCents);
        if (
          !Number.isSafeInteger(amount) ||
          amount <= 0 ||
          amount > Number(r.fields.paymentCents) - Number(r.fields.refundedCents)
        ) {
          throw new Error('The requested amount exceeds the remaining refundable balance.');
        }
        return { ...r, status: 'Simulated' };
      },
      applyWithContext: (r, reason) => ({
        ...r,
        status: 'Simulated',
        fields: { ...refundDefaults(r).fields, simulationContext: reason },
      }),
    },
    {
      id: 'decline',
      label: 'Decline request',
      tone: 'danger',
      confirmation: 'Decline this refund request. No money moves.',
      available: (r) => ['Requested', 'Approved for simulation'].includes(r.status),
      apply: (r) => ({ ...r, status: 'Declined' }),
      applyWithContext: (r, reason) => ({
        ...r,
        status: 'Declined',
        fields: { ...refundDefaults(r).fields, decisionContext: reason },
      }),
    },
  ],
  withDefaults: refundDefaults,
  metrics: (records) => [
    {
      label: 'Requested',
      value: String(countStatus(records, 'Requested')),
      hint: 'Waiting for a decision',
    },
    {
      label: 'Requested value',
      value: money(
        records
          .filter((r) => r.status === 'Requested')
          .reduce((sum, r) => sum + Number(r.fields.amountCents), 0),
      ),
      hint: 'Across requests waiting for a decision',
    },
    {
      label: 'Simulated',
      value: String(countStatus(records, 'Simulated')),
      hint: 'No money moved',
    },
    {
      label: 'Total requests',
      value: String(records.length),
      hint: 'In this queue',
    },
  ],
  samples: refundSamples,
  validateFields: (r) =>
    ['amountCents', 'paymentCents', 'refundedCents'].every(
      (key) => Number.isSafeInteger(r.fields[key]) && Number(r.fields[key]) >= 0,
    ) &&
    ['paymentId', 'reason'].every((key) => typeof r.fields[key] === 'string') &&
    (r.fields.workflowVersion === undefined || r.fields.workflowVersion === 1) &&
    (r.fields.sharedPaymentContext === undefined ||
      typeof r.fields.sharedPaymentContext === 'boolean') &&
    ['relatedRequests', 'decisionContext', 'simulationContext'].every(
      (key) => r.fields[key] === undefined || typeof r.fields[key] === 'string',
    ),
};
