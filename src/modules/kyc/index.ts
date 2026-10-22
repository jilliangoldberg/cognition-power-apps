import { countStatus } from '../../core/format';
import type { RecordAction, Tone, ToolModule, ToolRecord } from '../../core/types';
import { kycSamples } from './samples';

const pending = (status: string) => ['Needs review', 'Escalated'].includes(status);
export const openKyc = (status: string) => pending(status) || status === 'Waiting for information';

const evidence = [
  { key: 'identityEvidence', area: 'identity', label: 'Identity document' },
  { key: 'addressEvidence', area: 'address', label: 'Proof of address' },
  { key: 'consistencyEvidence', area: 'consistency', label: 'Details match profile' },
];
const evidenceKeys = evidence.map(({ key }) => key);
const field = (r: ToolRecord, key: string) => String(kycDefaults(r).fields[key] ?? '');
const area = (key: string) => evidence.find((item) => item.key === key)?.area ?? key;
const resolvedPrefix = 'Resolved · was: ';
const resolved = (value: ToolRecord['fields'][string]) =>
  value === 'Clear' || String(value).startsWith(resolvedPrefix);

// Browsers may hold records saved before the evidence vocabulary was renamed.
const legacyEvidence: Record<string, string> = {
  'Consistent fictional sample': 'Clear',
  'Expired fictional document': 'Expired document',
  'Missing fictional identity field': 'Missing required field',
  'Missing dated fictional address evidence': 'Missing issue date',
  'Unreadable fictional submission': 'Unreadable upload',
  'Inconsistent fictional identity details': "Details don't match",
  'Not recorded in saved demo': 'Not recorded',
};
const legacyPrefix = 'Fictional replacement assessed · was: ';
const migrateEvidence = (value: string): string =>
  value.startsWith(legacyPrefix)
    ? resolvedPrefix + migrateEvidence(value.slice(legacyPrefix.length))
    : (legacyEvidence[value] ?? value);
const legacyPlaceholders = new Set([
  'Identify the missing or inconsistent fictional evidence before follow-up.',
  'No information request recorded in this demo.',
  'No fictional response recorded.',
  'No fictional response recorded for this request.',
  'No evidence assessment recorded.',
  'Initial synthetic scenario, not an authenticated review event.',
  'Fixture context: a fictional name-change explanation resolves the original discrepancy; no real review was performed.',
  'Inspect owner assignment activity for handoffs; escalation and resume context appears here.',
  'No reason recorded here; inspect existing activity for saved decisions.',
]);
const contextKeys = [
  'informationNeeded',
  'informationRequest',
  'responseContext',
  'evidenceReviewContext',
  'handoffContext',
  'decisionContext',
];

export function kycDefaults(record: ToolRecord): ToolRecord {
  const fields: ToolRecord['fields'] = {
    workflowVersion: 1,
    identityEvidence: 'Not recorded',
    addressEvidence: 'Not recorded',
    consistencyEvidence: 'Not recorded',
    evidenceReviewed: false,
    informationNeeded: '',
    informationRequest: '',
    communicationState: 'Unsent · no customer messaging integration',
    responseRecorded: false,
    respondedEvidence: '',
    responseContext: '',
    evidenceReviewContext: '',
    handoffContext: '',
    decisionContext: '',
    ...record.fields,
  };
  for (const key of evidenceKeys) fields[key] = migrateEvidence(String(fields[key]));
  for (const key of contextKeys) if (legacyPlaceholders.has(String(fields[key]))) fields[key] = '';
  // Responses saved before per-gap tracking can only be attributed when one gap is open.
  if (record.fields.respondedEvidence === undefined && fields.responseRecorded === true) {
    const open = evidenceKeys.filter((key) => !resolved(fields[key]));
    if (open.length === 1) fields.respondedEvidence = open[0];
  }
  return { ...record, fields };
}

const gapKeys = (r: ToolRecord) =>
  evidenceKeys.filter((key) => !resolved(kycDefaults(r).fields[key]));
const gaps = (r: ToolRecord) => gapKeys(r).length > 0;
const responded = (r: ToolRecord) =>
  String(kycDefaults(r).fields.respondedEvidence).split(',').filter(Boolean);
const unaddressed = (r: ToolRecord) => gapKeys(r).filter((key) => !responded(r).includes(key));

