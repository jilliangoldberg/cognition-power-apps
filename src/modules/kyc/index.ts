import { countStatus } from '../../core/format';
import type { RecordAction, ToolModule, ToolRecord } from '../../core/types';
import { kycSamples } from './samples';

const pending = (status: string) => ['Needs review', 'Escalated'].includes(status);
export const openKyc = (status: string) => pending(status) || status === 'Waiting for information';

const evidence = [
  { key: 'identityEvidence', area: 'identity' },
  { key: 'addressEvidence', area: 'address' },
  { key: 'consistencyEvidence', area: 'consistency' },
];
const evidenceKeys = evidence.map(({ key }) => key);
const area = (key: string) => evidence.find((item) => item.key === key)?.area ?? key;
const assessedReplacement = 'Fictional replacement assessed · was: ';
const resolved = (value: ToolRecord['fields'][string]) =>
  value === 'Consistent fictional sample' || String(value).startsWith(assessedReplacement);

export function kycDefaults(record: ToolRecord): ToolRecord {
  const fields: ToolRecord['fields'] = {
    workflowVersion: 1,
    identityEvidence: 'Not recorded in saved demo',
    addressEvidence: 'Not recorded in saved demo',
    consistencyEvidence: 'Not recorded in saved demo',
    evidenceReviewed: false,
    informationNeeded: 'Identify the missing or inconsistent fictional evidence before follow-up.',
    informationRequest: 'No information request recorded in this demo.',
    communicationState: 'Unsent · no customer messaging integration',
    responseRecorded: false,
    respondedEvidence: '',
    responseContext: 'No fictional response recorded.',
    evidenceReviewContext: 'No evidence assessment recorded.',
    handoffContext:
      'Inspect owner assignment activity for handoffs; escalation and resume context appears here.',
    decisionContext: 'No reason recorded here; inspect existing activity for saved decisions.',
    ...record.fields,
  };
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
  withDefaults: kycDefaults,
  localDetails: [
    {
      label: 'Identity checklist · fictional',
      value: (r) => String(kycDefaults(r).fields.identityEvidence),
    },
    {
      label: 'Address checklist · fictional',
      value: (r) => String(kycDefaults(r).fields.addressEvidence),
    },
    {
      label: 'Consistency checklist · fictional',
      value: (r) => String(kycDefaults(r).fields.consistencyEvidence),
    },
    {
      label: 'Evidence assessment',
      value: (r) =>
        r.fields.evidenceReviewed === true
          ? 'Reviewed locally · not provider verification'
          : 'Needs a local evidence assessment before approval',
    },
    {
      label: 'Assessment context',
      value: (r) => String(kycDefaults(r).fields.evidenceReviewContext),
    },
    { label: 'Information needed', value: (r) => String(kycDefaults(r).fields.informationNeeded) },
    {
      label: 'Recorded request context',
      value: (r) => String(kycDefaults(r).fields.informationRequest),
    },
    {
      label: 'Communication delivery',
      value: (r) => String(kycDefaults(r).fields.communicationState),
    },
    {
      label: 'Fictional response context',
      value: (r) => String(kycDefaults(r).fields.responseContext),
    },
    {
      label: 'Gaps with a recorded response',
      value: (r) => responded(r).map(area).join(', ') || 'None recorded',
    },
    {
      label: 'Handoff / escalation context',
      value: (r) => String(kycDefaults(r).fields.handoffContext),
    },
    { label: 'Case decision context', value: (r) => String(kycDefaults(r).fields.decisionContext) },
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

// These browser-local extensions are not commands supported by the Shared KYC API.
kyc.localActions = [
  ...kyc.actions.map((action) => ({
    ...action,
    eligibility: (r: ToolRecord) =>
      action.id === 'approve'
        ? 'Illustrative local rule: return to review and assess fictional evidence before approval. No independent-review or client-policy claim.'
        : action.id === 'resume'
          ? 'Return to review does not record delivery, receipt, or verification. Assess the evidence separately.'
          : action.id === 'request-information'
            ? `Information needed: ${kycDefaults(r).fields.informationNeeded}. The recorded request stays unsent.`
            : 'Record a reasoned local case transition; no account or provider is changed.',
    blockedReason:
      action.id === 'approve'
        ? (r: ToolRecord) =>
            r.fields.evidenceReviewed === true && !gaps(r)
              ? undefined
              : 'Assess the fictional evidence before approving. Missing, expired or inconsistent samples need a recorded fictional replacement first.'
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
              responseContext: 'No fictional response recorded for this request.',
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
    label: 'Record fictional response',
    confirmation:
      'Manually describe a fictional explanation. This is not a received message or a provider check; the request remains unsent.',
    eligibility: () =>
      'Only waiting cases with no open checklist gap accept a general fictional explanation. Recording it does not resume or approve the case.',
    reasonLabel: 'Fictional explanation',
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
      label: `Record fictional ${area} response`,
      confirmation: `Manually describe a fictional replacement or explanation for the ${area} checklist gap only. This is not a received message or a provider check; the request remains unsent.`,
      eligibility: () =>
        `Only waiting cases with an open ${area} gap. Each gap needs its own response; recording it does not resume or approve the case.`,
      reasonLabel: `Fictional ${area} replacement / explanation`,
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
    label: 'Assess fictional evidence',
    confirmation:
      'Record your assessment of the fictional checklist and any replacement. This illustrative local rule is not identity verification, second review, or client policy.',
    eligibility: () =>
      'In review only. Each missing, expired, inconsistent or older unknown checklist item needs its own fictional response, then a separate assessment.',
    reasonLabel: 'Evidence assessment reason',
    available: (r) => r.status === 'Needs review' && r.fields.evidenceReviewed !== true,
    blockedReason: (r) => {
      const missing = unaddressed(r).map(area);
      return missing.length
        ? `Request the missing information and record a fictional replacement for each evidence gap before assessing: ${missing.join(', ')}.`
        : undefined;
    },
    apply: (r) => r,
    applyWithContext: (r, reason) => {
      const fields = kycDefaults(r).fields;
      const replaced = Object.fromEntries(
        evidenceKeys
          .filter((key) => !resolved(fields[key]))
          .map((key) => [key, `${assessedReplacement}${fields[key]}`]),
      );
      return {
        ...r,
        fields: { ...fields, ...replaced, evidenceReviewed: true, evidenceReviewContext: reason },
      };
    },
  },
];
