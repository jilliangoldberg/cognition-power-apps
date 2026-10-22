import { READ_ONLY_PAGE_CONTRACT_VERSION, type ReadOnlyPageExtension } from './extension-contract';

export const readOnlyPageStarter = {
  contractVersion: READ_ONLY_PAGE_CONTRACT_VERSION,
  dataMode: 'synthetic',
  readOnly: true,
  persistence: 'none',
  reviewStatus: 'provisional',
} as const satisfies Pick<
  ReadOnlyPageExtension,
  'contractVersion' | 'dataMode' | 'readOnly' | 'persistence' | 'reviewStatus'
>;
