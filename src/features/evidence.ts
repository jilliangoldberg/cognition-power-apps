import type { Tone } from '../core/types';

export interface EvidenceEvent {
  id: string;
  occurredAt: string;
  description: string;
  reference: string;
}

export interface RelatedReference {
  kind: 'Internal record';
  reference: string;
}

export interface SourceEvidence {
  id: string;
  lookupId: string;
  label: string;
  outcome: 'found' | 'not-found' | 'unavailable';
  reportedStatus?: string;
  attemptedAt: string;
  retrievedAt?: string;
  stale: boolean;
  complete: boolean;
  events: EvidenceEvent[];
  relatedReferences: RelatedReference[];
  payment?: PaymentDetails;
  retryCount: number;
}

// Only the card brand and last 4 digits exist, so a full card number cannot be rendered.
export interface PaymentDetails {
  customerName: string;
  customerEmail: string;
  merchant: string;
  card: { brand: 'Visa' | 'Mastercard' | 'Amex'; last4: string };
  amountCents: number;
}

const payments: Record<string, PaymentDetails> = {
  'TX-DEMO-001': {
    customerName: 'Maya Chen',
    customerEmail: 'maya.chen@example.com',
    merchant: 'Northwind Outfitters',
    card: { brand: 'Visa', last4: '4242' },
    amountCents: 18_450,
  },
  'TX-DEMO-002': {
    customerName: 'Jordan Ellis',
    customerEmail: 'jordan.ellis@example.com',
    merchant: 'Bluebird Books',
    card: { brand: 'Mastercard', last4: '5100' },
    amountCents: 3_299,
  },
  'TX-DEMO-003': {
    customerName: 'Priya Raman',
    customerEmail: 'priya.raman@example.com',
    merchant: 'Harbor Coffee Roasters',
    card: { brand: 'Visa', last4: '1881' },
    amountCents: 24_995,
  },
  'TX-DEMO-004': {
    customerName: 'Sam Okafor',
    customerEmail: 'sam.okafor@example.com',
    merchant: 'Atlas Fitness',
    card: { brand: 'Amex', last4: '0005' },
    amountCents: 8_900,
  },
  'TX-DEMO-006': {
    customerName: 'Lena Fischer',
    customerEmail: 'lena.fischer@example.com',
    merchant: 'Copperleaf Home',
    card: { brand: 'Visa', last4: '7731' },
    amountCents: 124_000,
  },
};

const CARD_NUMBER = /\d(?:[ -]?\d){11,18}/;

export const looksLikeCardNumber = (value: string) => CARD_NUMBER.test(value);

export const investigationExamples = [
  { id: 'TX-DEMO-001', label: 'All systems agree' },
  { id: 'TX-DEMO-002', label: 'Systems disagree' },
  { id: 'TX-DEMO-003', label: 'A system is down' },
  { id: 'TX-DEMO-004', label: 'Out-of-date data' },
  { id: 'TX-DEMO-005', label: 'Not found anywhere' },
  { id: 'TX-DEMO-006', label: 'Partial data' },
] as const;

function sourceEvent(
  transactionId: string,
  index: number,
  status: string,
  at: string,
): EvidenceEvent {
  return {
    id: `${transactionId}-${index}`,
    occurredAt: new Date(Date.parse(at) - (120 - index * 15) * 60_000).toISOString(),
    description:
      index === 0
        ? 'Payment recorded in the ledger'
        : index === 1
          ? 'Processor confirmed the charge'
          : `Bank settlement report: ${status}`,
    reference: `${transactionId}/source-${index}`,
  };
}

export const sourceLabels = ['Ledger', 'Payment processor', 'Bank settlement'];

