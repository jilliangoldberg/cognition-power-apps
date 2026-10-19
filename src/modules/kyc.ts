import { countStatus } from '../core/format';
import type { ToolModule } from '../core/types';

const pending = (status: string) => ['Needs review', 'Escalated'].includes(status);

export const kyc: ToolModule = {
  id: 'kyc',
  title: 'KYC review queue',
  shortTitle: 'KYC review',
  icon: 'identity',
  color: 'purple',
  description: 'Review customer cases, capture a decision, and keep work moving.',
  recordLabel: 'cases',
  primaryColumn: 'Customer',
  secondaryColumn: 'Review reason',
  secondaryValue: (record) => String(record.fields.reviewReason),
  statuses: { 'Needs review': 'amber', Escalated: 'purple', Approved: 'green', Rejected: 'red' },
  details: [
    { label: 'Customer ID', value: (r) => String(r.fields.customerId) },
    { label: 'Country', value: (r) => String(r.fields.country) },
    { label: 'Account type', value: (r) => String(r.fields.accountType) },
    { label: 'Risk level', value: (r) => String(r.fields.risk) },
    { label: 'Review reason', value: (r) => String(r.fields.reviewReason) },
    { label: 'Verification summary', value: (r) => String(r.fields.summary) },
  ],
  notice:
    'Synthetic customer. No identity documents are stored or verified. A decision only updates this demo.',
  actions: [
    {
      id: 'approve',
      label: 'Approve case',
      tone: 'primary',
      confirmation: 'Record this case as approved in the local demo.',
      available: (r) => pending(r.status),
      apply: (r) => ({ ...r, status: 'Approved' }),
    },
    {
      id: 'escalate',
      label: 'Escalate',
      confirmation: 'Mark this case for additional review in the local demo.',
      available: (r) => r.status === 'Needs review',
      apply: (r) => ({ ...r, status: 'Escalated' }),
    },
    {
      id: 'reject',
      label: 'Reject case',
      tone: 'danger',
      confirmation: 'Record this case as rejected in the local demo.',
      available: (r) => pending(r.status),
      apply: (r) => ({ ...r, status: 'Rejected' }),
    },
  ],
  metrics: (records) => [
    {
      label: 'Awaiting review',
      value: String(countStatus(records, 'Needs review')),
      hint: 'Ready for a first decision',
    },
    {
      label: 'Escalated',
      value: String(countStatus(records, 'Escalated')),
      hint: 'Needs a closer look',
    },
    {
      label: 'Approved',
      value: String(countStatus(records, 'Approved')),
      hint: 'Resolved in this dataset',
    },
    { label: 'Total cases', value: String(records.length), hint: 'All synthetic customers' },
  ],
  validateFields: (r) =>
    ['customerId', 'country', 'accountType', 'risk', 'reviewReason', 'summary'].every(
      (key) => typeof r.fields[key] === 'string',
    ),
};
