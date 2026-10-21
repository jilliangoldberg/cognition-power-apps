import { modules } from '../modules';
import type { DemoState } from './types';

export function createFixtures(now = new Date()): DemoState {
  return {
    schemaVersion: 2,
    records: Object.fromEntries(modules.map((module) => [module.id, module.samples(now)])),
    activity: [],
  };
}
