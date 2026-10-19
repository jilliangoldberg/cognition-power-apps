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
});
