import { Investigation } from './Investigation';
import { VendorOnboarding } from './VendorOnboarding';
import { defineReadOnlyPage } from './extension-contract';
import { readOnlyPageStarter } from './extension-starter';
import { investigationExamples } from './evidence';
import { PaymentLookup } from './PaymentLookup';
import { paymentExamples } from './payments';

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
    { id: 'investigate', label: 'Investigate transaction', effect: 'synthetic-read' },
    { id: 'retry-source', label: 'Retry one source', effect: 'synthetic-read' },
  ],
  fixtureScenarios: investigationExamples.map((example) => example.id),
});

export const paymentLookupExtension = defineReadOnlyPage({
  ...readOnlyPageStarter,
  id: 'payments',
  title: 'Payment lookup',
  icon: 'card',
  View: PaymentLookup,
  owner: {
    team: 'Support tooling maintainers',
    status: 'proposed',
    support: 'Repository issue/review; no staffed on-call or response target',
    runbook: 'docs/extension-guide.md',
  },
  actions: [
    { id: 'search-transaction', label: 'Search by transaction ID', effect: 'synthetic-read' },
    { id: 'search-email', label: 'Search by customer email', effect: 'synthetic-read' },
    { id: 'search-email-card', label: 'Search by email and card last 4', effect: 'synthetic-read' },
  ],
  fixtureScenarios: paymentExamples.map((example) => example.label),
});

// Custom pages share the shell, not the queue's persisted record schema.
export const customPages = [
  investigationExtension,
  // Persists its own local state, so it is not a read-only contract extension.
  { id: 'vendors', title: 'Vendor approvals', icon: 'box', View: VendorOnboarding },
  paymentLookupExtension,
] as const;
