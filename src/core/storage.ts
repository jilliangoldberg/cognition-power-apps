import { modules } from '../modules';
import { createFixtures } from './fixtures';
import { isRecordId } from './id';
import type { Activity, DemoState, ToolRecord } from './types';

export const STORAGE_KEY = 'workbench.demo.v1';
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const validDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

export function isRecord(value: unknown): value is ToolRecord {
  return (
    object(value) &&
    ['id', 'name', 'subtitle', 'status', 'owner'].every((key) => typeof value[key] === 'string') &&
    isRecordId(value.id) &&
    validDate(value.updatedAt) &&
    (value.openedAt === undefined ||
      (validDate(value.openedAt) && Date.parse(value.openedAt) <= Date.parse(value.updatedAt))) &&
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
    ['action', 'assignment', 'note'].includes(String(value.kind)) &&
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
    value.schemaVersion !== 2 ||
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

// Every saved schema (v1 and v2) already stores these queues, so a save missing one is damaged.
const SAVED_SCHEMA_TOOL_IDS: readonly string[] = ['kyc', 'refunds', 'flags'];

export function loadDemo(): { data: DemoState; warning: string; blocked: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { data: createFixtures(), warning: '', blocked: false };
    let value: unknown = JSON.parse(raw);
    const legacy = object(value) && value.schemaVersion === 1;
    if (legacy && object(value) && Array.isArray(value.activity)) {
      value = {
        ...value,
        schemaVersion: 2,
        activity: value.activity.map((event: unknown) =>
          object(event) ? { ...event, kind: 'action' } : event,
        ),
      };
    }
    const added: string[] = [];
    if (object(value) && object(value.records)) {
      const saved = value.records;
      const missing = modules.filter(
        (module) => !Object.hasOwn(saved, module.id) && !SAVED_SCHEMA_TOOL_IDS.includes(module.id),
      );
      if (missing.length) {
        const fresh = createFixtures();
        value = {
          ...value,
          records: {
            ...saved,
            ...Object.fromEntries(missing.map((m) => [m.id, fresh.records[m.id]])),
          },
        };
        added.push(...missing.map((module) => module.shortTitle));
      }
    }
    if (!isDemoState(value)) throw new Error('Unsupported demo data');
    // Add only conservative flat defaults; never replace saved records or infer past outcomes.
    const data: DemoState = {
      ...value,
      records: { ...value.records },
    };
    for (const module of modules)
      data.records[module.id] = value.records[module.id].map(
        (record) => module.withDefaults?.(record) ?? record,
      );
    if (!isDemoState(data)) throw new Error('Unsupported workflow data');
    return {
      data,
      warning: [
        legacy
          ? 'Saved work preserved in the updated format. Reset demo data only if you want the richer sample records; resetting removes your local changes.'
          : '',
        added.length
          ? `Added sample records for new tools: ${added.join(', ')}. Saved work in other tools is unchanged.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      blocked: false,
    };
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
