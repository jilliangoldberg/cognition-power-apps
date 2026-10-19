import { countStatus } from '../core/format';
import type { ToolModule } from '../core/types';

const pending = (status: string) => ['Needs review', 'Escalated'].includes(status);
export const openKyc = (status: string) => pending(status) || status === 'Waiting for information';

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
  statuses: {
    'Needs review': 'amber',
    'Waiting for information': 'blue',
    Escalated: 'purple',
    Approved: 'green',
    Rejected: 'red',
  },
  owners: ['Unassigned', 'You', 'Alex Morgan', 'Jamie Brooks'],
  isOpen: (r) => openKyc(r.status),
  details: [
    { label: 'Customer ID', value: (r) => String(r.fields.customerId) },
    { label: 'Country', value: (r) => String(r.fields.country) },
    { label: 'Account type', value: (r) => String(r.fields.accountType) },
    { label: 'Illustrative review risk', value: (r) => String(r.fields.risk) },
    { label: 'Review reason', value: (r) => String(r.fields.reviewReason) },
    { label: 'Verification summary', value: (r) => String(r.fields.summary) },
    {
      label: 'Next step',
      value: (r) =>
        String(r.fields.nextStep ?? 'Review the context and record a reason for the next step.'),
    },
  ],
  notice:
    'Synthetic customer. Countries and risk labels are illustrative, not client coverage or policy. No identity documents are stored or verified; no account is activated.',
  actions: [
    {
      id: 'approve',
      label: 'Approve case',
      tone: 'primary',
      confirmation: 'Record this case as approved in the local demo.',
      available: (r) => r.status === 'Needs review',
      apply: (r) => ({
        ...r,
        status: 'Approved',
        fields: { ...r.fields, nextStep: 'No further case decision in this local sample.' },
      }),
    },
    {
      id: 'escalate',
      label: 'Escalate',
      confirmation: 'Mark this case for additional review in the local demo.',
      available: (r) => r.status === 'Needs review',
      apply: (r) => ({
        ...r,
        status: 'Escalated',
        fields: {
          ...r.fields,
          nextStep:
            'An additional reviewer should assess the case, then explicitly return it to review.',
        },
      }),
    },
    {
      id: 'request-information',
      label: 'Request information',
      confirmation:
        'Record what information is needed and move the case to waiting. No message is sent to a customer.',
      available: (r) => pending(r.status),
      apply: (r) => ({
        ...r,
        status: 'Waiting for information',
        fields: {
          ...r.fields,
          nextStep:
            'Wait for the requested information, then return to review. See local activity for the request details.',
        },
      }),
    },
    {
      id: 'resume',
      label: 'Return to review',
      confirmation:
        'Explain what changed or what information arrived. This records a local handoff, not provider verification.',
      available: (r) => ['Waiting for information', 'Escalated'].includes(r.status),
      apply: (r) => ({
        ...r,
        status: 'Needs review',
        fields: {
          ...r.fields,
          nextStep:
            'Assess the new information and record a reasoned decision. See local activity for the handoff.',
        },
      }),
    },
    {
      id: 'reject',
      label: 'Reject case',
      tone: 'danger',
      confirmation: 'Record this case as rejected in the local demo.',
      available: (r) => r.status === 'Needs review',
      apply: (r) => ({
        ...r,
        status: 'Rejected',
        fields: { ...r.fields, nextStep: 'No further case decision in this local sample.' },
      }),
    },
  ],
  metrics: (records) => [
    {
      label: 'Ready for review',
      value: String(countStatus(records, 'Needs review')),
      hint: 'Ready for a first decision',
    },
    {
      label: 'Escalated',
      value: String(countStatus(records, 'Escalated')),
      hint: 'Needs a closer look',
    },
    {
      label: 'Waiting for information',
      value: String(countStatus(records, 'Waiting for information')),
      hint: 'Open, not ready for a decision',
    },
    {
      label: 'Sample cases',
      value: String(records.length),
      hint: 'Curated examples, not company volume',
    },
  ],
  validateFields: (r) =>
    ['customerId', 'country', 'accountType', 'risk', 'reviewReason', 'summary'].every(
      (key) => typeof r.fields[key] === 'string',
    ),
};
