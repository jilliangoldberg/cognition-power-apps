import type { ToolModule, ToolRecord } from '../../core/types';
import { samples } from './samples';

const departments = ['Sales', 'Engineering', 'Operations'];
const categories = ['Travel', 'Meals', 'Software', 'Equipment'];
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const amount = (r: ToolRecord) => Number(r.fields.amountUsd);
const isOpenClaim = (r: ToolRecord) => r.status === 'Submitted' || r.status === 'Needs receipt';

export const expenseClaims: ToolModule = {
  id: 'expense-claims',
  title: 'Expense claims',
  shortTitle: 'Expense claims',
  icon: 'check',
  color: 'green',
  description: 'Finance reviews synthetic employee expense claims. Changes stay in this browser.',
  recordLabel: 'claims',
  primaryColumn: 'Employee',
  secondaryColumn: 'Amount',
  secondaryValue: (r) => usd.format(amount(r)),
  statuses: {
    Submitted: 'amber',
    'Needs receipt': 'red',
    Approved: 'blue',
    Rejected: 'neutral',
    Paid: 'green',
  },
  owners: ['Unassigned', 'You', 'Alex Morgan', 'Jamie Brooks'],
  isOpen: isOpenClaim,
  noActionMessage: (r) =>
    r.status === 'Submitted'
      ? 'Approval needs a receipt. Request one or reject the claim.'
      : 'No decision left in the local demo. You can still assign it or add a note.',
  details: [
    { label: 'Department', value: (r) => String(r.fields.department) },
    { label: 'Category', value: (r) => String(r.fields.category) },
    { label: 'Amount', value: (r) => usd.format(amount(r)) },
    { label: 'Submitted', value: (r) => String(r.fields.submittedOn) },
    { label: 'Receipt attached', value: (r) => (r.fields.receiptAttached ? 'Yes' : 'No') },
    { label: 'Policy note', value: (r) => String(r.fields.policyNote) },
  ],
  notice:
    'Synthetic local demo data. Approving or marking paid does not move money or notify anyone.',
  actions: [
    {
      id: 'approve',
      label: 'Approve',
      tone: 'primary',
      confirmation: 'Approve this claim in local demo data only.',
      available: (r) => r.status === 'Submitted' && r.fields.receiptAttached === true,
      apply: (r) => ({ ...r, status: 'Approved' }),
    },
    {
      id: 'request-receipt',
      label: 'Request receipt',
      confirmation: 'Mark this claim as waiting for a receipt. No message is sent.',
      available: (r) => r.status === 'Submitted',
      apply: (r) => ({ ...r, status: 'Needs receipt' }),
    },
    {
      id: 'reject',
      label: 'Reject',
      tone: 'danger',
      confirmation: 'Reject this claim in local demo data only. The employee is not notified.',
      available: isOpenClaim,
      apply: (r) => ({ ...r, status: 'Rejected' }),
    },
    {
      id: 'mark-paid',
      label: 'Mark paid',
      tone: 'danger',
      confirmation: 'Mark this claim as paid in local demo data only. No payment is made.',
      available: (r) => r.status === 'Approved',
      apply: (r) => ({ ...r, status: 'Paid' }),
    },
  ],
  metrics: (records) => {
    const open = records.filter(isOpenClaim);
    return [
      { label: 'Open claims', value: String(open.length), hint: 'Submitted or needs receipt' },
      {
        label: 'Total open amount',
        value: usd.format(open.reduce((sum, r) => sum + amount(r), 0)),
        hint: 'Across open claims',
      },
      {
        label: 'Missing receipts',
        value: String(open.filter((r) => r.fields.receiptAttached !== true).length),
        hint: 'Open claims without a receipt',
      },
    ];
  },
  validateFields: (r) =>
    departments.includes(String(r.fields.department)) &&
    categories.includes(String(r.fields.category)) &&
    typeof r.fields.amountUsd === 'number' &&
    Number.isFinite(r.fields.amountUsd) &&
    r.fields.amountUsd > 0 &&
    typeof r.fields.submittedOn === 'string' &&
    typeof r.fields.receiptAttached === 'boolean' &&
    typeof r.fields.policyNote === 'string',
  samples,
};
