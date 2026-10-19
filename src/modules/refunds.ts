import { countStatus, money } from '../core/format';
import type { ToolModule } from '../core/types';

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
  statuses: { Requested: 'amber', Simulated: 'green', Declined: 'neutral' },
  details: [
    { label: 'Payment ID', value: (r) => String(r.fields.paymentId) },
    { label: 'Currency', value: () => 'USD' },
    { label: 'Original payment', value: (r) => money(Number(r.fields.paymentCents)) },
    { label: 'Previously refunded', value: (r) => money(Number(r.fields.refundedCents)) },
    { label: 'Requested refund', value: (r) => money(Number(r.fields.amountCents)) },
    { label: 'Request reason', value: (r) => String(r.fields.reason) },
  ],
  notice:
    'Simulation only. No payment provider is connected, no funds move, and no ledger is updated.',
  actions: [
    {
      id: 'simulate',
      label: 'Simulate refund',
      tone: 'primary',
      confirmation:
        'Simulate this request locally. This does not issue a refund or represent a provider outcome.',
      available: (r) => r.status === 'Requested',
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
      label: 'Pending requests',
      value: String(countStatus(records, 'Requested')),
      hint: 'Waiting for a decision',
    },
    {
      label: 'Pending amount',
      value: money(
        records
          .filter((r) => r.status === 'Requested')
          .reduce((sum, r) => sum + Number(r.fields.amountCents), 0),
      ),
      hint: 'USD · synthetic funds only',
    },
    {
      label: 'Simulated',
      value: String(countStatus(records, 'Simulated')),
      hint: 'No real refunds issued',
    },
    { label: 'Total requests', value: String(records.length), hint: 'All synthetic requests' },
  ],
  validateFields: (r) =>
    ['amountCents', 'paymentCents', 'refundedCents'].every(
      (key) => Number.isSafeInteger(r.fields[key]) && Number(r.fields[key]) >= 0,
    ) && ['paymentId', 'reason'].every((key) => typeof r.fields[key] === 'string'),
};
