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
    const rejected = executeAction(escalated, {
      ...request,
      actionId: 'reject',
      expectedVersion: 2,
    });
    expect(rejected.records.kyc[0].status).toBe('Rejected');
    expect(rejected.activity).toHaveLength(2);
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
