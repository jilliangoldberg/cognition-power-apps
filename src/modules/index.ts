import { kyc } from './kyc';
import { refunds } from './refunds';
import { flags } from './flags';
import type { ToolId, ToolModule } from '../core/types';

export const modules: ToolModule[] = [kyc, refunds, flags];
export const getModule = (id: ToolId) => modules.find((module) => module.id === id)!;
