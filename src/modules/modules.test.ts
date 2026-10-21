import { describe, expect, it } from 'vitest';
import { modules } from '.';
import { contractProblems } from './contract';
import { customPages } from '../features/pages';
import type { ToolModule } from '../core/types';

// Every registered tool must pass these checks; a new tool gets them without writing extra tests.
describe.each(modules.map((module) => [module.id, module] as const))(
  '%s tool contract',
  (_, module) => {
    it('fits the shared shell', () => expect(contractProblems(module)).toEqual([]));
    it('has an id no other tool or page uses', () => {
      expect(modules.filter((other) => other.id === module.id)).toHaveLength(1);
      expect(customPages.map((page) => page.id)).not.toContain(module.id);
    });
  },
);

describe('contract checks', () => {
  const base = modules[0];
  let calls = 0;
  const broken = (change: Partial<ToolModule>) => contractProblems({ ...base, ...change });
  it.each([
    ['bad id', { id: 'New Tool' }, 'lowercase slug'],
    ['built-in id', { id: 'activity' }, 'built-in page'],
    ['no samples', { samples: () => [] }, 'at least one sample'],
    ['undeclared status', { statuses: { Other: 'neutral' as const } }, 'undeclared status'],
    ['unlisted owner', { owners: ['Unassigned'] }, 'is not listed'],
    [
      'nondeterministic samples',
      { samples: (now: Date) => base.samples(new Date(now.getTime() + calls++ * 60_000)) },
      'deterministic',
    ],
    [
      'action to undeclared status',
      { actions: [{ ...base.actions[0], apply: (r) => ({ ...r, status: 'Gone' }) }] },
      'undeclared "Gone"',
    ],
  ] satisfies [string, Partial<ToolModule>, string][])('reports %s', (_, change, message) => {
    expect(broken(change).join('\n')).toContain(message);
  });
});
