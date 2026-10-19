import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtures } from './fixtures';
import { isDemoState, loadDemo, saveDemo, STORAGE_KEY } from './storage';

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
