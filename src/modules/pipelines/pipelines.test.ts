import { describe, expect, it } from 'vitest';
import { executeAction, submitRecord } from '../../core/actions';
import { createFixtures } from '../../core/fixtures';
import { buildIntakeRecord } from '../../core/intake';
import { contractProblems } from '../contract';
import { pipelines } from '.';

const now = new Date('2026-10-22T10:00:00Z');
const valid = {
  name: 'Daily churn features',
  requester: 'Priya Natarajan',
  source: 'Product events stream',
  destination: 'Analytics warehouse · ds_churn.features_daily',
  schedule: 'Daily',
  neededBy: '2026-11-05',
  purpose: 'Feature table for the churn model.',
};
const build = (change: Record<string, unknown> = {}, existing = pipelines.samples(now)) =>
  buildIntakeRecord(pipelines, { ...valid, ...change }, existing, now);

describe('pipeline requests', () => {
  it('samples cover every status and every action', () => {
    const statuses = new Set(pipelines.samples(now).map((r) => r.status));
    expect([...statuses].sort()).toEqual(Object.keys(pipelines.statuses).sort());
    expect(contractProblems(pipelines)).toEqual([]);
  });

  it('contract check reports a broken intake', () => {
    const intake = pipelines.intake!;
    const broken = {
      ...intake,
      idPrefix: 'dpr',
      example: { ...intake.example, schedule: 'Often' },
    };
    expect(contractProblems({ ...pipelines, intake: broken })).toEqual([
      'intake idPrefix must be 2-6 capital letters',
      'intake example is rejected: Choose one of the listed options for Refresh schedule.',
    ]);
  });

  it('turns a submission into an unassigned Submitted request with the next id', () => {
    const record = build({ name: '  Daily churn features  ' });
    expect(record).toMatchObject({
      id: 'DPR-108',
      name: 'Daily churn features',
      subtitle: 'Requested by Priya Natarajan',
      status: 'Submitted',
      owner: 'Unassigned',
      version: 1,
      openedAt: now.toISOString(),
    });
    expect(record.fields).toEqual({
      requester: 'Priya Natarajan',
      source: 'Product events stream',
      destination: 'Analytics warehouse · ds_churn.features_daily',
      schedule: 'Daily',
      neededBy: '2026-11-05',
      purpose: 'Feature table for the churn model.',
    });
    expect(build({}, []).id).toBe('DPR-001');
  });

  it.each([
    [{ name: '   ' }, 'Pipeline name is required.'],
    [{ source: undefined }, 'Source is required.'],
    [{ requester: 42 }, 'Your name is required.'],
    [{ destination: 'x'.repeat(201) }, 'Destination must be 200 characters or fewer.'],
    [{ purpose: 'x'.repeat(1001) }, 'What is it for? must be 1000 characters or fewer.'],
    [{ schedule: 'Every minute' }, 'Choose one of the listed options for Refresh schedule.'],
    [{ neededBy: '2026-02-30' }, 'Needed by must be a valid date.'],
    [{ neededBy: '11/05/2026' }, 'Needed by must be a valid date.'],
    [{ neededBy: '2026-10-21' }, 'Needed by must be today or later.'],
    [{ neededBy: '2029-01-01' }, 'Needed by must be within two years.'],
  ])('refuses %o', (change, message) => {
    expect(() => build(change)).toThrow(message);
  });

  it('ignores undeclared keys and cannot override id, owner or status', () => {
    const record = build({ id: 'DPR-101', owner: 'You', status: 'Delivered', extra: 'x' });
    expect(record).toMatchObject({ id: 'DPR-108', owner: 'Unassigned', status: 'Submitted' });
    expect(record.fields).not.toHaveProperty('extra');
  });

  it('never reuses an id after gaps or deletions', () => {
    const existing = [{ ...pipelines.samples(now)[0], id: 'DPR-950' }];
    expect(build({}, existing).id).toBe('DPR-951');
  });

  it('adds the request to the list with an activity entry', () => {
    const state = createFixtures(now);
    const next = submitRecord(state, 'pipelines', valid, now);
    expect(next.records.pipelines[0].id).toBe('DPR-108');
    expect(next.records.pipelines).toHaveLength(state.records.pipelines.length + 1);
    expect(state.records.pipelines).toHaveLength(7);
    expect(next.activity[0]).toMatchObject({
      moduleId: 'pipelines',
      recordId: 'DPR-108',
      action: 'Submit a request',
      before: 'New',
      after: 'Submitted',
    });
    expect(() => submitRecord(state, 'kyc', valid, now)).toThrow('does not accept submissions');
  });

  it('needs an owner before work starts, then moves through delivery', () => {
    let state = submitRecord(createFixtures(now), 'pipelines', valid, now);
    const act = (actionId: string, expectedVersion: number) =>
      (state = executeAction(state, {
        moduleId: 'pipelines',
        recordId: 'DPR-108',
        expectedVersion,
        actionId,
        reason: 'Fictional triage decision.',
      }));
    expect(() => act('start', 1)).toThrow('Assign Data engineering or Platform');
    state = executeAction(state, {
      kind: 'assignment',
      moduleId: 'pipelines',
      recordId: 'DPR-108',
      expectedVersion: 1,
      owner: 'Platform',
      reason: 'Platform owns the event stream.',
    });
    act('start', 2);
    act('deliver', 3);
    expect(state.records.pipelines[0].status).toBe('Delivered');
    expect(pipelines.actions.filter((a) => a.available(state.records.pipelines[0]))).toEqual([]);
  });

  it('refuses saved records with a missing or malformed field', () => {
    const [sample] = pipelines.samples(now);
    expect(pipelines.validateFields(sample)).toBe(true);
    for (const fields of [
      { ...sample.fields, neededBy: '2026-13-01' },
      { ...sample.fields, schedule: 'Sometimes' },
      { ...sample.fields, source: '' },
      { ...sample.fields, destination: 3 },
    ])
      expect(pipelines.validateFields({ ...sample, fields })).toBe(false);
  });
});
