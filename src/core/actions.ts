import { getModule } from '../modules';
import type { DemoState, ToolId } from './types';
import { randomId } from './id';
import { isRecord } from './storage';

interface ChangeTarget {
  moduleId: ToolId;
  recordId: string;
  expectedVersion: number;
  reason: string;
}

export interface ActionRequest extends ChangeTarget {
  kind?: 'action';
  actionId: string;
}

export type MutationRequest =
  | ActionRequest
  | (ChangeTarget & { kind: 'assignment'; owner: string })
  | (ChangeTarget & { kind: 'note' });

// Domain validation only; this prototype has no authentication or authorization.
export function executeAction(
  state: DemoState,
  request: MutationRequest,
  now = new Date(),
): DemoState {
  const module = getModule(request.moduleId);
  if (!module) throw new Error('Unknown tool.');
  const record = state.records[module.id].find((r) => r.id === request.recordId);
  if (!record) throw new Error('This record no longer exists.');
  if (record.version !== request.expectedVersion)
    throw new Error(
      'This record changed. Review the latest version before retrying; keep your draft.',
    );
  const reason = request.reason.trim();
  if (reason.length < 5 || reason.length > 500)
    throw new Error('Add a reason between 5 and 500 characters.');
  let result = record;
  let label = 'Note added';
  let before = record.status;
  let after = record.status;
  if (request.kind === 'assignment') {
    if (!module.owners.includes(request.owner)) throw new Error('Choose a listed owner.');
    if (request.owner === record.owner) throw new Error('Choose a different owner.');
    result = { ...record, owner: request.owner };
    label = 'Owner reassigned';
    before = record.owner;
    after = request.owner;
  } else if (request.kind !== 'note') {
    const actions = module.localActions ?? module.actions;
    const action = actions.find((a) => a.id === request.actionId);
    if (!action || !action.available(record))
      throw new Error('This action is no longer available.');
    const blocked = action.blockedReason?.(record);
    if (blocked) throw new Error(blocked);
    action.validate?.(record, state.records[module.id]);
    result = action.applyWithContext?.(record, reason) ?? action.apply(record);
    label = action.label;
    after = result.status;
    if (action.history) ({ before, after } = action.history(record, result));
  }
  const updated = { ...result, version: record.version + 1, updatedAt: now.toISOString() };
  return {
    ...state,
    records: {
      ...state.records,
      [module.id]: state.records[module.id].map((r) => (r.id === record.id ? updated : r)),
    },
    activity: [
      {
        id: randomId(),
        kind: request.kind ?? 'action',
        moduleId: module.id,
        recordId: record.id,
        recordName: record.name,
        action: label,
        reason,
        before,
        after,
        at: now.toISOString(),
      },
      ...state.activity,
    ],
  };
}

// Adds one record through a tool's intake form. The tool builds it; the shell checks it fits.
export function submitRecord(
  state: DemoState,
  moduleId: ToolId,
  values: Record<string, string>,
  now = new Date(),
): DemoState {
  const module = getModule(moduleId);
  if (!module?.intake) throw new Error('This tool does not accept new records.');
  const rows = state.records[module.id];
  const at = now.toISOString();
  const record = {
    ...module.intake.create(values, rows, now),
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
    throw new Error('This request could not be saved. Check the fields and try again.');
  if (rows.some((row) => row.id === record.id))
    throw new Error('A record with this ID already exists.');
  return {
    ...state,
    records: { ...state.records, [module.id]: [record, ...rows] },
    activity: [
      {
        id: randomId(),
        kind: 'action',
        moduleId: module.id,
        recordId: record.id,
        recordName: record.name,
        action: 'Submitted',
        reason: 'Submitted through the request form.',
        before: 'New',
        after: record.status,
        at,
      },
      ...state.activity,
    ],
  };
}
