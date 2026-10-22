import { describe, expect, it } from 'vitest';
import { modules } from '.';
import { customPages } from '../features/pages';
import { createFixtures } from '../core/fixtures';
import { isDemoState } from '../core/storage';

// Every registered tool must pass these checks; a new tool gets them without writing extra tests.
const now = new Date('2026-01-15T12:00:00Z');
const reserved = ['overview', 'activity', 'about', ...customPages.map((page) => page.id)];

describe.each(modules.map((module) => [module.id, module] as const))(
  '%s tool contract',
  (_, module) => {
    const records = module.samples(now);

    it('uses a unique, route-safe id', () => {
      expect(module.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(reserved).not.toContain(module.id);
      expect(modules.filter((other) => other.id === module.id)).toHaveLength(1);
    });

    it('ships deterministic, valid sample records', () => {
      expect(records.length).toBeGreaterThan(0);
      expect(module.samples(now)).toEqual(records);
      expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
      const state = {
        ...createFixtures(now),
        records: { ...createFixtures(now).records, [module.id]: records },
      };
      expect(isDemoState(state)).toBe(true);
      for (const record of records) {
        expect(module.owners).toContain(record.owner);
        for (const detail of module.details) expect(typeof detail.value(record)).toBe('string');
      }
    });

    it('declares owners, statuses, actions and metrics', () => {
      expect(module.owners).toContain('Unassigned');
      expect(Object.keys(module.statuses).length).toBeGreaterThan(0);
      expect(new Set(module.actions.map((action) => action.id)).size).toBe(module.actions.length);
      expect(module.metrics(records).length).toBeGreaterThan(0);
    });

    it('only moves records between declared statuses', () => {
      // Actions may depend on an earlier action (e.g. approve, then simulate), so walk a few steps.
      let frontier = records.map((record) => module.withDefaults?.(record) ?? record);
      const used = new Set<string>();
      for (let step = 0; step < 4 && frontier.length; step++) {
        const next: typeof frontier = [];
        for (const action of module.actions)
          for (const record of frontier.filter(action.available)) {
            used.add(action.id);
            const after = action.apply(record);
            expect(Object.hasOwn(module.statuses, after.status)).toBe(true);
            expect(module.validateFields(after)).toBe(true);
            expect(after.id).toBe(record.id);
            next.push(after);
          }
        frontier = next;
      }
      for (const action of module.actions)
        expect(used.has(action.id), `${action.id} is unreachable from sample records`).toBe(true);
    });
  },
);
