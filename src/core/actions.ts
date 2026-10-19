import { getModule } from '../modules';
import type { DemoState, ToolId } from './types';

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

// This shared path is a UI prototype boundary, not server-side authorization.
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
    throw new Error('This record changed. Close it and open the latest version.');
  const reason = request.reason.trim();
  if (reason.length < 5 || reason.length > 500)
    throw new Error('Add a reason between 5 and 500 characters.');
  let result = record;
  let label = 'Note added';
  let before = record.status;
  let after = record.status;
  if (request.kind === 'assignment') {
    if (!module.owners.includes(request.owner)) throw new Error('Choose a listed demo owner.');
    if (request.owner === record.owner) throw new Error('Choose a different owner.');
    result = { ...record, owner: request.owner };
    label = 'Owner reassigned';
    before = record.owner;
    after = request.owner;
  } else if (request.kind !== 'note') {
    const action = module.actions.find((a) => a.id === request.actionId);
    if (!action || !action.available(record))
      throw new Error('This action is no longer available.');
    action.validate?.(record, state.records[module.id]);
    result = action.apply(record);
    label = action.label;
    after = result.status;
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
        id: crypto.randomUUID(),
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
