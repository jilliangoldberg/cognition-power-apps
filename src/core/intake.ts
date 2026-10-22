import { isIsoDay } from './format';
import { isRecord } from './storage';
import type { ToolModule, ToolRecord } from './types';

// Checks submitted form values against the tool's intake fields and builds a new record.
export function buildIntakeRecord(
  module: ToolModule,
  input: Record<string, unknown>,
  existing: ToolRecord[],
  now = new Date(),
): ToolRecord {
  const intake = module.intake;
  if (!intake) throw new Error('This tool does not accept submissions.');
  const values: Record<string, string> = {};
  for (const field of intake.fields) {
    const raw = input[field.key];
    const value = typeof raw === 'string' ? raw.trim() : '';
    const max = field.maxLength ?? (field.kind === 'textarea' ? 1000 : 120);
    if (!value && !field.optional) throw new Error(`${field.label} is required.`);
    if (value.length > max) throw new Error(`${field.label} must be ${max} characters or fewer.`);
    if (value && field.kind === 'select' && !field.options?.includes(value))
      throw new Error(`Choose one of the listed options for ${field.label}.`);
    if (value && field.kind === 'date' && !isIsoDay(value))
      throw new Error(`${field.label} must be a valid date.`);
    values[field.key] = value;
  }
  const highest = existing.reduce((max, record) => {
    const match = record.id.match(new RegExp(`^${intake.idPrefix}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const at = now.toISOString();
  const record: ToolRecord = {
    ...intake.create(values, now),
    id: `${intake.idPrefix}-${String(highest + 1).padStart(3, '0')}`,
    owner: 'Unassigned',
    openedAt: at,
    updatedAt: at,
    version: 1,
  };
  if (
    !isRecord(record) ||
    !Object.hasOwn(module.statuses, record.status) ||
    !module.validateFields(record)
  )
    throw new Error('This submission could not be saved. Check the fields and try again.');
  return record;
}
