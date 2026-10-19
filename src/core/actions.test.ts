import { describe, expect, it } from 'vitest';
import { executeAction, type ActionRequest } from './actions';
import { createFixtures } from './fixtures';
import { modules } from '../modules';

const request: ActionRequest = {
  moduleId: 'kyc',
  recordId: 'KYC-1042',
  actionId: 'approve',
  expectedVersion: 1,
  reason: 'Evidence reviewed in synthetic demo.',
};

describe('shared demo action path', () => {
  it('records a KYC decision and its reason without mutating input or other modules', () => {
    const before = createFixtures();
    const now = new Date('2026-10-19T10:00:00Z');
    const after = executeAction(before, request, now);
    expect(after.records.kyc[0]).toMatchObject({
      status: 'Approved',
      version: 2,
      updatedAt: now.toISOString(),
    });
    expect(before.records.kyc[0].status).toBe('Needs review');
    expect(after.records.refunds).toBe(before.records.refunds);
    expect(after.records.flags).toBe(before.records.flags);
    expect(after.activity).toHaveLength(1);
    expect(after.activity[0]).toMatchObject({
      reason: request.reason,
      before: 'Needs review',
      after: 'Approved',
      moduleId: 'kyc',
      recordId: request.recordId,
    });
  });
  it('rejects stale versions and repeated submissions', () => {
    const next = executeAction(createFixtures(), request);
    expect(() => executeAction(next, request)).toThrow('record changed');
    expect(next.activity).toHaveLength(1);
  });
  it('rejects unknown records, unknown actions, invalid states, and unscoped record IDs', () => {
    const data = createFixtures();
    expect(() => executeAction(data, { ...request, recordId: 'missing' })).toThrow(
      'no longer exists',
    );
    expect(() => executeAction(data, { ...request, actionId: 'delete' })).toThrow(
      'no longer available',
    );
    expect(() => executeAction(data, { ...request, recordId: 'KYC-1037' })).toThrow(
      'no longer available',
    );
    expect(() => executeAction(data, { ...request, recordId: 'REF-0204' })).toThrow(
      'no longer exists',
    );
  });
  it.each(['', '    ', 'a', 'x'.repeat(501)])(
    'requires a bounded decision reason (%s)',
    (reason) => {
      expect(() => executeAction(createFixtures(), { ...request, reason })).toThrow(
        'between 5 and 500',
      );
    },
  );
  it('can escalate and subsequently resolve a KYC case', () => {
    const escalated = executeAction(createFixtures(), { ...request, actionId: 'escalate' });
    expect(escalated.records.kyc[0].status).toBe('Escalated');
    expect(() => executeAction(escalated, { ...request, expectedVersion: 2 })).toThrow(
      'no longer available',
    );
    const resumed = executeAction(escalated, {
      ...request,
      actionId: 'resume',
      expectedVersion: 2,
    });
    const rejected = executeAction(resumed, {
      ...request,
      actionId: 'reject',
      expectedVersion: 3,
    });
    expect(rejected.records.kyc[0].status).toBe('Rejected');
    expect(rejected.activity).toHaveLength(3);
  });
  it('simulates a refund without changing balances or calling an external service', () => {
    const data = createFixtures();
    const next = executeAction(data, {
      ...request,
      moduleId: 'refunds',
      recordId: 'REF-0203',
      actionId: 'simulate',
    });
    expect(next.records.refunds[1].status).toBe('Simulated');
    expect(next.records.refunds[1].fields).toEqual(data.records.refunds[1].fields);
    expect(next.records.kyc).toBe(data.records.kyc);
  });
  it('blocks refund requests above the remaining amount and fractional or nonpositive amounts', () => {
    for (const amount of [8000, -10, 0, 100.5]) {
      const data = createFixtures();
      data.records.refunds[1].fields.amountCents = amount;
      expect(() =>
        executeAction(data, {
          ...request,
          moduleId: 'refunds',
          recordId: 'REF-0203',
          actionId: 'simulate',
        }),
      ).toThrow('remaining refundable');
      expect(data.activity).toHaveLength(0);
    }
  });
  it('declines a refund without adding money movement', () => {
    const next = executeAction(createFixtures(), {
      ...request,
      moduleId: 'refunds',
      recordId: 'REF-0204',
      actionId: 'decline',
    });
    expect(next.records.refunds[0].status).toBe('Declined');
  });
  it('preserves context through information requests, notes, reassignment and return to review', () => {
    const initial = createFixtures();
    const waiting = executeAction(initial, {
      ...request,
      actionId: 'request-information',
      reason: 'Please supply dated evidence.',
    });
    expect(waiting.records.kyc[0].status).toBe('Waiting for information');
    for (const actionId of ['approve', 'reject', 'escalate', 'request-information']) {
      expect(() => executeAction(waiting, { ...request, expectedVersion: 2, actionId })).toThrow(
        'no longer available',
      );
    }
    const assigned = executeAction(waiting, {
      ...request,
      kind: 'assignment',
      owner: 'Jamie Brooks',
      expectedVersion: 2,
    });
    const noted = executeAction(assigned, {
      ...request,
      kind: 'note',
      expectedVersion: 3,
      reason: 'Fictional resubmission received.',
    });
    const resumed = executeAction(noted, { ...request, actionId: 'resume', expectedVersion: 4 });
    expect(resumed.records.kyc[0]).toMatchObject({
      status: 'Needs review',
      owner: 'Jamie Brooks',
      version: 5,
      openedAt: initial.records.kyc[0].openedAt,
    });
    expect(resumed.records.kyc[0].fields.summary).toBe(initial.records.kyc[0].fields.summary);
    expect(resumed.activity.map((event) => event.kind)).toEqual([
      'action',
      'note',
      'assignment',
      'action',
    ]);
    expect(resumed.activity[3].reason).toBe('Please supply dated evidence.');
    expect(resumed.activity[1].reason).toBe('Fictional resubmission received.');
    expect(executeAction(resumed, { ...request, expectedVersion: 5 }).records.kyc[0].status).toBe(
      'Approved',
    );
  });
  it.each(['kyc', 'refunds', 'flags'] as const)(
    'supports shared assignment and notes in %s without changing domain state',
    (moduleId) => {
      const initial = createFixtures();
      const record = initial.records[moduleId][0];
      const target = { ...request, moduleId, recordId: record.id };
      const assigned = executeAction(initial, {
        ...target,
        kind: 'assignment',
        owner: 'Unassigned',
      });
      const noted = executeAction(assigned, {
        ...target,
        kind: 'note',
        expectedVersion: 2,
        reason: '  Context for the next operator.  ',
      });
      expect(noted.records[moduleId][0]).toMatchObject({
        owner: 'Unassigned',
        status: record.status,
        version: 3,
        fields: record.fields,
      });
      expect(noted.activity[0]).toMatchObject({
        kind: 'note',
        reason: 'Context for the next operator.',
      });
      expect(noted.activity[1]).toMatchObject({
        kind: 'assignment',
        before: record.owner,
        after: 'Unassigned',
      });
      expect(initial.records[moduleId][0]).toBe(record);
      expect(initial.activity).toHaveLength(0);
    },
  );
  it('validates owners, note/reassignment reasons and stale versions on the shared path', () => {
    const initial = createFixtures();
    for (const owner of ['You', 'Unknown operator', ''])
      expect(() => executeAction(initial, { ...request, kind: 'assignment', owner })).toThrow(
        /owner/,
      );
    for (const reason of ['', '    ', 'abcd', 'x'.repeat(501)]) {
      expect(() => executeAction(initial, { ...request, kind: 'note', reason })).toThrow(
        'between 5 and 500',
      );
      expect(() =>
        executeAction(initial, { ...request, kind: 'assignment', owner: 'Alex Morgan', reason }),
      ).toThrow('between 5 and 500');
    }
    const next = executeAction(initial, { ...request, kind: 'note' });
    for (const kind of ['note', 'assignment'] as const)
      expect(() => executeAction(next, { ...request, kind, owner: 'Alex Morgan' })).toThrow(
        'record changed',
      );
    expect(next.activity).toHaveLength(1);
  });
  it('blocks simulation for shared payments and read-only provider/approval examples', () => {
    const initial = createFixtures();
    expect(() =>
      executeAction(initial, {
        ...request,
        moduleId: 'refunds',
        recordId: 'REF-0199',
        actionId: 'simulate',
      }),
    ).toThrow('Multiple requests share this payment');
    for (const recordId of ['REF-0198', 'REF-0196', 'REF-0195'])
      expect(() =>
        executeAction(initial, { ...request, moduleId: 'refunds', recordId, actionId: 'simulate' }),
      ).toThrow('no longer available');
    expect(initial.activity).toHaveLength(0);
    // Detect shared payment IDs from live demo state, not only premarked fixtures.
    initial.records.refunds[2].fields.paymentId = initial.records.refunds[0].fields.paymentId;
    expect(() =>
      executeAction(initial, {
        ...request,
        moduleId: 'refunds',
        recordId: 'REF-0204',
        actionId: 'simulate',
      }),
    ).toThrow('Multiple requests');
  });
  it('enables and disables a staging flag with separate recorded transitions', () => {
    const on = executeAction(createFixtures(), {
      ...request,
      moduleId: 'flags',
      recordId: 'FLG-002',
      actionId: 'enable',
    });
    expect(on.records.flags[1].status).toBe('Enabled');
    const off = executeAction(on, {
      ...request,
      moduleId: 'flags',
      recordId: 'FLG-002',
      actionId: 'disable',
      expectedVersion: 2,
    });
    expect(off.records.flags[1].status).toBe('Disabled');
    expect(off.activity).toHaveLength(2);
  });
});

describe('module declarations', () => {
  it('have unique IDs and valid fields, statuses, and action outputs for all fixtures', () => {
    expect(new Set(modules.map((module) => module.id)).size).toBe(modules.length);
    const data = createFixtures();
    for (const module of modules) {
      expect(new Set(module.actions.map((action) => action.id)).size).toBe(module.actions.length);
      for (const record of data.records[module.id]) {
        expect(module.validateFields(record)).toBe(true);
        expect(Object.hasOwn(module.statuses, record.status)).toBe(true);
        for (const action of module.actions.filter((action) => action.available(record))) {
          const result = action.apply(record);
          expect(Object.hasOwn(module.statuses, result.status)).toBe(true);
          expect(module.validateFields(result)).toBe(true);
          expect(result.id).toBe(record.id);
        }
      }
    }
  });
});
