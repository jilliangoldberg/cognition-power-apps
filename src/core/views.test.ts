import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kyc } from '../modules/kyc';
import { refunds } from '../modules/refunds';
import { createFixtures } from './fixtures';
import { ageLabel } from './format';
import { isDemoState } from './storage';
import type { ToolRecord } from './types';
import { defaultFilters, filterRecords, loadViews, saveViews, viewsKey } from './views';

const now = new Date('2026-10-19T12:00:00Z');
beforeEach(() => localStorage.clear());

describe('curated operational sample', () => {
  it('has varied dates, valid fields, stable cross-tool IDs and consistent payment examples', () => {
    const data = createFixtures(now);
    expect(isDemoState(data)).toBe(true);
    expect(data.records.kyc).toHaveLength(14);
    expect(data.records.refunds).toHaveLength(10);
    expect(data.records.flags).toHaveLength(7);
    expect(data.activity).toEqual([]);
    for (const records of Object.values(data.records)) {
      expect(new Set(records.map((record) => record.updatedAt)).size).toBeGreaterThan(3);
      for (const record of records) {
        expect(Date.parse(record.openedAt!)).toBeLessThan(Date.parse(record.updatedAt));
        expect(Date.parse(record.updatedAt)).toBeLessThanOrEqual(now.getTime());
      }
    }
    const customers = new Map(
      data.records.kyc.map((record) => [record.fields.customerId, record.name]),
    );
    for (const request of data.records.refunds) {
      expect(customers.get(request.fields.customerId)).toBe(request.name);
      expect(Number(request.fields.amountCents)).toBeGreaterThan(0);
      expect(Number(request.fields.amountCents)).toBeLessThanOrEqual(
        Number(request.fields.paymentCents) - Number(request.fields.refundedCents),
      );
      expect(Date.parse(String(request.fields.paymentAt))).toBeLessThan(
        Date.parse(request.openedAt!),
      );
    }
    const related = data.records.refunds.filter((record) => record.fields.paymentId === 'PAY-8069');
    expect(related).toHaveLength(2);
    expect(related[0].fields.paymentCents).toBe(related[1].fields.paymentCents);
    expect(related[0].fields.customerId).toBe(related[1].fields.customerId);
    expect(related[0].fields.paymentAt).toBe(related[1].fields.paymentAt);
    expect(data.records.flags.every((record) => record.fields.environment === 'Staging')).toBe(
      true,
    );
  });
});

describe('shared local queue views', () => {
  it.each([
    { amountCents: 4900, formatted: '$49.00' },
    { amountCents: 24995, formatted: '$249.95' },
    { amountCents: 75000, formatted: '$750.00' },
    { amountCents: 125000, formatted: '$1,250.00' },
  ])('finds displayed amount $formatted as well as raw cents', ({ amountCents, formatted }) => {
    const sample = createFixtures(now).records.refunds[0];
    const record: ToolRecord = {
      ...sample,
      fields: { ...sample.fields, amountCents, paymentCents: amountCents * 2, refundedCents: 0 },
    };
    expect(refunds.secondaryValue(record)).toBe(formatted);
    for (const search of [formatted, formatted.slice(1), ` ${formatted} `, String(amountCents)]) {
      expect(filterRecords([record], refunds, { ...defaultFilters, search }, now)).toEqual([
        record,
      ]);
    }
    expect(filterRecords([record], refunds, { ...defaultFilters, search: '$0.01' }, now)).toEqual(
      [],
    );
    expect(
      filterRecords(
        [record],
        refunds,
        { ...defaultFilters, search: formatted, owner: 'Not this owner' },
        now,
      ),
    ).toEqual([]);
  });
  it('combines owner, status, search and sorting without mutating records', () => {
    const records = createFixtures(now).records.kyc;
    const originalIds = records.map((record) => record.id);
    const visible = filterRecords(
      records,
      kyc,
      { ...defaultFilters, owner: 'You', status: 'Needs review', search: 'CUS-1042' },
      now,
    );
    expect(visible.map((record) => record.id)).toEqual(['KYC-1042']);
    expect(
      filterRecords(records, kyc, { ...defaultFilters, owner: 'Unassigned' }, now).every(
        (record) => record.owner === 'Unassigned',
      ),
    ).toBe(true);
    expect(filterRecords(records, kyc, { ...defaultFilters, sort: 'opened' }, now)[0].id).toBe(
      'KYC-1033',
    );
    expect(records.map((record) => record.id)).toEqual(originalIds);
    expect(
      filterRecords(
        createFixtures(now).records.refunds,
        refunds,
        { ...defaultFilters, search: 'CUS-1042' },
        now,
      ),
    ).toHaveLength(1);
  });
  it('uses opened age, includes waiting cases, excludes resolved/unknown-age records and handles the 48h boundary', () => {
    const records = createFixtures(now).records.kyc;
    const ids = filterRecords(records, kyc, { ...defaultFilters, agingOnly: true }, now).map(
      (record) => record.id,
    );
    expect(ids).toContain('KYC-1033');
    expect(ids).toContain('KYC-1031');
    expect(ids).not.toContain('KYC-1029');
    const sample: ToolRecord = {
      ...records[0],
      openedAt: new Date(now.getTime() - 48 * 3_600_000).toISOString(),
    };
    expect(filterRecords([sample], kyc, { ...defaultFilters, agingOnly: true }, now)).toHaveLength(
      1,
    );
    sample.openedAt = new Date(now.getTime() - 48 * 3_600_000 + 1).toISOString();
    expect(filterRecords([sample], kyc, { ...defaultFilters, agingOnly: true }, now)).toHaveLength(
      0,
    );
    delete sample.openedAt;
    expect(filterRecords([sample], kyc, { ...defaultFilters, agingOnly: true }, now)).toHaveLength(
      0,
    );
    expect(ageLabel(undefined, now)).toBe('Not recorded');
    expect(ageLabel(new Date(now.getTime() - 50 * 3_600_000).toISOString(), now)).toBe('2d 2h');
    expect(ageLabel(now.toISOString(), now)).toBe('0h');
  });
  it('round-trips filter definitions per tool independently of demo data', () => {
    expect(loadViews(kyc).views).toEqual([]);
    const views = [
      {
        name: 'My waiting cases',
        filters: { ...defaultFilters, owner: 'You', status: 'Waiting for information' },
      },
    ];
    expect(saveViews('kyc', views)).toBe(true);
    expect(loadViews(kyc)).toEqual({ views, warning: '', blocked: false });
    expect(loadViews(refunds).views).toEqual([]);
    expect(saveViews('kyc', [])).toBe(true);
    expect(loadViews(kyc).views).toEqual([]);
  });
  it.each([
    'not JSON',
    '{}',
    '[null]',
    JSON.stringify([{ name: 'bad', filters: {} }]),
    JSON.stringify([{ name: 'bad', filters: { ...defaultFilters, status: 'Unknown' } }]),
  ])('preserves invalid saved views: %s', (raw) => {
    localStorage.setItem(viewsKey('kyc'), raw);
    expect(loadViews(kyc).blocked).toBe(true);
    expect(localStorage.getItem(viewsKey('kyc'))).toBe(raw);
  });
  it('reports unavailable view storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect(loadViews(kyc).blocked).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(saveViews('kyc', [])).toBe(false);
  });
});
