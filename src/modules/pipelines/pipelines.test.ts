import { describe, expect, it } from 'vitest';
import { executeAction, submitRecord } from '../../core/actions';
import { createFixtures } from '../../core/fixtures';
import { isDemoState } from '../../core/storage';
import { contractProblems } from '../contract';
import { createPipelineRequest, isDay, pipelines } from '.';

const now = new Date('2026-10-22T12:00:00Z');
const valid = {
  name: 'Weekly retention cohorts',
  requester: 'Ada Park',
  source: 'Warehouse: product.sessions',
  destination: 'Warehouse: analytics.cohorts',
  schedule: 'Weekly',
  neededBy: '2026-11-15',
  purpose: 'Cohort charts for the retention review.',
};
const records = pipelines.samples(now);

describe('pipeline request intake', () => {
  it('builds a Submitted, unassigned request with the next ID', () => {
    const record = createPipelineRequest(valid, records, now);
    expect(record).toMatchObject({
      id: 'DPR-108',
      name: 'Weekly retention cohorts',
      subtitle: 'Warehouse: product.sessions → Warehouse: analytics.cohorts',
      status: 'Submitted',
      owner: 'Unassigned',
    });
    expect(pipelines.validateFields(record)).toBe(true);
  });

  it('continues numbering past gaps and ignores non-DPR IDs', () => {
    const rows = [
      { ...records[0], id: 'DPR-140' },
      { ...records[1], id: 'OTHER-999' },
    ];
    expect(createPipelineRequest(valid, rows, now).id).toBe('DPR-141');
    expect(createPipelineRequest(valid, [], now).id).toBe('DPR-101');
  });

  it.each([
    ['blank name', { name: '  ' }, 'Pipeline name is required'],
    ['missing requester', { requester: undefined }, 'Your name is required'],
    ['too-long source', { source: 'x'.repeat(121) }, 'Source must be 120'],
    ['blank destination', { destination: '' }, 'Destination is required'],
    ['unknown schedule', { schedule: 'Every second' }, 'refresh schedule'],
    ['no schedule', { schedule: '' }, 'refresh schedule'],
    ['rollover date', { neededBy: '2026-02-30' }, 'YYYY-MM-DD'],
    ['month 13', { neededBy: '2026-13-01' }, 'YYYY-MM-DD'],
    ['non-ISO date', { neededBy: '11/15/2026' }, 'YYYY-MM-DD'],
    ['past date', { neededBy: '2026-10-21' }, 'in the past'],
    ['far-future date', { neededBy: '2029-01-01' }, 'within two years'],
    ['too-long purpose', { purpose: 'x'.repeat(501) }, 'Purpose must be 500'],
  ])('refuses %s', (_, change, message) => {
    const values = { ...valid, ...change } as Record<string, string>;
    expect(() => createPipelineRequest(values, records, now)).toThrow(message);
  });

  it('accepts today as the needed-by date and an empty purpose', () => {
    const record = createPipelineRequest(
      { ...valid, neededBy: '2026-10-22', purpose: '' },
      [],
      now,
    );
    expect(record.fields).toMatchObject({ neededBy: '2026-10-22', purpose: '' });
  });

  it('validates calendar days strictly', () => {
    expect(['2026-02-28', '2028-02-29'].every(isDay)).toBe(true);
    expect(['2026-02-29', '2026-1-01', '2026-10-22T00:00:00Z', 20261022].some(isDay)).toBe(false);
  });
});

describe('submitting through the shell', () => {
  it('adds the record first with one Activity entry and keeps saved data valid', () => {
    const state = createFixtures(now);
    const next = submitRecord(state, 'pipelines', valid, now);
    expect(next.records.pipelines).toHaveLength(state.records.pipelines.length + 1);
    expect(next.records.pipelines[0]).toMatchObject({
      id: 'DPR-108',
      version: 1,
      openedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    expect(next.activity[0]).toMatchObject({
      moduleId: 'pipelines',
      recordId: 'DPR-108',
      action: 'Submitted',
      after: 'Submitted',
    });
    expect(state.records.pipelines).toHaveLength(7);
    expect(isDemoState(next)).toBe(true);
  });

  it('ignores attempts to set id, owner, status or version through form values', () => {
    const values = {
      ...valid,
      id: 'DPR-101',
      owner: 'Platform',
      status: 'Delivered',
      version: '9',
    };
    const record = submitRecord(createFixtures(now), 'pipelines', values, now).records.pipelines[0];
    expect(record).toMatchObject({ id: 'DPR-108', owner: 'Unassigned', status: 'Submitted' });
    expect(record.version).toBe(1);
  });

  it('refuses tools without an intake form', () => {
    expect(() => submitRecord(createFixtures(now), 'kyc', valid, now)).toThrow(
      'does not accept new records',
    );
  });
});

describe('pipeline request workflow', () => {
  const act = (state: ReturnType<typeof createFixtures>, id: string, actionId: string) => {
    const record = state.records.pipelines.find((r) => r.id === id)!;
    return executeAction(
      state,
      {
        moduleId: 'pipelines',
        recordId: id,
        expectedVersion: record.version,
        actionId,
        reason: 'Fictional triage step.',
      },
      now,
    );
  };
  const status = (state: ReturnType<typeof createFixtures>, id: string) =>
    state.records.pipelines.find((r) => r.id === id)!.status;

  it('blocks starting an unassigned request until someone owns it', () => {
    let state = submitRecord(createFixtures(now), 'pipelines', valid, now);
    expect(() => act(state, 'DPR-108', 'start')).toThrow('Assign an owner');
    state = executeAction(
      state,
      {
        kind: 'assignment',
        moduleId: 'pipelines',
        recordId: 'DPR-108',
        expectedVersion: 1,
        owner: 'Data engineering',
        reason: 'Data engineering owns ingestion.',
      },
      now,
    );
    state = act(state, 'DPR-108', 'start');
    expect(status(state, 'DPR-108')).toBe('In progress');
    state = act(state, 'DPR-108', 'deliver');
    expect(status(state, 'DPR-108')).toBe('Delivered');
    expect(() => act(state, 'DPR-108', 'decline')).toThrow('no longer available');
  });

  it('round-trips through Needs info and can be declined from there', () => {
    let state = act(createFixtures(now), 'DPR-102', 'ask');
    expect(status(state, 'DPR-102')).toBe('Needs info');
    expect(() => act(state, 'DPR-102', 'start')).toThrow('no longer available');
    state = act(state, 'DPR-102', 'resume');
    expect(status(state, 'DPR-102')).toBe('Submitted');
    state = act(act(state, 'DPR-102', 'ask'), 'DPR-102', 'decline');
    expect(status(state, 'DPR-102')).toBe('Declined');
  });

  it('refuses malformed saved requests', () => {
    const base = records[0];
    for (const fields of [
      { ...base.fields, neededBy: '2026-02-30' },
      { ...base.fields, schedule: 'Sometimes' },
      { ...base.fields, source: 42 },
    ])
      expect(pipelines.validateFields({ ...base, fields })).toBe(false);
  });

  it('samples cover every status and pass the tool contract', () => {
    expect(new Set(records.map((r) => r.status))).toEqual(new Set(Object.keys(pipelines.statuses)));
    expect(contractProblems(pipelines, now)).toEqual([]);
  });
});
