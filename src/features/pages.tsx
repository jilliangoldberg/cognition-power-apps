import { Investigation } from './Investigation';
import { SharedKyc } from './SharedKyc';
import { VendorOnboarding } from './VendorOnboarding';

// Custom pages share the shell, not the queue's persisted record schema.
export const customPages = [
  {
    id: 'investigation',
    title: 'Investigation',
    icon: 'search',
    View: Investigation,
    description: 'Trace synthetic transactions through source evidence and a timeline.',
    scope: 'Read-only synthetic',
    color: 'blue',
  },
  {
    id: 'shared-kyc',
    title: 'Shared KYC',
    icon: 'shield',
    View: SharedKyc,
    description: 'Explore authenticated, server-backed case collaboration separately.',
    scope: 'Shared synthetic',
    color: 'purple',
  },
  {
    id: 'vendors',
    title: 'Vendor approvals',
    icon: 'box',
    View: VendorOnboarding,
    description: 'Take a vendor request through Finance, Security, and Legal reviews.',
    scope: 'Local simulation',
    color: 'green',
  },
] as const;
