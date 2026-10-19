import type { ToolId, ToolModule, ToolRecord } from './types';

export interface RecordFilters {
  search: string;
  status: string;
  owner: string;
  sort: 'updated' | 'opened' | 'name' | 'id';
  agingOnly: boolean;
}

export interface SavedView {
  name: string;
  filters: RecordFilters;
}

const temporaryViews = new Map<string, SavedView[]>();
const temporaryWarning = 'Views are available for this visit only; browser storage is unavailable.';
export const clearViewSession = () => temporaryViews.clear();
const copyViews = (views: SavedView[]) =>
  views.map((view) => ({ ...view, filters: { ...view.filters } }));

export const defaultFilters: RecordFilters = {
  search: '',
  status: 'all',
  owner: 'all',
  sort: 'updated',
  agingOnly: false,
};
export const viewsKey = (id: ToolId, namespace?: string) =>
  `workbench.views.v1.${namespace ? `${namespace}.` : ''}${id}`;

export function filterRecords(
  records: ToolRecord[],
  module: ToolModule,
  filters: RecordFilters,
  now = new Date(),
) {
  const query = filters.search.trim().toLowerCase();
  return records
    .filter(
      (record) =>
        (filters.status === 'all' || record.status === filters.status) &&
        (filters.owner === 'all' || record.owner === filters.owner) &&
        (!filters.agingOnly ||
          (module.isOpen?.(record) &&
            record.openedAt &&
            now.getTime() - Date.parse(record.openedAt) >= 48 * 3_600_000)) &&
        [
          record.id,
          record.name,
          record.subtitle,
          record.status,
          record.owner,
          ...Object.values(record.fields),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
    )
    .sort((a, b) =>
      filters.sort === 'name'
        ? a.name.localeCompare(b.name)
        : filters.sort === 'id'
          ? a.id.localeCompare(b.id)
          : filters.sort === 'opened'
            ? (a.openedAt ? Date.parse(a.openedAt) : Number.MAX_SAFE_INTEGER) -
              (b.openedAt ? Date.parse(b.openedAt) : Number.MAX_SAFE_INTEGER)
            : b.updatedAt.localeCompare(a.updatedAt),
    );
}

export function loadViews(
  module: ToolModule,
  namespace?: string,
): {
  views: SavedView[];
  warning: string;
  blocked: boolean;
} {
  const cached = temporaryViews.get(viewsKey(module.id, namespace));
  if (cached) return { views: copyViews(cached), warning: temporaryWarning, blocked: false };
  try {
    const raw = localStorage.getItem(viewsKey(module.id, namespace));
    if (raw === null) return { views: [], warning: '', blocked: false };
    const value: unknown = JSON.parse(raw);
    if (
      !Array.isArray(value) ||
      value.length > 8 ||
      !value.every((view) => {
        const f = view?.filters;
        return (
          typeof view?.name === 'string' &&
          view.name.trim().length > 0 &&
          view.name.length <= 40 &&
          f &&
          typeof f.search === 'string' &&
          f.search.length <= 500 &&
          typeof f.owner === 'string' &&
          (f.status === 'all' || Object.hasOwn(module.statuses, f.status)) &&
          ['updated', 'opened', 'name', 'id'].includes(f.sort) &&
          typeof f.agingOnly === 'boolean'
        );
      }) ||
      new Set(value.map((view: SavedView) => view.name.toLowerCase())).size !== value.length
    )
      throw new Error('Invalid saved views');
    return { views: value, warning: '', blocked: false };
  } catch {
    return {
      views: [],
      warning:
        'Saved views could not be loaded and have not been overwritten. Clear saved views to start fresh.',
      blocked: true,
    };
  }
}

export function saveViews(id: ToolId, views: SavedView[], namespace?: string): boolean {
  const key = viewsKey(id, namespace);
  try {
    localStorage.setItem(key, JSON.stringify(views));
    temporaryViews.delete(key);
    return true;
  } catch {
    temporaryViews.set(key, copyViews(views));
    return false;
  }
}
