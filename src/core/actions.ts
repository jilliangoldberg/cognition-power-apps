import { getModule } from '../modules';
import type { DemoState, ToolId } from './types';
import { randomId } from './id';

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

// Domain validation only. The API separately authenticates and authorizes callers.
export function executeAction(
  state: DemoState,
  request: MutationRequest,
  now = new Date(),
  owners?: string[],
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
    if (!(owners ?? module.owners).includes(request.owner))
      throw new Error('Choose a listed owner.');
    if (request.owner === record.owner) throw new Error('Choose a different owner.');
    result = { ...record, owner: request.owner };
    label = 'Owner reassigned';
    before = record.owner;
    after = request.owner;
  } else if (request.kind !== 'note') {
    // Shared KYC supplies its server owner list and retains its existing command semantics.
    const actions = owners === undefined ? (module.localActions ?? module.actions) : module.actions;
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
