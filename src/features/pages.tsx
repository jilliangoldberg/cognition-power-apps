import { Investigation } from './Investigation';
import { VendorOnboarding } from './VendorOnboarding';
import { defineReadOnlyPage } from './extension-contract';
import { readOnlyPageStarter } from './extension-starter';
import { investigationExamples } from './evidence';

export const investigationExtension = defineReadOnlyPage({
  ...readOnlyPageStarter,
  id: 'investigation',
  title: 'Investigation',
  icon: 'search',
  View: Investigation,
  owner: {
    team: 'Investigation maintainers',
    status: 'proposed',
    support: 'Repository issue/review; no staffed on-call or response target',
    runbook: 'docs/extension-guide.md',
  },
  actions: [
    { id: 'investigate', label: 'Investigate synthetic transaction', effect: 'synthetic-read' },
    { id: 'retry-source', label: 'Simulate one source retry', effect: 'synthetic-read' },
  ],
  fixtureScenarios: investigationExamples.map((example) => example.id),
});

// Custom pages share the shell, not the queue's persisted record schema.
export const customPages = [
  investigationExtension,
  // Persists its own local state, so it is not a read-only contract extension.
  { id: 'vendors', title: 'Vendor approvals', icon: 'box', View: VendorOnboarding },
] as const;