export function syntheticEvidence(transactionId: string, now = new Date()): SourceEvidence[] {
  const at = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const known = investigationExamples.some((example) => example.id === transactionId);
  return sourceLabels.map((label, index) => {
    const noMatch = !known || transactionId === 'TX-DEMO-005';
    const unavailable = transactionId === 'TX-DEMO-003' && index === 2;
    const stale = transactionId === 'TX-DEMO-004' && index === 2;
    const status = transactionId === 'TX-DEMO-002' && index === 2 ? 'Pending review' : 'Completed';
    return {
      id: String(index),
      lookupId: transactionId,
      label,
      outcome: unavailable ? 'unavailable' : noMatch ? 'not-found' : 'found',
      reportedStatus: unavailable || noMatch ? undefined : status,
      attemptedAt: at(0),
      retrievedAt: unavailable ? undefined : at(stale ? 90 : 0),
      stale,
      complete: !(transactionId === 'TX-DEMO-006' && index === 1),
      retryCount: 0,
      payment:
        !unavailable && !noMatch && index === 0 && payments[transactionId]
          ? { ...payments[transactionId], card: { ...payments[transactionId].card } }
          : undefined,
      relatedReferences:
        unavailable || noMatch
          ? []
          : [{ kind: 'Internal record', reference: `${transactionId}/record` }],
      events: unavailable || noMatch ? [] : [sourceEvent(transactionId, index, status, at(0))],
    };
  });
}

export function canRetrySyntheticSource(source: SourceEvidence): boolean {
  return (
    investigationExamples.some((example) => example.id === source.lookupId) &&
    source.lookupId !== 'TX-DEMO-005' &&
    ['0', '1', '2'].includes(source.id) &&
    (source.outcome === 'unavailable' ||
      (source.outcome === 'found' && (source.stale || !source.complete)))
  );
}

export function retrySyntheticSource(source: SourceEvidence, now = new Date()): SourceEvidence {
  if (!canRetrySyntheticSource(source)) return source;
  const index = ['0', '1', '2'].indexOf(source.id);
  if (index < 0) return source;
  const reportedStatus = source.reportedStatus ?? 'Completed';
  const events = source.events.length
    ? source.events
    : [sourceEvent(source.lookupId, index, reportedStatus, source.attemptedAt)];
  return {
    ...source,
    outcome: 'found',
    reportedStatus,
    stale: false,
    complete: true,
    attemptedAt: now.toISOString(),
    retrievedAt: now.toISOString(),
    retryCount: source.retryCount + 1,
    relatedReferences: source.relatedReferences.length
      ? source.relatedReferences
      : [{ kind: 'Internal record', reference: `${source.lookupId}/record` }],
    events: source.complete
      ? events
      : [
          ...events,
          {
            id: `${source.lookupId}-${source.id}-detail`,
            occurredAt: new Date(Date.parse(source.attemptedAt) - 100 * 60_000).toISOString(),
            description: 'Processor fee and payout details received',
            reference: `${source.lookupId}/source-${source.id}/detail`,
          },
        ],
  };
}

export interface EvidenceSummary {
  tone: Tone;
  headline: string;
  nextStep: string;
}

export function summarizeEvidence(sources: SourceEvidence[]): EvidenceSummary {
  const found = sources.filter((source) => source.outcome === 'found');
  const statuses = [...new Set(found.map((source) => source.reportedStatus))];
  const unavailable = sources.find((source) => source.outcome === 'unavailable');
  const stale = found.find((source) => source.stale);
  const partial = found.find((source) => !source.complete);
  if (!found.length && !unavailable)
    return {
      tone: 'neutral',
      headline: 'No system has a record of this transaction',
      nextStep: 'Check the ID for typos, or ask the customer for their receipt.',
    };
  if (statuses.length > 1)
    return {
      tone: 'red',
      headline: 'Systems disagree',
      nextStep:
        found.map((source) => `${source.label} says ${source.reportedStatus}`).join(', ') +
        '. Don’t confirm the payment to the customer yet; escalate to the payments team.',
    };
  if (unavailable)
    return {
      tone: 'amber',
      headline: `${unavailable.label} didn’t respond`,
      nextStep: `${found.length ? `The other systems say ${statuses[0]}, but the` : 'The'} result isn’t confirmed until all three respond. Retry ${unavailable.label}.`,
    };
  if (stale)
    return {
      tone: 'amber',
      headline: `${stale.label} data is out of date`,
      nextStep: `Refresh ${stale.label} before relying on it.`,
    };
  if (partial)
    return {
      tone: 'amber',
      headline: `${partial.label} returned partial data`,
      nextStep: `Retry ${partial.label} to fetch the missing details.`,
    };
  return {
    tone: 'green',
    headline: `All ${sources.length} systems agree: ${statuses[0]}`,
    nextStep: 'No discrepancies found.',
  };
}
