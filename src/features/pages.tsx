import { Investigation } from './Investigation';
import { SharedKyc } from './SharedKyc';

// Custom pages share the shell, not the queue's persisted record schema.
export const customPages = [
  { id: 'investigation', title: 'Investigation', icon: 'search', View: Investigation },
  { id: 'shared-kyc', title: 'Shared KYC', icon: 'shield', View: SharedKyc },
] as const;
