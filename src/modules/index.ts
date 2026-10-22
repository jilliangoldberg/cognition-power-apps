import { kyc } from './kyc';
import { refunds } from './refunds';
import { flags } from './flags';
import type { ToolId, ToolModule } from '../core/types';

// Register each tool once. IDs become routes and saved-data keys, so keep them stable.
export const modules: ToolModule[] = [kyc, refunds, flags];

const ids = modules.map((module) => module.id);
if (ids.some((id) => !/^[a-z][a-z0-9-]*$/.test(id)) || new Set(ids).size !== ids.length)
  throw new Error('Tool IDs must be unique lowercase slugs');

export const getModule = (id: ToolId) => modules.find((module) => module.id === id)!;
