import { describe, expect, it, vi } from 'vitest';
import { actionBlock } from './eligibility';
import { createFixtures } from './fixtures';
import type { RecordAction } from './types';

const action: RecordAction = {
  id: 'inspect',
  label: 'Inspect',
  confirmation: 'Synthetic test only',
  available: () => true,
  apply: (record) => record,
};

describe('shared pre-submit eligibility explanation', () => {
  const records = createFixtures().records.kyc;
  it('uses the same current sibling context as command validation', () => {
    const validate = vi.fn();
    expect(actionBlock({ ...action, validate }, records[0], records)).toBeUndefined();
    expect(validate).toHaveBeenCalledWith(records[0], records);
  });
  it('explains a known block before attempting additional validation', () => {
    const validate = vi.fn();
    expect(
      actionBlock(
        { ...action, blockedReason: () => 'Assess evidence first.', validate },
        records[0],
      ),
    ).toBe('Assess evidence first.');
    expect(validate).not.toHaveBeenCalled();
  });
  it('reports validator rejections without running transitions', () => {
    const apply = vi.fn();
    expect(
      actionBlock(
        {
          ...action,
          apply,
          validate: () => {
            throw new Error('Current siblings block this change.');
          },
        },
        records[0],
      ),
    ).toBe('Current siblings block this change.');
    expect(apply).not.toHaveBeenCalled();
  });
  it('fails closed when a module rule throws a non-error value', () => {
    expect(
      actionBlock(
        {
          ...action,
          blockedReason: () => {
            throw null;
          },
        },
        records[0],
      ),
    ).toBe('This action is blocked by a module rule.');
  });
});
