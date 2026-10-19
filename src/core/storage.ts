import { modules } from '../modules';
import { createFixtures } from './fixtures';
import type { Activity, DemoState, ToolRecord } from './types';

export const STORAGE_KEY = 'workbench.demo.v1';
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const validDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

function isRecord(value: unknown): value is ToolRecord {
  return (
    object(value) &&
    ['id', 'name', 'subtitle', 'status', 'owner'].every((key) => typeof value[key] === 'string') &&
    validDate(value.updatedAt) &&
    Number.isSafeInteger(value.version) &&
    Number(value.version) >= 1 &&
    object(value.fields) &&
    Object.values(value.fields).every((field) =>
      ['string', 'number', 'boolean'].includes(typeof field),
    )
  );
}

function isActivity(value: unknown): value is Activity {
  return (
    object(value) &&
    ['id', 'recordId', 'recordName', 'action', 'reason', 'before', 'after'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    modules.some((module) => module.id === value.moduleId) &&
    validDate(value.at)
  );
}

export function isDemoState(value: unknown): value is DemoState {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !object(value.records) ||
    !Array.isArray(value.activity) ||
    !value.activity.every(isActivity)
  )
    return false;
  const records = value.records;
  return modules.every((module) => {
    const rows = records[module.id];
    return (
      Array.isArray(rows) &&
      rows.every(
        (row) =>
          isRecord(row) && Object.hasOwn(module.statuses, row.status) && module.validateFields(row),
      ) &&
      new Set(rows.map((row: ToolRecord) => row.id)).size === rows.length
    );
  });
}

export function loadDemo(): { data: DemoState; warning: string; blocked: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { data: createFixtures(), warning: '', blocked: false };
    const value: unknown = JSON.parse(raw);
    if (!isDemoState(value)) throw new Error('Unsupported demo data');
    return { data: value, warning: '', blocked: false };
  } catch {
    return {
      data: createFixtures(),
      warning:
        'Saved data could not be loaded. Using temporary fixtures without overwriting it. Reset the demo to start fresh.',
      blocked: true,
    };
  }
}

export function saveDemo(data: DemoState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
