import { describe, expect, it, vi } from 'vitest';
import {
  approvalBlocker,
  createVendorFixtures,
  loadVendors,
  newVendorRequest,
  requiredTeams,
  reviewVendorRequest,
  reviseVendorRequest,
  saveVendors,
  vendorStatus,
  VENDOR_STORAGE_KEY,
} from './vendors';

describe('vendor review policy (local simulation)', () => {
  it('provides distinct review, changes-requested, and ready examples without executing onboarding', () => {
    const { requests } = createVendorFixtures();
    expect(requests.map(vendorStatus)).toEqual([
      'In review',
      'Changes requested',
      'Ready for onboarding',
    ]);
    expect(requiredTeams(requests[0].details)).toEqual(['Finance', 'Security', 'Legal']);
    expect(requiredTeams(requests[2].details)).toEqual(['Finance', 'Legal']);
  });

  it('requires all applicable reviews and their prerequisites before readiness', () => {
    const original = createVendorFixtures().requests[0];
    expect(approvalBlocker(original.details, 'Security')).toMatch(/assessment/);
    expect(() =>
      reviewVendorRequest(original, 'Security', 'Approved', 'Approved for the demo.'),
    ).toThrow(/assessment/);
    let request = reviseVendorRequest(original, { ...original.details, securityReviewed: true });
    request = reviewVendorRequest(
      request,
      'Finance',
      'Approved',
      'Illustrative budget owner reviewed.',
    );
    expect(vendorStatus(request)).toBe('In review');
    request = reviewVendorRequest(
      request,
      'Security',
      'Approved',
      'Synthetic assessment reviewed.',
    );
    expect(vendorStatus(request)).toBe('In review');
    request = reviewVendorRequest(request, 'Legal', 'Approved', 'Synthetic contract reviewed.');
    expect(vendorStatus(request)).toBe('Ready for onboarding');
    expect(request.history).toHaveLength(original.history.length + 4);
    expect(original.reviews.Finance.status).toBe('Pending');
  });

  it.each(['Finance', 'Legal'] as const)(
    'rejects %s approval when its prerequisite is absent',
    (team) => {
      const request = createVendorFixtures().requests[0];
      request.details.budgetOwner = '';
      request.details.contractReviewed = false;
      expect(() =>
        reviewVendorRequest(request, team, 'Approved', 'Reason entered for review.'),
      ).toThrow(/before/);
    },
  );

  it('allows a reasoned request for changes despite unmet prerequisites', () => {
    const request = createVendorFixtures().requests[0];
    const next = reviewVendorRequest(
      request,
      'Security',
      'Changes requested',
      'Need the synthetic security assessment.',
      '2026-10-19T12:00:00.000Z',
    );
    expect(vendorStatus(next)).toBe('Changes requested');
    expect(next.history.at(-1)).toMatchObject({
      actor: 'Demo Security reviewer',
      at: '2026-10-19T12:00:00.000Z',
    });
    expect(() =>
      reviewVendorRequest(
        next,
        'Security',
        'Approved',
        'Cannot silently replace the prior decision.',
      ),
    ).toThrow(/already recorded/);
  });

  it('skips Security only for public-information requests and rejects review of a skipped stage', () => {
    const request = createVendorFixtures().requests[2];
    expect(() =>
      reviewVendorRequest(request, 'Security', 'Approved', 'This review is not applicable.'),
    ).toThrow(/not required/);
    const changed = reviseVendorRequest(request, {
      ...request.details,
      dataAccess: 'Internal business data',
    });
    expect(requiredTeams(changed.details)).toContain('Security');
    expect(vendorStatus(changed)).toBe('In review');
  });

  it('invalidates all prior approvals after any edit and retains revision history', () => {
    const ready = createVendorFixtures().requests[2];
    const next = reviseVendorRequest(ready, {
      ...ready.details,
      annualCents: ready.details.annualCents + 100,
    });
    expect(next.id).toBe(ready.id);
    expect(next.revision).toBe(2);
    expect(Object.values(next.reviews).every((review) => review.status === 'Pending')).toBe(true);
    expect(next.history.slice(0, -1)).toEqual(ready.history);
    expect(next.history.at(-1)?.action).toContain('all reviews reset');
    expect(vendorStatus(next)).toBe('In review');
  });

  it.each(['', '    ', 'tiny', 'x'.repeat(1001)])(
    'requires a meaningful bounded review reason',
    (reason) => {
      expect(() =>
        reviewVendorRequest(createVendorFixtures().requests[0], 'Finance', 'Approved', reason),
      ).toThrow(/review reason/);
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 100_000_001])(
    'rejects invalid annual cents %s',
    (annualCents) => {
      expect(() =>
        newVendorRequest({ ...createVendorFixtures().requests[0].details, annualCents }),
      ).toThrow();
    },
  );

  it('creates and reviews requests without secure-context randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const details = createVendorFixtures().requests[2].details;
    const request = newVendorRequest(details, '2026-01-01T00:00:00.000Z');
    expect(request.id).toMatch(/^VND-[0-9A-F]{8}$/);
    const reviewed = reviewVendorRequest(request, 'Finance', 'Approved', 'Budget owner confirmed.');
    expect(new Set(reviewed.history.map((event) => event.id)).size).toBe(2);
  });

  it('validates required fields and trims accepted details', () => {
    const details = createVendorFixtures().requests[0].details;
    expect(() => newVendorRequest({ ...details, vendor: ' ' })).toThrow(/vendor name/);
    expect(() => newVendorRequest({ ...details, purpose: 'short' })).toThrow(/business need/);
    expect(newVendorRequest({ ...details, vendor: '  Fictional Vendor  ' }).details.vendor).toBe(
      'Fictional Vendor',
    );
  });
});

describe('isolated vendor storage', () => {
  it('round-trips revisions, reviews, and history without touching unrelated state', () => {
    localStorage.setItem('unrelated', 'preserve');
    const data = createVendorFixtures();
    data.requests[0] = reviewVendorRequest(
      data.requests[0],
      'Finance',
      'Approved',
      'Budget reviewed for the demo.',
    );
    expect(saveVendors(data)).toBe(true);
    expect(loadVendors()).toEqual({ data, blocked: false, warning: '' });
    expect(localStorage.getItem('unrelated')).toBe('preserve');
  });

  it.each([
    'not json',
    '{"schemaVersion":99,"requests":[]}',
    JSON.stringify({ schemaVersion: 1, requests: [{}] }),
  ])('preserves unreadable saved bytes and exposes read-only samples', (raw) => {
    localStorage.setItem(VENDOR_STORAGE_KEY, raw);
    expect(loadVendors()).toMatchObject({
      blocked: true,
      warning: expect.stringContaining('read-only'),
    });
    expect(localStorage.getItem(VENDOR_STORAGE_KEY)).toBe(raw);
  });

  it('rejects duplicate saved request identifiers', () => {
    const sample = createVendorFixtures().requests[0];
    localStorage.setItem(
      VENDOR_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, requests: [sample, sample] }),
    );
    expect(loadVendors().blocked).toBe(true);
  });

  it('reports unavailable browser storage without crashing or claiming persistence', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(loadVendors().blocked).toBe(true);
    expect(saveVendors(createVendorFixtures())).toBe(false);
  });
});
