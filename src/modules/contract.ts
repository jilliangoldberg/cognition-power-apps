import { isRecord } from '../core/storage';
import type { ToolModule } from '../core/types';

export const BUILT_IN_PAGES = ['overview', 'activity', 'about'];

// Checks one tool definition in isolation. Returns readable problems; empty means it fits the shell.
export function contractProblems(module: ToolModule, now = new Date('2026-01-15T12:00:00Z')) {
  const problems: string[] = [];
  if (!/^[a-z][a-z0-9-]*$/.test(module.id)) problems.push('id must be a lowercase slug');
  if (BUILT_IN_PAGES.includes(module.id)) problems.push(`id "${module.id}" is a built-in page`);
  if (!module.title.trim() || !module.shortTitle.trim()) problems.push('title is required');
  if (!module.owners.includes('Unassigned')) problems.push('owners must include "Unassigned"');
  if (!Object.keys(module.statuses).length) problems.push('declare at least one status');
  if (new Set(module.actions.map((action) => action.id)).size !== module.actions.length)
    problems.push('action ids must be unique');
  let records;
  try {
    records = module.samples(now);
  } catch {
    return [...problems, 'samples() threw'];
  }
  if (!records.length) problems.push('add at least one sample record');
  if (JSON.stringify(module.samples(now)) !== JSON.stringify(records))
    problems.push('samples must be deterministic for a given time');
  if (new Set(records.map((record) => record.id)).size !== records.length)
    problems.push('sample record ids must be unique');
  for (const record of records) {
    if (!isRecord(record as unknown)) problems.push(`${record.id}: malformed record`);
    if (!Object.hasOwn(module.statuses, record.status))
      problems.push(`${record.id}: undeclared status "${record.status}"`);
    if (!module.validateFields(record)) problems.push(`${record.id}: fails validateFields`);
    if (!module.owners.includes(record.owner))
      problems.push(`${record.id}: owner "${record.owner}" is not listed`);
    const updated = Date.parse(record.updatedAt);
    if (!(updated <= now.getTime()))
      problems.push(`${record.id}: updatedAt must be a valid time no later than now`);
    if (!record.openedAt || !(Date.parse(record.openedAt) < updated))
      problems.push(`${record.id}: openedAt must be set and earlier than updatedAt`);
    if (module.details.some((detail) => typeof detail.value(record) !== 'string'))
      problems.push(`${record.id}: details must render strings`);
  }
  for (const action of module.actions) {
    const available = records.filter(action.available);
    if (!available.length) problems.push(`action "${action.id}" has no sample record to act on`);
    for (const record of available) {
      const next = action.apply(record);
      if (!Object.hasOwn(module.statuses, next.status))
        problems.push(`action "${action.id}" moves ${record.id} to undeclared "${next.status}"`);
      if (!module.validateFields(next) || next.id !== record.id)
        problems.push(`action "${action.id}" produces an invalid ${record.id}`);
    }
  }
  if (!module.metrics(records).length) problems.push('declare at least one metric');
  return problems;
}
