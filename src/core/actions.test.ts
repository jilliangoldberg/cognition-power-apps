import { describe, expect, it } from 'vitest';
import { executeAction, type ActionRequest } from './actions';
import { createFixtures } from './fixtures';
import { modules } from '../modules';
import { kyc } from '../modules/kyc';

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
    const approved = executeAction(data, {
      ...request,
      moduleId: 'refunds',
      recordId: 'REF-0203',
      actionId: 'approve-refund',
    });
    expect(approved.records.refunds[1].status).toBe('Approved for simulation');
    const next = executeAction(approved, {
      ...request,
      moduleId: 'refunds',
      recordId: 'REF-0203',
      expectedVersion: 2,
      actionId: 'simulate',
    });
    expect(next.records.refunds[1].status).toBe('Simulated');
    for (const field of ['amountCents', 'paymentCents', 'refundedCents'])
      expect(next.records.refunds[1].fields[field]).toEqual(data.records.refunds[1].fields[field]);
    expect(next.activity).toHaveLength(2);
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
          actionId: 'approve-refund',
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
    expect(() => executeAction(resumed, { ...request, expectedVersion: 5 })).toThrow(
      'Assess the evidence before approving',
    );
    const assessed = executeAction(resumed, {
      ...request,
      expectedVersion: 5,
      actionId: 'review-evidence',
    });
    expect(executeAction(assessed, { ...request, expectedVersion: 6 }).records.kyc[0].status).toBe(
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
        actionId: 'approve-refund',
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
        actionId: 'approve-refund',
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

describe('narrow browser-local workflow stories', () => {
  it('keeps missing evidence, an unsent request, fictional response, handoff and decision distinct', () => {
    const initial = createFixtures();
    const target = { ...request, recordId: 'KYC-1041' };
    expect(() => executeAction(initial, target)).toThrow('Assess the evidence before approving');
    expect(() => executeAction(initial, { ...target, actionId: 'review-evidence' })).toThrow(
      'log a customer response',
    );
    const waiting = executeAction(initial, {
      ...target,
      actionId: 'request-information',
      reason: 'Need an issue date on the fictional address evidence.',
    });
    expect(waiting.records.kyc[1].fields).toMatchObject({
      informationRequest: 'Need an issue date on the fictional address evidence.',
      communicationState: 'Unsent · no customer messaging integration',
      responseRecorded: false,
      evidenceReviewed: false,
    });
    const assigned = executeAction(waiting, {
      ...target,
      kind: 'assignment',
      owner: 'Jamie Brooks',
      expectedVersion: 2,
    });
    const response = executeAction(assigned, {
      ...target,
      actionId: 'record-address-response',
      expectedVersion: 3,
      reason: 'Fictional replacement shows the missing date.',
    });
    expect(response.records.kyc[1].status).toBe('Waiting for information');
    expect(response.records.kyc[1].fields.communicationState).toContain('Unsent');
    const resumed = executeAction(response, {
      ...target,
      actionId: 'resume',
      expectedVersion: 4,
      reason: 'Handing back to Jamie for assessment, not automatic approval.',
    });
    expect(() => executeAction(resumed, { ...target, expectedVersion: 5 })).toThrow('Assess');
    const reviewed = executeAction(resumed, {
      ...target,
      actionId: 'review-evidence',
      expectedVersion: 5,
      reason: 'Fictional replacement resolves the missing-date checklist item.',
    });
    const decided = executeAction(reviewed, {
      ...target,
      expectedVersion: 6,
      reason: 'Approve this synthetic case after the separate assessment.',
    });
    expect(decided.records.kyc[1]).toMatchObject({
      status: 'Approved',
      owner: 'Jamie Brooks',
      version: 7,
    });
    expect(decided.records.kyc[1].fields).toMatchObject({
      decisionContext: 'Approve this synthetic case after the separate assessment.',
      responseRecorded: true,
      evidenceReviewed: true,
      addressEvidence: 'Resolved · was: Missing issue date',
    });
    const address = kyc
      .localDetails!.flatMap((section) => section.fields)
      .find((detail) => detail.label === 'Proof of address')!;
    expect(address.value(decided.records.kyc[1])).toContain('Replacement accepted');
    expect(address.badge!(decided.records.kyc[1])).toEqual({ label: 'Resolved', tone: 'green' });
    expect(decided.activity).toHaveLength(6);
    expect(initial.records.kyc[1].status).toBe('Needs review');
  });

  it('blocks approval while a checklist gap remains, even if saved data claims an assessment', () => {
    const tampered = createFixtures();
    tampered.records.kyc[1].fields.evidenceReviewed = true;
    expect(tampered.records.kyc[1].id).toBe('KYC-1041');
    expect(() => executeAction(tampered, { ...request, recordId: 'KYC-1041' })).toThrow(
      'Assess the evidence before approving',
    );
  });

  it('requires a separate response for every evidence gap before assessment and approval', () => {
    const initial = createFixtures();
    initial.records.kyc[1].fields.identityEvidence = 'Missing fictional identity field';
    const target = { ...request, recordId: 'KYC-1041' };
    const waiting = executeAction(initial, { ...target, actionId: 'request-information' });
    expect(() =>
      executeAction(waiting, { ...target, actionId: 'record-response', expectedVersion: 2 }),
    ).toThrow();
    const address = executeAction(waiting, {
      ...target,
      actionId: 'record-address-response',
      expectedVersion: 2,
      reason: 'Fictional replacement shows the address date only.',
    });
    expect(() =>
      executeAction(address, {
        ...target,
        actionId: 'record-address-response',
        expectedVersion: 3,
      }),
    ).toThrow();
    const resumed = executeAction(address, { ...target, actionId: 'resume', expectedVersion: 3 });
    expect(() =>
      executeAction(resumed, { ...target, actionId: 'review-evidence', expectedVersion: 4 }),
    ).toThrow('open check first: identity.');
    expect(() => executeAction(resumed, { ...target, expectedVersion: 4 })).toThrow('Assess');
    const again = executeAction(resumed, {
      ...target,
      actionId: 'request-information',
      expectedVersion: 4,
    });
    expect(again.records.kyc[1].fields.respondedEvidence).toBe('');
    let data = again;
    for (const [index, actionId] of [
      'record-identity-response',
      'record-address-response',
      'resume',
      'review-evidence',
      'approve',
    ].entries())
      data = executeAction(data, { ...target, actionId, expectedVersion: 5 + index });
    expect(data.records.kyc[1].status).toBe('Approved');
    expect(data.records.kyc[1].fields).toMatchObject({
      identityEvidence: 'Resolved · was: Missing required field',
      addressEvidence: 'Resolved · was: Missing issue date',
    });
    expect(String(data.records.kyc[1].fields.responseContext)).toMatch(/^Identity: .* · Address: /);
  });

  it('does not infer response receipt from resume or carry an old response into a new request', () => {
    const target = { ...request, recordId: 'KYC-1039' };
    const waiting = executeAction(createFixtures(), { ...target, actionId: 'request-information' });
    const resumed = executeAction(waiting, { ...target, actionId: 'resume', expectedVersion: 2 });
    expect(resumed.records.kyc[3].fields.responseRecorded).toBe(false);
    expect(() =>
      executeAction(resumed, { ...target, actionId: 'review-evidence', expectedVersion: 3 }),
    ).toThrow('log a customer response');
    const requested = executeAction(resumed, {
      ...target,
      actionId: 'request-information',
      expectedVersion: 3,
    });
    const response = executeAction(requested, {
      ...target,
      actionId: 'record-identity-response',
      expectedVersion: 4,
    });
    const returned = executeAction(response, { ...target, actionId: 'resume', expectedVersion: 5 });
    const secondRequest = executeAction(returned, {
      ...target,
      actionId: 'request-information',
      expectedVersion: 6,
    });
    expect(secondRequest.records.kyc[3].fields.responseRecorded).toBe(false);
    expect(secondRequest.records.kyc[3].fields.responseContext).toBe('');
    expect(secondRequest.activity.some((event) => event.action === 'Log identity response')).toBe(
      true,
    );
  });

  it('cannot simulate a requested refund directly or confuse approval with an execution', () => {
    const target = { ...request, moduleId: 'refunds' as const, recordId: 'REF-0204' };
    const initial = createFixtures();
    expect(() => executeAction(initial, { ...target, actionId: 'simulate' })).toThrow(
      'no longer available',
    );
    const approved = executeAction(initial, { ...target, actionId: 'approve-refund' });
    expect(approved.records.refunds[0]).toMatchObject({
      status: 'Approved for simulation',
      version: 2,
    });
    expect(approved.records.refunds[0].fields.refundedCents).toBe(0);
    const declined = executeAction(approved, {
      ...target,
      actionId: 'decline',
      expectedVersion: 2,
    });
    expect(() =>
      executeAction(declined, { ...target, actionId: 'simulate', expectedVersion: 3 }),
    ).toThrow('no longer available');
    expect(declined.records.refunds[0].fields.refundedCents).toBe(0);
  });

  it('checks current payment siblings again between approval and simulation, not only fixture hints', () => {
    const target = { ...request, moduleId: 'refunds' as const, recordId: 'REF-0204' };
    const approved = executeAction(createFixtures(), { ...target, actionId: 'approve-refund' });
    approved.records.refunds[1].fields.paymentId = approved.records.refunds[0].fields.paymentId;
    expect(approved.records.refunds[0].fields.sharedPaymentContext).toBe(false);
    expect(() =>
      executeAction(approved, { ...target, actionId: 'simulate', expectedVersion: 2 }),
    ).toThrow('Multiple requests');
    expect(approved.activity).toHaveLength(1);
    expect(approved.records.refunds[0].version).toBe(2);
    approved.records.refunds[1].fields.paymentId = 'PAY-8088';
    approved.records.refunds[0].fields.refundedCents = 11900;
    expect(() =>
      executeAction(approved, { ...target, actionId: 'simulate', expectedVersion: 2 }),
    ).toThrow('remaining refundable');
  });

  it.each([
    ['amountCents', '4900'],
    ['amountCents', Number.MAX_SAFE_INTEGER + 1],
    ['paymentCents', -1],
    ['paymentCents', 12000.5],
    ['paymentCents', Infinity],
    ['refundedCents', 12001],
    ['refundedCents', NaN],
    ['refundedCents', '0'],
  ])('rejects malformed current minor units for %s = %s before any simulation', (field, value) => {
    const target = { ...request, moduleId: 'refunds' as const, recordId: 'REF-0204' };
    const approved = executeAction(createFixtures(), { ...target, actionId: 'approve-refund' });
    approved.records.refunds[0].fields[field] = value;
    expect(() =>
      executeAction(approved, { ...target, actionId: 'simulate', expectedVersion: 2 }),
    ).toThrow('remaining refundable');
    expect(approved.activity).toHaveLength(1);
  });

  it('restores a captured desired flag configuration as a new version and retains both changes', () => {
    const target = { ...request, moduleId: 'flags' as const, recordId: 'FLG-002' };
    const initial = createFixtures();
    expect(() => executeAction(initial, { ...target, actionId: 'restore' })).toThrow(
      'no longer available',
    );
    const enabled = executeAction(initial, { ...target, actionId: 'enable' });
    expect(enabled.records.flags[1].fields.previousStatus).toBe('Disabled');
    enabled.records.flags[1].fields.audience = 'Another fictional cohort';
    const restored = executeAction(enabled, {
      ...target,
      actionId: 'restore',
      expectedVersion: 2,
      reason: 'Restore the previous staging-only desired configuration.',
    });
    expect(restored.records.flags[1]).toMatchObject({ status: 'Disabled', version: 3 });
    expect(restored.records.flags[1].fields).toMatchObject({
      audience: initial.records.flags[1].fields.audience,
      previousStatus: 'Enabled',
      previousAudience: 'Another fictional cohort',
    });
    expect(restored.activity).toHaveLength(2);
    expect(restored.activity[0]).toMatchObject({
      action: 'Restore prior configuration',
      before: expect.stringContaining('Another fictional cohort'),
      after: expect.stringContaining('desired Disabled'),
    });
    expect(restored.activity[1].before).toContain('desired Disabled');
  });

  it.each(['Production', 'Development', 'staging', ''])(
    'rejects enable, disable and restore outside exact Staging (%s)',
    (environment) => {
      for (const actionId of ['enable', 'disable', 'restore']) {
        const state = createFixtures();
        const record = state.records.flags[1];
        record.status = actionId === 'disable' || actionId === 'restore' ? 'Enabled' : 'Disabled';
        record.fields.previousStatus = 'Disabled';
        record.fields.previousAudience = 'Payments QA accounts';
        record.fields.environment = environment;
        expect(() =>
          executeAction(state, { ...request, moduleId: 'flags', recordId: record.id, actionId }),
        ).toThrow('Only Staging flags');
        expect(state.activity).toEqual([]);
      }
    },
  );
});
