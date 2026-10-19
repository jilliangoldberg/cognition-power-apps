import { describe, expect, it } from 'vitest';
import { createFixtures } from './fixtures';
import { workspaceItems, workItemsForView } from './workspace';

describe('browser-local My work', () => {
  it('excludes configurations/resolved records, honors guarded decisions, and does not mutate data', () => {
    const data = createFixtures();
    const original = JSON.stringify(data);
    const items = workspaceItems(data);
    expect(workItemsForView(items, 'mine').map(({ record }) => record.id)).toEqual([
      'KYC-1039',
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
