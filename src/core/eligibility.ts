import type { RecordAction, ToolRecord } from './types';

export function actionBlock(
  action: RecordAction,
  record: ToolRecord,
  records: ToolRecord[] = [record],
): string | undefined {
  try {
    const blocked = action.blockedReason?.(record);
    if (blocked) return blocked;
    action.validate?.(record, records);
  } catch (error) {
    return error instanceof Error ? error.message : 'This action is blocked by a module rule.';
  }
}
