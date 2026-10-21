import { countStatus, dateTime, money } from '../../core/format';
import type { ToolModule } from '../../core/types';
import { refundSamples } from './samples';

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
      label: 'Context',
      value: (r) => String(r.fields.summary ?? 'Local sample request; no provider is connected.'),
    },
  ],
  notice:
    'Simulation only. No payment provider is connected, no funds move, and no ledger is updated. USD is a demo limitation. Approval, processing, and failure examples are illustrative read-only scenarios.',
  actions: [
    {
      id: 'simulate',
      label: 'Simulate refund',
      tone: 'primary',
      confirmation:
        'Simulate this request locally. This does not issue a refund or represent a provider outcome.',
      available: (r) => r.status === 'Requested',
      validate: (r, records) => {
        if (
          records.some(
            (other) => other.id !== r.id && other.fields.paymentId === r.fields.paymentId,
          )
        )
          throw new Error(
            'Multiple requests share this payment. Simulation is blocked until shared refundable capacity and reconciliation are modeled.',
          );
      },
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
    },
    {
      id: 'decline',
      label: 'Decline request',
      tone: 'danger',
      confirmation: 'Mark this request as declined in the local demo.',
      available: (r) => r.status === 'Requested',
      apply: (r) => ({ ...r, status: 'Declined' }),
    },
  ],
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
    ) && ['paymentId', 'reason'].every((key) => typeof r.fields[key] === 'string'),
};
