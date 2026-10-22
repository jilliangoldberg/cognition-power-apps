import { describe, expect, it } from 'vitest';
import {
  canRetrySyntheticSource,
  investigationExamples,
  retrySyntheticSource,
  summarizeEvidence,
  syntheticEvidence,
} from './evidence';

const clock = new Date('2026-10-19T12:00:00Z');
const later = new Date('2026-10-19T12:10:00Z');

describe('synthetic Investigation evidence contract', () => {
  it.each(investigationExamples)(
    'returns independent source snapshots for $id ($label)',
    ({ id }) => {
      const first = syntheticEvidence(id, clock);
      const second = syntheticEvidence(id, clock);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first).toHaveLength(3);
      expect(new Set(first.map((source) => source.id)).size).toBe(3);
      for (const source of first) {
        expect(source.lookupId).toBe(id);
        expect(source.attemptedAt).toBe(clock.toISOString());
        expect(source.retryCount).toBe(0);
        for (const event of source.events) {
          expect(event.reference).toContain(`${id}/source-${source.id}`);
          expect(Date.parse(event.occurredAt)).toBeLessThanOrEqual(Date.parse(source.retrievedAt!));
        }
      }
      first[0].events.splice(0);
      expect(second).toEqual(syntheticEvidence(id, clock));
    },
  );

  it('keeps reference context and illustrative money attributed to the reporting source', () => {
    const sources = syntheticEvidence('TX-DEMO-001', clock);
    expect(sources[0]).toMatchObject({
      amountCents: 24995,
      relatedReferences: [
        { kind: 'Internal record', reference: 'TX-DEMO-001/record' },
        { kind: 'Account', reference: 'CUST-INV-001' },
        { kind: 'Counterparty', reference: 'CP-INV-001' },
      ],
    });
    expect(sources[1].amountCents).toBeUndefined();
    expect(sources[1].relatedReferences).toHaveLength(1);
  });

  it.each(['TX-DEMO-005', 'unknown'])('never creates evidence or context for no match %s', (id) => {
    for (const source of syntheticEvidence(id, clock)) {
      expect(source).toMatchObject({ outcome: 'not-found', events: [], relatedReferences: [] });
      expect(source.reportedStatus).toBeUndefined();
      expect(source.amountCents).toBeUndefined();
      expect(canRetrySyntheticSource(source)).toBe(false);
      expect(retrySyntheticSource(source, later)).toBe(source);
    }
  });

  it('recovers only the unavailable source, without making retry time an event time', () => {
    const sources = syntheticEvidence('TX-DEMO-003', clock);
    const before = structuredClone(sources);
    expect(sources[2]).toMatchObject({
      outcome: 'unavailable',
      events: [],
      relatedReferences: [],
    });
    expect(sources[2].retrievedAt).toBeUndefined();
    const retried = sources.map((source) =>
      source.id === '2' ? retrySyntheticSource(source, later) : source,
    );
    expect(sources).toEqual(before);
    expect(retried[0]).toBe(sources[0]);
    expect(retried[1]).toBe(sources[1]);
    expect(retried[2]).toMatchObject({
      outcome: 'found',
      retrievedAt: later.toISOString(),
      attemptedAt: later.toISOString(),
      retryCount: 1,
      complete: true,
    });
    expect(retried[2].events[0].occurredAt).toBe('2026-10-19T10:30:00.000Z');
    expect(canRetrySyntheticSource(retried[2])).toBe(false);
  });

  it('refreshes stale retrieval metadata without rewriting source events or status', () => {
    const source = syntheticEvidence('TX-DEMO-004', clock)[2];
    expect(source.retrievedAt).toBe('2026-10-19T10:30:00.000Z');
    const result = retrySyntheticSource(source, later);
    expect(result.events).toBe(source.events);
    expect(result.reportedStatus).toBe(source.reportedStatus);
    expect(result.stale).toBe(false);
    expect(result.retrievedAt).toBe(later.toISOString());
    expect(source.stale).toBe(true);
  });

  it('recovers omitted fixture detail but never normalizes a conflicting status', () => {
    const incomplete = syntheticEvidence('TX-DEMO-006', clock)[1];
    const result = retrySyntheticSource({ ...incomplete, reportedStatus: 'Pending review' }, later);
    expect(result.complete).toBe(true);
    expect(result.reportedStatus).toBe('Pending review');
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toBe(incomplete.events[0]);
    expect(result.events[1].occurredAt).toBe('2026-10-19T10:20:00.000Z');
    const conflicting = syntheticEvidence('TX-DEMO-002', clock)[2];
    expect(canRetrySyntheticSource(conflicting)).toBe(false);
    expect(retrySyntheticSource(conflicting, later)).toBe(conflicting);
    expect(conflicting.reportedStatus).toBe('Pending review');
  });

  it.each([
    ['TX-DEMO-001', 'green', 'All 3 systems agree: Completed'],
    ['TX-DEMO-002', 'red', 'Systems disagree'],
    ['TX-DEMO-003', 'amber', 'Bank settlement didn’t respond'],
    ['TX-DEMO-004', 'amber', 'Bank settlement data is out of date'],
    ['TX-DEMO-005', 'neutral', 'No system has a record of this transaction'],
    ['TX-DEMO-006', 'amber', 'Payment processor returned partial data'],
    ['unknown', 'neutral', 'No system has a record of this transaction'],
  ])('summarizes %s as a %s verdict', (id, tone, headline) => {
    expect(summarizeEvidence(syntheticEvidence(id, clock))).toMatchObject({ tone, headline });
  });

  it('prefers disagreement over degraded sources and never reports agreement while one is down', () => {
    const [ledger, processor, bank] = syntheticEvidence('TX-DEMO-002', clock);
    const disagreeAndStale = [ledger, processor, { ...bank, stale: true }];
    expect(summarizeEvidence(disagreeAndStale).tone).toBe('red');
    const down = syntheticEvidence('TX-DEMO-003', clock);
    expect(summarizeEvidence(down).headline).not.toMatch(/agree/);
    const allDown = down.map((source) => ({
      ...source,
      outcome: 'unavailable' as const,
      reportedStatus: undefined,
    }));
    expect(summarizeEvidence(allDown)).toMatchObject({ tone: 'amber' });
    expect(summarizeEvidence(allDown).nextStep).toMatch(/^The result isn’t confirmed/);
  });
});
