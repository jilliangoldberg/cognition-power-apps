import { modules } from '../modules';
import type { DemoState, ToolModule, ToolRecord } from './types';
import { actionBlock } from './eligibility';

export const workViews = {
  mine: {
    title: 'Assigned actionable',
    description:
      'Open decision work assigned to the local “You” label, excluding waiting/blocked items.',
  },
  unassigned: {
    title: 'Unassigned backlog',
    description: 'All open, unassigned local queue items, including any waiting/blocked items.',
  },
  waiting: {
    title: 'Waiting / blocked',
    description:
      'Open waiting or escalated cases, read-only refund examples, and guarded decisions, for any owner.',
  },
};
export type WorkView = keyof typeof workViews;
export const isWorkView = (value: string | null): value is WorkView =>
  value !== null && Object.hasOwn(workViews, value);

export interface WorkItem {
  module: ToolModule;
  record: ToolRecord;
  waiting: boolean;
  reason: string;
}

export function workspaceItems(data: DemoState): WorkItem[] {
  return modules
    .flatMap((module) =>
      data.records[module.id]
        .filter((record) => module.isOpen?.(record))
        .map((record) => {
          const available = (module.localActions ?? module.actions).filter((action) =>
            action.available(record),
          );
          const blockedReason = available
            .map((action) => actionBlock(action, record, data.records[module.id]))
            .find(Boolean);
          const waiting =
            record.status === 'Waiting for information' ||
            record.status === 'Escalated' ||
            available.length === 0 ||
            Boolean(blockedReason);
          const reason =
            blockedReason ||
            (available.length === 0
              ? (module.noActionMessage?.(record) ?? 'No decision action is currently available.')
              : String(
                  record.fields.nextStep ??
                    record.fields.summary ??
                    'Review context and record a local decision.',
                ));
          return { module, record, waiting, reason };
        }),
    )
    .sort(
      (a, b) =>
        (a.record.openedAt ?? a.record.updatedAt).localeCompare(
          b.record.openedAt ?? b.record.updatedAt,
        ) || a.record.id.localeCompare(b.record.id),
    );
}

export function workItemsForView(items: WorkItem[], view: WorkView): WorkItem[] {
  return items.filter(({ record, waiting }) =>
    view === 'mine'
      ? record.owner === 'You' && !waiting
      : view === 'unassigned'
        ? record.owner === 'Unassigned'
        : waiting,
  );
}
