import { countStatus, dateTime, money } from '../../core/format';
import type { ToolModule, ToolRecord } from '../../core/types';
import { refundSamples } from './samples';

export function refundDefaults(record: ToolRecord): ToolRecord {
  return {
    ...record,
    fields: {
      workflowVersion: 1,
      relatedRequests:
        'No related-request snapshot recorded in saved demo; current siblings are checked before an action.',
      sharedPaymentContext: false,
      decisionContext: 'No decision reason recorded here; inspect existing activity.',
      simulationContext: 'No simulation detail recorded here; no provider outcome is known.',
      ...record.fields,
    },
  };
}

function capacityBlock(r: ToolRecord): string | undefined {
  if (
    !['amountCents', 'paymentCents', 'refundedCents'].every(
      (key) => Number.isSafeInteger(r.fields[key]) && Number(r.fields[key]) >= 0,
    ) ||
    Number(r.fields.amountCents) <= 0 ||
    Number(r.fields.refundedCents) > Number(r.fields.paymentCents) ||
    Number(r.fields.amountCents) > Number(r.fields.paymentCents) - Number(r.fields.refundedCents)
  )
    return 'The requested amount exceeds the remaining refundable balance or the integer minor-unit amounts are invalid.';
  if (r.fields.sharedPaymentContext === true)
    return 'Multiple requests share this payment. Simulation is blocked until shared refundable capacity and reconciliation are modeled.';
}

function validateCapacity(r: ToolRecord, records: ToolRecord[]) {
  const blocked = capacityBlock(r);
  if (blocked) throw new Error(blocked);
  if (records.some((other) => other.id !== r.id && other.fields.paymentId === r.fields.paymentId))
    throw new Error(
      'Multiple requests share this payment. Simulation is blocked until shared refundable capacity and reconciliation are modeled.',
    );
}

export const refunds: ToolModule = {
  id: 'refunds',
  title: 'Refunds dashboard',
  shortTitle: 'Refunds',
  icon: 'refund',
  color: 'blue',
  description: 'Inspect refund requests and try a local, no-money-moved simulation.',
  recordLabel: 'requests',
  primaryColumn: 'Customer / payment',
  secondaryColumn: 'Requested amount',
  secondaryValue: (r) => money(Number(r.fields.amountCents)),
  statuses: {
    Requested: 'amber',
    'Approved for simulation': 'purple',
    Simulated: 'green',
    Declined: 'neutral',
    'Awaiting approval example': 'purple',
    'Processing example': 'blue',
    'Failed example': 'red',
  },
  owners: ['Unassigned', 'You', 'Alex Morgan', 'Jamie Brooks'],
  isOpen: (r) => !['Simulated', 'Declined'].includes(r.status),
  noActionMessage: (r) =>
    r.status.endsWith('example')
      ? 'Read-only scenario, not a live provider or approval workflow. You can assign it or add a note; no payment action is available.'
      : 'This request is resolved in the local demo. You can still assign it or add a note.',
  details: [
    { label: 'Payment ID', value: (r) => String(r.fields.paymentId) },
    {
      label: 'Payment date',
      value: (r) =>
        typeof r.fields.paymentAt === 'string'
          ? dateTime(r.fields.paymentAt)
          : 'Not recorded in older demo data',
    },
    {
      label: 'Customer ID',
      value: (r) => String(r.fields.customerId ?? 'Not recorded in older demo data'),
    },
    { label: 'Currency', value: () => 'USD' },
    { label: 'Original payment', value: (r) => money(Number(r.fields.paymentCents)) },
    { label: 'Previously refunded', value: (r) => money(Number(r.fields.refundedCents)) },
    {
      label: 'Remaining balance',
      value: (r) => money(Number(r.fields.paymentCents) - Number(r.fields.refundedCents)),
    },
    { label: 'Requested refund', value: (r) => money(Number(r.fields.amountCents)) },
    { label: 'Request reason', value: (r) => String(r.fields.reason) },
    {
      label: 'Related request snapshot · synthetic',
      value: (r) => String(refundDefaults(r).fields.relatedRequests),
    },
    {
      label: 'Integer USD minor units',
      value: (r) =>
        `Payment ${r.fields.paymentCents}; previously refunded ${r.fields.refundedCents}; requested ${r.fields.amountCents}; remaining ${Number(r.fields.paymentCents) - Number(r.fields.refundedCents)} cents`,
    },
    {
      label: 'Request decision',
      value: (r) =>
        r.status === 'Requested'
          ? 'Pending local decision'
          : r.status === 'Approved for simulation' || r.status === 'Simulated'
            ? 'Approved locally for simulation only'
            : r.status === 'Declined'
              ? 'Declined locally'
              : 'Read-only decision illustration; no local approval performed',
    },
    {
      label: 'Execution / provider outcome',
      value: (r) =>
        r.status === 'Simulated'
          ? 'Local simulation recorded · no refund issued; provider outcome unknown'
          : r.status === 'Failed example'
            ? 'Uncertain read-only illustration · failure does not prove no provider effect; do not retry'
            : r.status === 'Processing example'
              ? 'Read-only processing illustration · no submission performed by this app'
              : 'Not executed · no provider connection',
    },
    { label: 'Decision context', value: (r) => String(refundDefaults(r).fields.decisionContext) },
    {
      label: 'Simulation context',
      value: (r) => String(refundDefaults(r).fields.simulationContext),
    },
    {
      label: 'Context',
      value: (r) => String(r.fields.summary ?? 'Local sample request; no provider is connected.'),
    },
  ],
  notice:
    'Simulation only. No payment provider is connected, no funds move, and no ledger is updated. USD is a demo limitation. Approval, processing, and failure examples are illustrative read-only scenarios.',
  actions: [
    {
      id: 'approve-refund',
      label: 'Approve for simulation',
      tone: 'primary',
      confirmation:
        'Record a local decision only. A separate simulation step follows; no payment is submitted or reserved.',
      eligibility: () =>
        'Requested cases only; positive integer USD cents within remaining capacity. Shared-payment requests stay blocked. This is not client approval policy.',
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
      confirmation:
        'Simulate this request locally. This does not issue a refund or represent a provider outcome.',
      available: (r) => r.status === 'Approved for simulation',
      eligibility: () =>
        'Requires a prior local approval. Capacity and current sibling requests are checked again; no reservation or durable execution exists.',
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
      confirmation: 'Mark this request as declined in the local demo.',
      available: (r) => ['Requested', 'Approved for simulation'].includes(r.status),
      eligibility: () =>
        'Decline a requested or approved-but-not-simulated request. No money or external request is changed.',
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
      label: 'Requested (sample)',
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
      hint: 'Sample USD · not provider-pending funds',
    },
    {
      label: 'Simulated',
      value: String(countStatus(records, 'Simulated')),
      hint: 'No real refunds issued',
    },
    {
      label: 'Sample requests',
      value: String(records.length),
      hint: 'Curated examples, not company volume',
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
