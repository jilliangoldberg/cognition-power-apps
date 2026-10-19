export interface EvidenceEvent {
  id: string;
  occurredAt: string;
  description: string;
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
}

export function syntheticEvidence(transactionId: string, now = new Date()): SourceEvidence[] {
  const at = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const known = /^TX-DEMO-00[1-6]$/.test(transactionId);
  return ['Internal records', 'Processing events', 'Reconciliation reports'].map((label, index) => {
    const noMatch = !known || transactionId === 'TX-DEMO-005';
    const unavailable = transactionId === 'TX-DEMO-003' && index === 2;
    const stale = transactionId === 'TX-DEMO-004' && index === 2;
    const status =
      transactionId === 'TX-DEMO-002' && index === 2 ? 'Pending review' : 'Completed example';
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
      events:
        unavailable || noMatch
          ? []
          : [
              {
                id: `${transactionId}-${index}`,
                occurredAt: at(120 - index * 15),
                description:
                  index === 0
                    ? 'Synthetic transaction recorded'
                    : index === 1
                      ? 'Synthetic processing update received'
                      : `Synthetic reconciliation report: ${status}`,
                reference: `${transactionId}/source-${index}`,
              },
            ],
    };
  });
}

export function retrySyntheticSource(source: SourceEvidence, now = new Date()): SourceEvidence {
  return {
    ...source,
    outcome: 'found',
    reportedStatus: 'Completed example',
    stale: false,
    complete: true,
    attemptedAt: now.toISOString(),
    retrievedAt: now.toISOString(),
    events: source.events.length
      ? source.events
      : [
          {
            id: `${source.id}-recovered`,
            occurredAt: now.toISOString(),
            description: 'Synthetic report recovered on simulated retry',
            reference: `${source.lookupId}/simulated-retry/${source.id}`,
          },
        ],
  };
}
