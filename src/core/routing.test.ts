import { describe, expect, it } from 'vitest';
import type { Page } from './types';
import { defaultFilters } from './views';
import { readRoute, recordRoute, routeHash } from './routing';

const pages: Page[] = ['overview', 'kyc', 'refunds', 'flags', 'investigation', 'activity', 'about'];

describe('workspace hash routes', () => {
  it.each(pages)('preserves the existing #%s page', (page) => {
    expect(readRoute(`#${page}`, pages)).toMatchObject({ page });
    expect(readRoute(`#${page}`, pages).selection).toBeUndefined();
  });
  it('encodes IDs, filters and a validated return context without changing the record ID', () => {
    const queue = readRoute(
      '#kyc?owner=You&status=Needs+review&search=Olivia+%26+%3F&sort=opened&aging=1',
      pages,
    );
    const id = 'case / # ? % & + ü';
    const link = routeHash(recordRoute(queue, 'kyc', id, queue.filters));
    expect(link).toContain(encodeURIComponent(id));
    const parsed = readRoute(link, pages);
    expect(parsed.selection).toEqual({ moduleId: 'kyc', id });
    expect(parsed.filters).toEqual({
      search: 'Olivia & ?',
      owner: 'You',
      status: 'Needs review',
      sort: 'opened',
      agingOnly: true,
    });
    expect(parsed.returnHash).toBe(routeHash(queue));
    expect(routeHash(parsed)).toBe(link);
  });
  it('opens and reloads the longest saved record ID but rejects one character more', () => {
    const queue = readRoute('#kyc', pages);
    const id = 'A'.repeat(500);
    const parsed = readRoute(routeHash(recordRoute(queue, 'kyc', id, queue.filters)), pages);
    expect(parsed.selection).toEqual({ moduleId: 'kyc', id });
    expect(readRoute(`#kyc/${'A'.repeat(501)}`, pages).error).toBeTruthy();
  });
  it('retains a My work return view independently from the underlying tool filter', () => {
    const home = readRoute('#overview?work=waiting', pages);
    const parsed = readRoute(
      routeHash(recordRoute(home, 'refunds', 'REF-0199', defaultFilters)),
      pages,
    );
    expect(parsed.returnHash).toBe('#overview?work=waiting');
    expect(parsed.page).toBe('refunds');
  });
  it.each(['#unknown/ID', '#kyc/%E0%A4%A', '#kyc/', '#kyc/a/b', '#investigation/fake'])(
    'fails safely for %s',
    (hash) => {
      const route = readRoute(hash, pages);
      expect(route.error).toBeTruthy();
      expect(route.selection).toBeUndefined();
    },
  );
  it.each(['https://example.com', '#unknown', '#kyc/record', '//example.com'])(
    'rejects an unsafe/non-queue return target %s',
    (from) => {
      expect(
        readRoute(`#kyc/KYC-1042?from=${encodeURIComponent(from)}`, pages).returnHash,
      ).toBeUndefined();
    },
  );
  it('bounds text and resets unsupported filter values while retaining safe owner labels', () => {
    const filters = readRoute(
      `#kyc?status=__proto__&sort=bad&owner=Saved+owner&search=${'x'.repeat(600)}&aging=maybe`,
      pages,
    ).filters;
    expect(filters).toMatchObject({
      status: 'all',
      sort: 'updated',
      owner: 'Saved owner',
      agingOnly: false,
    });
    expect(filters.search).toHaveLength(500);
    expect(readRoute('#overview?work=__proto__', pages).work).toBe('mine');
  });
});
