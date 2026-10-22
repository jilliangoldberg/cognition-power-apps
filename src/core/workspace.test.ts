import { describe, expect, it, vi } from 'vitest';
import { createFixtures } from './fixtures';
import { workspaceItems, workItemsForView } from './workspace';

// These tests assert the curated demo data of the original three tools, so a newly added tool
// must not change them.
vi.mock('../modules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../modules')>();
  const original = actual.modules.filter((m) => ['kyc', 'refunds', 'flags'].includes(m.id));
  return {
    ...actual,
    modules: original,
    getModule: (id: string) => original.find((m) => m.id === id)!,
  };
});

describe('browser-local My work', () => {
  it('uses the local evidence rule rather than the separate Shared KYC command list', () => {
    const data = createFixtures();
    data.records.kyc[0].fields.evidenceReviewed = false;
    const item = workspaceItems(data).find(({ record }) => record.id === 'KYC-1042')!;
    expect(item.waiting).toBe(true);
    expect(item.reason).toContain('Assess the fictional evidence before approving');
    expect(workItemsForView([item], 'mine')).toEqual([]);
    data.records.kyc[0].fields.evidenceReviewed = true;
    expect(workspaceItems(data).find(({ record }) => record.id === 'KYC-1042')!.waiting).toBe(
      false,
    );
  });
  it('excludes configurations/resolved records, honors guarded decisions, and does not mutate data', () => {
    const data = createFixtures();
    const original = JSON.stringify(data);
    const items = workspaceItems(data);
    expect(workItemsForView(items, 'mine').map(({ record }) => record.id)).toEqual([
      'KYC-1042',
      'KYC-1032',
      'REF-0204',
    ]);
    expect(items.some(({ module }) => module.id === 'flags')).toBe(false);
    expect(
      items.some(({ record }) => ['KYC-1037', 'REF-0201', 'REF-0200'].includes(record.id)),
    ).toBe(false);
    expect(
      workItemsForView(items, 'waiting').find(({ record }) => record.id === 'REF-0199')?.reason,
    ).toContain('Multiple requests share this payment');
    expect(
      workItemsForView(items, 'waiting').some(
        ({ record }) => record.status === 'Awaiting approval example',
      ),
    ).toBe(true);
    expect(JSON.stringify(data)).toBe(original);
  });
  it('keeps unassigned/waiting overlap explicit and uses current local owner labels', () => {
    const data = createFixtures();
    const waiting = data.records.kyc.find((record) => record.status === 'Waiting for information')!;
    waiting.owner = 'Unassigned';
    const items = workspaceItems(data);
    expect(workItemsForView(items, 'unassigned').map(({ record }) => record.id)).toContain(
      waiting.id,
    );
    expect(workItemsForView(items, 'waiting').map(({ record }) => record.id)).toContain(waiting.id);
    data.records.kyc.find((record) => record.id === 'KYC-1042')!.owner = 'Saved owner';
    expect(
      workItemsForView(workspaceItems(data), 'mine').map(({ record }) => record.id),
    ).not.toContain('KYC-1042');
  });
});
