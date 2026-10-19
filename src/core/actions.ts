import { getModule } from '../modules';
import type { DemoState, ToolId } from './types';

export interface ActionRequest {
  moduleId: ToolId;
  recordId: string;
  actionId: string;
  expectedVersion: number;
  reason: string;
}

// This shared path is a UI prototype boundary, not server-side authorization.
export function executeAction(
  state: DemoState,
  request: ActionRequest,
  now = new Date(),
): DemoState {
  const module = getModule(request.moduleId);
  if (!module) throw new Error('Unknown tool.');
  const record = state.records[module.id].find((r) => r.id === request.recordId);
  if (!record) throw new Error('This record no longer exists.');
  if (record.version !== request.expectedVersion)
    throw new Error('This record changed. Close it and open the latest version.');
  const action = module.actions.find((a) => a.id === request.actionId);
  if (!action || !action.available(record)) throw new Error('This action is no longer available.');
  const reason = request.reason.trim();
  if (reason.length < 5 || reason.length > 500)
    throw new Error('Add a reason between 5 and 500 characters.');
  const result = action.apply(record);
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
        moduleId: module.id,
        recordId: record.id,
        recordName: record.name,
        action: action.label,
        reason,
        before: record.status,
        after: updated.status,
        at: now.toISOString(),
      },
      ...state.activity,
    ],
  };
}
