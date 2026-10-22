import { getModule, modules } from '../modules';
import { isRecordId } from './id';
import type { Page, ToolId } from './types';
import { defaultFilters, queueFilterParams, readQueueFilters, type RecordFilters } from './views';
import { isWorkView, type WorkView } from './workspace';

export interface WorkspaceRoute {
  page: Page;
  filters: RecordFilters;
  work: WorkView;
  selection?: { moduleId: ToolId; id: string };
  returnHash?: string;
  error?: string;
}

export const isToolPage = (page: Page): page is ToolId =>
  modules.some((module) => module.id === page);

export function readRoute(hash: string, pages: Page[]): WorkspaceRoute {
  const fallback: WorkspaceRoute = {
    page: 'overview',
    filters: { ...defaultFilters },
    work: 'mine',
  };
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const [pageId, encodedId, ...extra] = path.split('/');
  const page = pages.find((candidate) => candidate === (pageId || 'overview'));
  if (!page)
    return { ...fallback, error: 'Unknown workspace link. Choose a tool or a local work view.' };
  const params = new URLSearchParams(query);
  const work = params.get('work');
  const route: WorkspaceRoute = {
    ...fallback,
    page,
    work: isWorkView(work) ? work : 'mine',
    filters: isToolPage(page) ? readQueueFilters(getModule(page), params) : { ...defaultFilters },
  };
  if (encodedId !== undefined) {
    try {
      const id = decodeURIComponent(encodedId);
      if (!isToolPage(page) || !isRecordId(id) || extra.length > 0)
        throw new Error('Invalid record link');
      route.selection = { moduleId: page, id };
    } catch {
      route.error = 'Invalid record link. No record was opened.';
    }
  }
  const from = params.get('from');
  if (from?.startsWith('#') && from.length <= 3000) {
    const [returnPath, returnQuery = ''] = from.slice(1).split('?');
    const returnPage = pages.find((candidate) => candidate === returnPath);
    if (returnPage && (returnPage === 'overview' || isToolPage(returnPage))) {
      const returnParams = new URLSearchParams(returnQuery);
      const returnWork = returnParams.get('work');
      route.returnHash = routeHash({
        page: returnPage,
        work: isWorkView(returnWork) ? returnWork : 'mine',
        filters: isToolPage(returnPage)
          ? readQueueFilters(getModule(returnPage), returnParams)
          : { ...defaultFilters },
      });
    }
  }
  return route;
}

export function routeHash(route: WorkspaceRoute): string {
  const params = isToolPage(route.page) ? queueFilterParams(route.filters) : new URLSearchParams();
  if (route.page === 'overview' && route.work !== 'mine') params.set('work', route.work);
  if (route.selection && route.returnHash) params.set('from', route.returnHash);
  const id = route.selection ? `/${encodeURIComponent(route.selection.id)}` : '';
  const query = params.toString();
  return `#${route.page}${id}${query ? `?${query}` : ''}`;
}

export function recordRoute(
  route: WorkspaceRoute,
  moduleId: ToolId,
  id: string,
  filters: RecordFilters,
): WorkspaceRoute {
  return {
    page: moduleId,
    filters,
    work: route.work,
    selection: { moduleId, id },
    returnHash: routeHash({ ...route, selection: undefined, returnHash: undefined }),
  };
}
