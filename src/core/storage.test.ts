import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtures } from './fixtures';
import { isDemoState, loadDemo, saveDemo, STORAGE_KEY } from './storage';
import { executeAction } from './actions';

beforeEach(() => localStorage.clear());

describe('versioned local demo data', () => {
  it('starts with valid synthetic fixtures', () => {
    const loaded = loadDemo();
    expect(loaded.warning).toBe('');
    expect(loaded.blocked).toBe(false);
    expect(isDemoState(loaded.data)).toBe(true);
  });
  it('persists a round trip including local events', () => {
    const data = createFixtures();
    data.records.kyc[0].status = 'Approved';
    expect(saveDemo(data)).toBe(true);
    expect(loadDemo().data).toEqual(data);
  });
  it.each(['not json', JSON.stringify({ schemaVersion: 99 }), 'null'])(
    'preserves unreadable stored data instead of overwriting it',
    (raw) => {
      localStorage.setItem(STORAGE_KEY, raw);
      const result = loadDemo();
      expect(result.blocked).toBe(true);
      expect(result.warning).toContain('without overwriting');
      expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    },
  );
  it('rejects invalid record structure, duplicate IDs, and unknown statuses', () => {
    const duplicate = createFixtures();
    duplicate.records.kyc.push(duplicate.records.kyc[0]);
    expect(isDemoState(duplicate)).toBe(false);
    const unknown = createFixtures();
    unknown.records.flags[0].status = 'Production';
    expect(isDemoState(unknown)).toBe(false);
    const invalid = createFixtures();
    invalid.records.refunds[0].fields.amountCents = 'not money';
    expect(isDemoState(invalid)).toBe(false);
  });
  it('adds sample records for a newly registered tool without touching saved work', () => {
    const saved = createFixtures();
    saved.records.kyc[0].status = 'Approved';
    saved.records.kyc[0].version = 3;
    const { flags, ...withoutFlags } = saved.records;
    const raw = JSON.stringify({ ...saved, records: withoutFlags });
    localStorage.setItem(STORAGE_KEY, raw);
    const result = loadDemo();
    expect(result.blocked).toBe(false);
    expect(result.warning).toContain('Added sample records for new tools: Feature flags');
    expect(result.data.records.kyc).toEqual(saved.records.kyc);
    expect(result.data.records.flags.map((record) => record.id)).toEqual(flags.map((r) => r.id));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('still refuses saved data whose existing tool records are invalid', () => {
    const saved = createFixtures();
    saved.records.flags[0].status = 'Production';
    const partial: Record<string, unknown> = { ...saved.records };
    delete partial.kyc;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, records: partial }));
    expect(loadDemo().blocked).toBe(true);
  });
  it.each(['', 'A'.repeat(501), 'KYC-\ud800'])(
    'rejects saved record IDs that a record link cannot open (length %#)',
    (id) => {
      const data = createFixtures();
      data.records.kyc[0].id = id;
      expect(isDemoState(data)).toBe(false);
      data.records.kyc[0].id = 'A'.repeat(500);
      expect(isDemoState(data)).toBe(true);
    },
  );
  it('rejects malformed activity entries', () => {
    const data = { ...createFixtures(), activity: [{ id: 'bad', moduleId: 'unknown' }] };
    expect(isDemoState(data)).toBe(false);
  });
  it('migrates v1 work without replacing records, decisions, fields, versions or event IDs', () => {
    const original = createFixtures();
    original.records.kyc = original.records.kyc.slice(0, 8);
    original.records.refunds = original.records.refunds.slice(0, 5);
    original.records.flags = original.records.flags.slice(0, 5);
    for (const rows of Object.values(original.records))
      for (const record of rows) delete record.openedAt;
    original.records.kyc[0].status = 'Approved';
    original.records.kyc[0].version = 4;
    const event = {
      id: 'legacy-event',
      moduleId: 'kyc',
      recordId: 'KYC-1042',
      recordName: 'Olivia Chen',
      action: 'Approve case',
      reason: 'Previous browser work.',
      before: 'Needs review',
      after: 'Approved',
      at: new Date().toISOString(),
    };
    const legacy = { ...original, schemaVersion: 1, activity: [event] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const loaded = loadDemo();
    expect(loaded.blocked).toBe(false);
    expect(loaded.warning).toContain('Saved work preserved');
    expect(loaded.data.records).toEqual(original.records);
    expect(loaded.data.activity).toEqual([{ ...event, kind: 'action' }]);
    expect(loaded.data.records.kyc[0].openedAt).toBeUndefined();
    expect(saveDemo(loaded.data)).toBe(true);
    expect(loadDemo().data).toEqual(loaded.data);
  });
  it('persists notes and assignments together without inventing an opened date for legacy rows', () => {
    const data = createFixtures();
    delete data.records.kyc[0].openedAt;
    const target = {
      moduleId: 'kyc' as const,
      recordId: 'KYC-1042',
      expectedVersion: 1,
      reason: 'A fictional handoff.',
    };
    const assigned = executeAction(data, { ...target, kind: 'assignment', owner: 'Jamie Brooks' });
    const noted = executeAction(assigned, { ...target, kind: 'note', expectedVersion: 2 });
    expect(saveDemo(noted)).toBe(true);
    expect(loadDemo().data).toEqual(noted);
    expect(isDemoState(noted)).toBe(true);
  });
  it('rejects invalid opened dates, event kinds and malformed legacy content without overwriting', () => {
    const data = createFixtures();
    data.records.kyc[0].openedAt = 'not a date';
    expect(isDemoState(data)).toBe(false);
    const invalidEvent = { ...createFixtures(), activity: [{ id: 'bad', kind: 'external' }] };
    expect(isDemoState(invalidEvent)).toBe(false);
    const raw = JSON.stringify({ ...data, schemaVersion: 1 });
    localStorage.setItem(STORAGE_KEY, raw);
    expect(loadDemo().blocked).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('reports storage access and quota errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadDemo().blocked).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(saveDemo(createFixtures())).toBe(false);
  });

  it.each([1, 2])(
    'adds conservative workflow defaults to actual older v%s shapes without inventing outcomes',
    (schemaVersion) => {
      const data = createFixtures();
      const baseFields = {
        kyc: [
          'customerId',
          'country',
          'accountType',
          'risk',
          'reviewReason',
          'summary',
          'nextStep',
        ],
        refunds: [
          'customerId',
          'paymentId',
          'amountCents',
          'paymentCents',
          'refundedCents',
          'reason',
          'paymentAt',
          'summary',
        ],
        flags: ['environment', 'audience', 'description'],
      };
      for (const tool of ['kyc', 'refunds', 'flags'] as const)
        for (const record of data.records[tool])
          record.fields = Object.fromEntries(
            Object.entries(record.fields).filter(([key]) => baseFields[tool].includes(key)),
          );
      data.records.kyc[0].version = 8;
      data.records.kyc[0].status = 'Approved';
      data.records.kyc[0].fields.summary = 'Preserve a user-edited summary.';
      data.records.flags[0].status = 'Disabled';
      localStorage.setItem('unrelated', 'untouched');
      const raw = JSON.stringify({ ...data, schemaVersion });
      localStorage.setItem(STORAGE_KEY, raw);
      const loaded = loadDemo();
      expect(loaded.blocked).toBe(false);
      expect(loaded.data.records.kyc[0]).toMatchObject({
        version: 8,
        status: 'Approved',
        fields: {
          summary: 'Preserve a user-edited summary.',
          evidenceReviewed: false,
          responseRecorded: false,
          identityEvidence: 'Not recorded in saved demo',
        },
      });
      expect(loaded.data.records.kyc).toHaveLength(data.records.kyc.length);
      expect(loaded.data.records.refunds[0].fields.relatedRequests).toContain(
        'No related-request snapshot recorded',
      );
      expect(loaded.data.records.flags[0]).toMatchObject({
        status: 'Disabled',
        fields: { previousStatus: '', previousAudience: '' },
      });
      expect(loaded.data.activity).toEqual([]);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
      expect(localStorage.getItem('unrelated')).toBe('untouched');
      expect(saveDemo(loaded.data)).toBe(true);
      expect(loadDemo().data).toEqual(loaded.data);
    },
  );

  it.each(['Waiting for information', 'Needs review'])(
    'attributes a response saved before per-gap tracking to the single open gap (%s)',
    (status) => {
      const data = createFixtures();
      const record = data.records.kyc[1];
      record.status = status;
      record.fields.responseRecorded = true;
      record.fields.responseContext = 'Saved fictional address replacement.';
      delete record.fields.respondedEvidence;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      const loaded = loadDemo().data;
      expect(loaded.records.kyc[1].fields).toMatchObject({
        respondedEvidence: 'addressEvidence',
        responseContext: 'Saved fictional address replacement.',
      });
      const target = { moduleId: 'kyc' as const, recordId: 'KYC-1041', reason: 'Context.' };
      const review =
        status === 'Needs review'
          ? loaded
          : executeAction(loaded, { ...target, actionId: 'resume', expectedVersion: 1 });
      const version = review.records.kyc[1].version;
      const assessed = executeAction(review, {
        ...target,
        actionId: 'review-evidence',
        expectedVersion: version,
      });
      expect(assessed.records.kyc[1].fields.addressEvidence).toContain('Fictional replacement');
    },
  );

  it('keeps an unattributable saved response but still asks for a response per open gap', () => {
    const data = createFixtures();
    const record = data.records.kyc[1];
    record.fields.identityEvidence = 'Missing fictional identity field';
    record.fields.responseRecorded = true;
    record.fields.responseContext = 'Saved fictional replacement.';
    delete record.fields.respondedEvidence;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const loaded = loadDemo().data;
    expect(loaded.records.kyc[1].fields).toMatchObject({
      respondedEvidence: '',
      responseContext: 'Saved fictional replacement.',
    });
    expect(() =>
      executeAction(loaded, {
        moduleId: 'kyc',
        recordId: 'KYC-1041',
        reason: 'Context.',
        actionId: 'review-evidence',
        expectedVersion: 1,
      }),
    ).toThrow('before assessing: identity, address.');
  });

  it('round-trips response context, decision, assignment and note without losing local history', () => {
    let data = createFixtures();
    const target = {
      moduleId: 'kyc' as const,
      recordId: 'KYC-1041',
      reason: 'Fictional operational context.',
    };
    for (const [index, change] of [
      { actionId: 'request-information' },
      { kind: 'assignment' as const, owner: 'Jamie Brooks' },
      { actionId: 'record-address-response' },
      { kind: 'note' as const },
      { actionId: 'resume' },
      { actionId: 'review-evidence' },
      { actionId: 'approve' },
    ].entries())
      data = executeAction(data, { ...target, ...change, expectedVersion: index + 1 });
    expect(saveDemo(data)).toBe(true);
    const loaded = loadDemo();
    expect(loaded.data).toEqual(data);
    expect(loaded.data.records.kyc[1]).toMatchObject({
      owner: 'Jamie Brooks',
      status: 'Approved',
      version: 8,
    });
    expect(loaded.data.activity.map((event) => event.kind)).toContain('note');
    expect(loaded.data.activity.map((event) => event.kind)).toContain('assignment');
  });

  it.each(['kyc', 'refunds', 'flags'] as const)(
    'blocks newer per-tool workflow data in %s without resetting saved work',
    (tool) => {
      const data = createFixtures();
      data.records[tool][0].fields.workflowVersion = 99;
      const raw = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, raw);
      expect(loadDemo().blocked).toBe(true);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    },
  );

  it('rejects malformed optional workflow fields and nested data instead of silently defaulting them', () => {
    const cases = [
      ['kyc', 'evidenceReviewed', 'yes'],
      ['kyc', 'informationRequest', 42],
      ['refunds', 'sharedPaymentContext', 'false'],
      ['flags', 'previousStatus', 'Production'],
      ['flags', 'previousAudience', 42],
    ] as const;
    for (const [tool, field, value] of cases) {
      const data = createFixtures();
      data.records[tool][0].fields[field] = value;
      expect(isDemoState(data)).toBe(false);
    }
    const nested = createFixtures();
    Object.assign(nested.records.kyc[0].fields, { checklist: { status: 'missing' } });
    expect(isDemoState(nested)).toBe(false);
  });
});