const checkDocument: Record<string, string> = {
  identityEvidence: 'identityDocument',
  addressEvidence: 'addressDocument',
  consistencyEvidence: 'consistencyNote',
};
function check(r: ToolRecord, key: string) {
  const value = field(r, key);
  const document = field(r, checkDocument[key]);
  const detail = value.startsWith(resolvedPrefix)
    ? `Replacement accepted (was: ${value.slice(resolvedPrefix.length).toLowerCase()})`
    : value === 'Clear'
      ? ''
      : key === 'consistencyEvidence' && document
        ? ''
        : value;
  return [document, detail].filter(Boolean).join(' · ');
}
function checkBadge(r: ToolRecord, key: string): { label: string; tone: Tone } {
  const value = field(r, key);
  if (value === 'Clear') return { label: 'Clear', tone: 'green' };
  if (value.startsWith(resolvedPrefix)) return { label: 'Resolved', tone: 'green' };
  if (value === 'Not recorded') return { label: 'Not recorded', tone: 'neutral' };
  if (responded(r).includes(key)) return { label: 'Response logged', tone: 'blue' };
  if (/expired/i.test(value)) return { label: 'Expired', tone: 'red' };
  if (/match/i.test(value)) return { label: 'Mismatch', tone: 'red' };
  return { label: 'Needs info', tone: 'amber' };
}

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
    { label: 'Review reason', value: (r) => String(r.fields.reviewReason) },
    { label: 'Risk rating', value: (r) => String(r.fields.risk) },
    { label: 'Summary', value: (r) => String(r.fields.summary), wide: true },
    {
      label: 'Next step',
      value: (r) => String(r.fields.nextStep ?? 'Review the case and record a decision.'),
      wide: true,
    },
  ],
  notice:
    'Sample customer with synthetic data. No identity documents are stored or verified, and no customer account is changed.',
  actions: [
    {
      id: 'approve',
      label: 'Approve case',
      tone: 'primary',
      confirmation: 'Approve this case.',
      available: (r) => r.status === 'Needs review',
      apply: (r) => ({
        ...r,
        status: 'Approved',
        fields: { ...r.fields, nextStep: 'Case closed. No further action needed.' },
      }),
    },
    {
      id: 'escalate',
      label: 'Escalate',
      confirmation: 'Send this case to a second reviewer.',
      available: (r) => r.status === 'Needs review',
      apply: (r) => ({
        ...r,
        status: 'Escalated',
        fields: {
          ...r.fields,
          nextStep: 'A second reviewer assesses the case, then returns it to review.',
        },
      }),
    },
    {
      id: 'request-information',
      label: 'Request information',
      confirmation:
        'Record what you need from the customer and move the case to waiting. No message is sent from this demo.',
      available: (r) => pending(r.status),
      apply: (r) => ({
        ...r,
        status: 'Waiting for information',
        fields: {
          ...r.fields,
          nextStep: "Wait for the customer's response, then return the case to review.",
        },
      }),
    },
    {
      id: 'resume',
      label: 'Return to review',
      confirmation: 'Explain what changed or what information arrived.',
      available: (r) => ['Waiting for information', 'Escalated'].includes(r.status),
      apply: (r) => ({
        ...r,
        status: 'Needs review',
        fields: {
          ...r.fields,
          nextStep: 'Assess the new information, then record a decision.',
        },
      }),
    },
    {
      id: 'reject',
      label: 'Reject case',
      tone: 'danger',
      confirmation: 'Reject this case.',
      available: (r) => r.status === 'Needs review',
      apply: (r) => ({
        ...r,
        status: 'Rejected',
        fields: { ...r.fields, nextStep: 'Case closed. No further action needed.' },
      }),
    },
  ],
  withDefaults: kycDefaults,
  localDetails: [
    {
      title: 'Customer',
      fields: [
        { label: 'Customer ID', value: (r) => String(r.fields.customerId) },
        { label: 'Account type', value: (r) => String(r.fields.accountType) },
        { label: 'Date of birth', value: (r) => field(r, 'dateOfBirth') },
        { label: 'Country of residence', value: (r) => String(r.fields.country) },
        { label: 'Phone', value: (r) => field(r, 'phone') },
        { label: 'Customer since', value: (r) => field(r, 'customerSince') },
        { label: 'Residential address', value: (r) => field(r, 'address'), wide: true },
      ],
    },
    {
      title: 'Verification checks',
      fields: [
        ...evidence.map(({ key, label }) => ({
          label,
          value: (r: ToolRecord) => check(r, key),
          badge: (r: ToolRecord) => checkBadge(r, key),
        })),
        {
          label: 'Reviewer assessment',
          value: (r) =>
            field(r, 'evidenceReviewContext') ||
            (r.fields.evidenceReviewed === true ? '' : 'Required before the case can be approved.'),
          badge: (r) =>
            r.fields.evidenceReviewed === true
              ? { label: 'Assessed', tone: 'green' }
              : { label: 'Not assessed', tone: 'amber' },
        },
      ],
    },
    {
      title: 'Customer follow-up',
      fields: [
        {
          label: 'Information requested',
          value: (r) => field(r, 'informationRequest'),
          wide: true,
        },
        {
          label: 'Delivery',
          value: (r) =>
            field(r, 'informationRequest') &&
            'Not sent · customer messaging is not connected in this demo',
          wide: true,
        },
        {
          label: 'Customer response',
          value: (r) =>
            r.fields.responseRecorded === true
              ? field(r, 'responseContext')
              : field(r, 'informationRequest') && 'Awaiting response',
          wide: true,
        },
      ],
    },
    {
      title: 'Case notes',
      fields: [
        { label: 'Escalation / handoff', value: (r) => field(r, 'handoffContext'), wide: true },
        { label: 'Decision reason', value: (r) => field(r, 'decisionContext'), wide: true },
      ],
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
  samples: kycSamples,
  validateFields: (r) =>
    ['customerId', 'country', 'accountType', 'risk', 'reviewReason', 'summary'].every(
      (key) => typeof r.fields[key] === 'string',
    ) &&
    (r.fields.workflowVersion === undefined || r.fields.workflowVersion === 1) &&
    [
      'identityEvidence',
      'addressEvidence',
      'consistencyEvidence',
      'informationNeeded',
      'informationRequest',
      'dateOfBirth',
      'phone',
      'address',
      'customerSince',
      'identityDocument',
      'addressDocument',
      'consistencyNote',
      'communicationState',
      'responseContext',
      'respondedEvidence',
      'evidenceReviewContext',
      'handoffContext',
      'decisionContext',
    ].every((key) => r.fields[key] === undefined || typeof r.fields[key] === 'string') &&
    ['evidenceReviewed', 'responseRecorded'].every(
      (key) => r.fields[key] === undefined || typeof r.fields[key] === 'boolean',
    ),
};

// The full local workflow: the base actions plus evidence and response steps.
kyc.localActions = [
  ...kyc.actions.map((action) => ({
    ...action,
    eligibility: (r: ToolRecord) =>
      action.id === 'approve'
        ? 'Requires a reviewer assessment with no open verification checks.'
        : action.id === 'resume'
          ? 'Returning to review does not mark the evidence as assessed.'
          : action.id === 'request-information' && field(r, 'informationNeeded')
            ? `Needed: ${field(r, 'informationNeeded')}`
            : '',
    blockedReason:
      action.id === 'approve'
        ? (r: ToolRecord) =>
            r.fields.evidenceReviewed === true && !gaps(r)
              ? undefined
              : 'Assess the evidence before approving. Each open verification check needs a logged customer response first.'
        : undefined,
    reasonLabel:
      action.id === 'request-information' ? 'Information needed and follow-up reason' : undefined,
    applyWithContext: (r: ToolRecord, reason: string) => {
      const next = action.apply(kycDefaults(r));
      const context: ToolRecord['fields'] =
        action.id === 'request-information'
          ? {
              informationRequest: reason,
              communicationState: 'Unsent · no customer messaging integration',
              responseRecorded: false,
              respondedEvidence: '',
              responseContext: '',
              evidenceReviewed: false,
            }
          : action.id === 'resume' || action.id === 'escalate'
            ? { handoffContext: reason }
            : { decisionContext: reason };
      return { ...next, fields: { ...next.fields, ...context } };
    },
  })),
  {
    id: 'record-response',
    label: 'Log customer response',
    confirmation:
      "Summarise the customer's reply. Logging it does not return the case to review or approve it.",
    eligibility: () => 'Logging a reply does not resume or approve the case.',
    reasonLabel: 'Customer response',
    available: (r) => r.status === 'Waiting for information' && !gaps(r),
    apply: (r) => r,
    applyWithContext: (r, reason) => ({
      ...r,
      fields: {
        ...kycDefaults(r).fields,
        responseRecorded: true,
        responseContext: reason,
        evidenceReviewed: false,
      },
    }),
  },
  ...evidence.map(
    ({ key, area }): RecordAction => ({
      id: `record-${area}-response`,
      label: `Log ${area} response`,
      confirmation: `Summarise the replacement document or explanation the customer provided for the ${area} check.`,
      eligibility: () =>
        `Each open check needs its own response. Logging it does not resume or approve the case.`,
      reasonLabel: `${area[0].toUpperCase()}${area.slice(1)} response`,
      available: (r) => r.status === 'Waiting for information' && unaddressed(r).includes(key),
      apply: (r) => r,
      applyWithContext: (r, reason) => {
        const fields = kycDefaults(r).fields;
        const entry = `${area[0].toUpperCase()}${area.slice(1)}: ${reason}`;
        return {
          ...r,
          fields: {
            ...fields,
            responseRecorded: true,
            respondedEvidence: [...responded(r), key].join(','),
            responseContext:
              fields.responseRecorded === true ? `${fields.responseContext} · ${entry}` : entry,
            evidenceReviewed: false,
          },
        };
      },
    }),
  ),
  {
    id: 'review-evidence',
    label: 'Assess evidence',
    confirmation:
      'Record your assessment of the verification checks and any replacement documents.',
    eligibility: () => 'Every open check needs a logged customer response before assessment.',
    reasonLabel: 'Evidence assessment',
    available: (r) => r.status === 'Needs review' && r.fields.evidenceReviewed !== true,
    blockedReason: (r) => {
      const missing = unaddressed(r).map(area);
      return missing.length
        ? `Request information and log a customer response for each open check first: ${missing.join(', ')}.`
        : undefined;
    },
    apply: (r) => r,
    applyWithContext: (r, reason) => {
      const fields = kycDefaults(r).fields;
      const replaced = Object.fromEntries(
        evidenceKeys
          .filter((key) => !resolved(fields[key]))
          .map((key) => [key, `${resolvedPrefix}${fields[key]}`]),
      );
      return {
        ...r,
        fields: { ...fields, ...replaced, evidenceReviewed: true, evidenceReviewContext: reason },
      };
    },
  },
];
