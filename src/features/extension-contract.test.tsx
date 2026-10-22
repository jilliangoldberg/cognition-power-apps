import { describe, expect, expectTypeOf, it } from 'vitest';
import { modules } from '../modules';
import { customPages, investigationExtension } from './pages';
import { defineReadOnlyPage, type ReadOnlyPageExtension } from './extension-contract';
import { readOnlyPageStarter } from './extension-starter';
import { investigationExamples } from './evidence';

describe('reviewed static read-only extension seam v1', () => {
  it('registers Investigation once alongside Vendor approvals and Payment lookup', () => {
    expect(customPages.map((page) => page.id)).toEqual(['investigation', 'vendors', 'payments']);
    expect(customPages[0]).toBe(investigationExtension);
    const ids = [
      'overview',
      'activity',
      ...modules.map((module) => module.id),
      ...customPages.map((page) => page.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(investigationExtension.fixtureScenarios).toEqual(
      investigationExamples.map((example) => example.id),
    );
    expect(investigationExtension.owner.status).toBe('proposed');
    expect(investigationExtension.owner.runbook).toBe('docs/extension-guide.md');
    expect(customPages[1]).not.toHaveProperty('readOnly');
  });

  it('lets a builder supply a custom view without a queue schema or shell copy', () => {
    const View = () => null;
    const extension = defineReadOnlyPage({
      ...readOnlyPageStarter,
      id: 'unregistered-starter',
      title: 'Unregistered starter',
      icon: 'search',
      View,
      owner: {
        team: 'Proposed owner',
        status: 'proposed',
        support: 'Repository review only',
        runbook: 'docs/extension-guide.md',
      },
      actions: [{ id: 'inspect', label: 'Inspect fixture', effect: 'synthetic-read' }],
      fixtureScenarios: ['found', 'unavailable'],
    });
    expect(extension.View).toBe(View);
    expect(extension.persistence).toBe('none');
    expect(extension).not.toHaveProperty('records');
    expect(customPages.some((page) => String(page.id) === extension.id)).toBe(false);
    expectTypeOf(investigationExtension.id).toEqualTypeOf<'investigation'>();
    expectTypeOf<ReadOnlyPageExtension['contractVersion']>().toEqualTypeOf<1>();
    expectTypeOf<ReadOnlyPageExtension['readOnly']>().toEqualTypeOf<true>();
    expectTypeOf<
      ReadOnlyPageExtension['actions'][number]['effect']
    >().toEqualTypeOf<'synthetic-read'>();
  });

  it.each([
    [{ contractVersion: 2 }, /Unsupported/],
    [{ id: 'Not a route' }, /stable slug/],
    [{ title: ' ' }, /stable slug/],
    [{ dataMode: 'live' }, /synthetic reads only/],
    [{ readOnly: false }, /synthetic reads only/],
    [{ persistence: 'browser' }, /synthetic reads only/],
    [{ owner: { ...investigationExtension.owner, support: ' ' } }, /owner, support/],
    [{ actions: [] }, /unique named synthetic reads/],
    [{ actions: [{ id: 'pay', label: 'Pay', effect: 'provider-write' }] }, /synthetic reads/],
    [
      { actions: [investigationExtension.actions[0], investigationExtension.actions[0]] },
      /unique named/,
    ],
    [{ fixtureScenarios: [] }, /fixture scenarios/],
    [{ fixtureScenarios: ['same', 'same'] }, /unique fixture/],
  ])('rejects incompatible or incomplete registration metadata (%j)', (patch, message) => {
    expect(() =>
      defineReadOnlyPage({
        ...investigationExtension,
        ...patch,
      } as unknown as ReadOnlyPageExtension),
    ).toThrow(message as RegExp);
  });
});
