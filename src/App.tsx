import { useCallback, useEffect, useRef, useState } from 'react';
import { getModule, modules } from './modules';
import { executeAction, type MutationRequest } from './core/actions';
import { createFixtures } from './core/fixtures';
import { loadDemo, saveDemo } from './core/storage';
import type { Page, ToolId, ToolRecord } from './core/types';
import { Icon, type IconName } from './components/Icon';
import { Badge } from './components/Badge';
import { Overview } from './components/Overview';
import { ToolView } from './components/ToolView';
import { RecordDrawer } from './components/RecordDrawer';
import { ActivityView } from './components/ActivityView';
import { About } from './components/About';
import { Dialog } from './components/Dialog';
import { customPages } from './features/pages';
import { isToolPage, readRoute, recordRoute, routeHash } from './core/routing';
import { defaultFilters, type RecordFilters } from './core/views';

const pages: Page[] = [
  'overview',
  ...modules.map((module) => module.id),
  ...customPages.map((item) => item.id),
  'activity',
  'about',
];
const currentRoute = () => readRoute(window.location.hash, pages);

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  const { page, selection } = route;
  const queueContexts = useRef<Partial<Record<ToolId, RecordFilters>>>({});
  const priorSelection = useRef(selection);
  const [snapshot, setSnapshot] = useState(loadDemo);
  const data = snapshot.data;
  const dataRef = useRef(data);
  const [writeWarning, setWriteWarning] = useState('');
  const warning = writeWarning || snapshot.warning;
  const [resetOpen, setResetOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const module = isToolPage(page) ? getModule(page) : null;
  const customPage = customPages.find((item) => item.id === page);
  const title =
    module?.shortTitle ??
    customPage?.title ??
    (page === 'overview' ? 'My work' : page === 'activity' ? 'Activity' : 'About prototype');
  const record = selection
    ? data.records[selection.moduleId].find((row) => row.id === selection.id)
    : null;

  function notify(message: string) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }

  const go = useCallback((hash: string, replace = false, state: unknown = null) => {
    window.history[replace ? 'replaceState' : 'pushState'](state, '', hash);
    setRoute(readRoute(hash, pages));
    setMobileOpen(false);
  }, []);

  const navigate = useCallback(
    (next: Page) => {
      go(
        routeHash({
          page: next,
          work: 'mine',
          filters: isToolPage(next)
            ? (queueContexts.current[next] ?? defaultFilters)
            : defaultFilters,
        }),
      );
    },
    [go],
  );

  function recordLink(moduleId: ToolId, row: ToolRecord) {
    const filters =
      page === moduleId ? route.filters : (queueContexts.current[moduleId] ?? defaultFilters);
    return routeHash(recordRoute(route, moduleId, row.id, filters));
  }

  function openRecord(moduleId: ToolId, row: ToolRecord) {
    const hash = recordLink(moduleId, row);
    go(hash, false, {
      workbenchRecord: hash,
      returnHash: routeHash({ ...route, selection: undefined, returnHash: undefined }),
    });
  }

  function closeRecord() {
    const returnHash =
      route.returnHash ?? routeHash({ ...route, selection: undefined, returnHash: undefined });
    if (
      window.history.state?.workbenchRecord === window.location.hash &&
      window.history.state?.returnHash === returnHash
    ) {
      window.history.back();
    } else go(returnHash, true);
  }

  useEffect(() => {
    const update = () => {
      setRoute(currentRoute());
      setMobileOpen(false);
    };
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  useEffect(() => {
    if (isToolPage(route.page)) queueContexts.current[route.page] = route.filters;
  }, [route]);
  useEffect(() => {
    if (priorSelection.current && !selection) {
      const key = `${priorSelection.current.moduleId}:${priorSelection.current.id}`;
      const target = Array.from(document.querySelectorAll<HTMLElement>('[data-work-record]')).find(
        (element) => element.dataset.workRecord === key,
      );
      (target ?? document.getElementById('main-content'))?.focus();
    }
    priorSelection.current = selection;
  }, [selection]);
  useEffect(() => {
    if (snapshot.blocked) return;
    setWriteWarning(
      saveDemo(data)
        ? ''
        : 'Browser storage is unavailable. Changes will last only until this page is reloaded.',
    );
  }, [data, snapshot.blocked]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName) &&
        !document.querySelector('dialog[open]')
      ) {
        const search = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', shortcut);
    return () => {
      document.removeEventListener('keydown', shortcut);
      clearTimeout(toastTimer.current);
    };
  }, []);

  function onAction(request: MutationRequest) {
    try {
      const next = executeAction(dataRef.current, request);
      dataRef.current = next;
      setSnapshot((current) => ({ ...current, data: next }));
      notify(`${next.activity[0].action} recorded in local demo.`);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not apply this change.';
    }
  }

  function reset() {
    const fresh = createFixtures();
    dataRef.current = fresh;
    setSnapshot({ data: fresh, blocked: false, warning: '' });
    setWriteWarning('');
    if (selection)
      go(
        route.returnHash ?? routeHash({ ...route, selection: undefined, returnHash: undefined }),
        true,
      );
    setResetOpen(false);
    notify('Original local tools reset. Vendor demo is unchanged.');
  }

  function navItem(id: Page, label: string, icon: IconName) {
    return (
      <a
        key={id}
        href={`#${id}`}
        className={`nav-item ${page === id ? 'active' : ''}`}
        aria-current={page === id ? 'page' : undefined}
        onClick={(event) => {
          event.preventDefault();
          navigate(id);
        }}
      >
        <Icon name={icon} size={19} />
        <span>{label}</span>
      </a>
    );
  }

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      {mobileOpen && (
        <button
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside id="workspace-navigation" className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <a
          className="brand"
          href="#overview"
          onClick={(event) => {
            event.preventDefault();
            navigate('overview');
          }}
        >
          <span className="brand-mark">
            <Icon name="box" size={22} />
          </span>
          <span>
            workbench<span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">W</span>
          <div>
            <strong>Demo workspace</strong>
            <span>Internal operations</span>
          </div>
          <Badge label="v0.2" dot={false} />
        </div>
        <nav aria-label="Workspace">
          <p className="nav-label">WORKSPACE</p>
          {navItem('overview', 'My work', 'grid')}
          <p className="nav-label nav-label-tools">YOUR TOOLS</p>
          {modules.map((item) => navItem(item.id, item.shortTitle, item.icon))}
          <p className="nav-label nav-label-tools">EXTENSION PROOFS</p>
          {customPages.map((item) => navItem(item.id, item.title, item.icon))}
          <p className="nav-label nav-label-tools">MANAGE</p>
          {navItem('activity', 'Activity', 'activity')}
          {navItem('about', 'About prototype', 'code')}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox-card">
            <span className="sandbox-light" />
            <strong>A safe place to explore</strong>
            <p>
              Synthetic data. No live systems.
              <br />
              Make a change, then reset.
            </p>
            <button className="text-button" onClick={() => setResetOpen(true)}>
              <Icon name="reset" size={14} /> Reset demo data
            </button>
          </div>
          <div className="demo-user">
            <span className="user-avatar">D</span>
            <div>
              <strong>Demo operator</strong>
              <span>Local session · No sign-in</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button menu-button"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <Icon name="chevron" size={12} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-indicator">
              <span /> {page === 'investigation' ? 'Synthetic evidence' : 'Local demo'}
            </span>
            <span className="topbar-divider" />
            <span className="subtle">Synthetic data only</span>
            <span className="topbar-divider" />
            <button className="text-button" onClick={() => setSignInOpen(true)}>
              <Icon name="identity" size={14} />
              Sign in
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {warning && (
            <div className="warning-banner" role="alert">
              <Icon name="info" size={18} />
              <p>{warning}</p>
              <button className="text-button" onClick={() => setResetOpen(true)}>
                Reset demo
              </button>
            </div>
          )}
          {(route.error || (selection && !record)) && (
            <div className="warning-banner" role="alert">
              <Icon name="info" size={18} />
              <p>
                {route.error ??
                  `Record ${selection?.id} was not found in this browser’s local dataset. It may have been removed or may exist only in another browser. No record was opened.`}
              </p>
              <button
                className="text-button"
                onClick={() =>
                  go(
                    route.returnHash ??
                      routeHash({
                        ...route,
                        selection: undefined,
                        returnHash: undefined,
                        error: undefined,
                      }),
                    true,
                  )
                }
              >
                Return to{' '}
                {route.returnHash?.startsWith('#overview')
                  ? 'My work'
                  : module
                    ? 'queue'
                    : 'My work'}
              </button>
            </div>
          )}
          {page === 'overview' && (
            <Overview
              data={data}
              navigate={navigate}
              view={route.work}
              onViewChange={(work) => go(routeHash({ ...route, work }))}
              recordHref={recordLink}
              onSelect={openRecord}
            />
          )}
          {customPage && <customPage.View />}
          {module && (
            <ToolView
              key={module.id}
              module={module}
              records={data.records[module.id]}
              filters={route.filters}
              onFiltersChange={(filters) =>
                go(routeHash({ ...route, filters }), true, window.history.state)
              }
              recordHref={(row) => recordLink(module.id, row)}
              onSelect={(row: ToolRecord) => openRecord(module.id, row)}
            />
          )}
          {page === 'activity' && <ActivityView activity={data.activity} />}
          {page === 'about' && <About />}
          <footer className="workspace-footer">
            <span>
              WORKBENCH <span className="footer-dot">/</span> PROTOTYPE 0.3
            </span>
          </footer>
        </main>
      </div>
      {selection && record && (
        <RecordDrawer
          key={`${selection.moduleId}-${selection.id}`}
          module={getModule(selection.moduleId)}
          record={record}
          records={data.records[selection.moduleId]}
          activity={data.activity.filter(
            (event) => event.moduleId === selection.moduleId && event.recordId === record.id,
          )}
          onClose={closeRecord}
          onAction={onAction}
        />
      )}
      {resetOpen && (
        <Dialog
          title="Reset this workspace?"
          subtitle="LOCAL DEMO"
          onClose={() => setResetOpen(false)}
        >
          <div className="reset-body">
            <p>
              This restores the current synthetic sample and clears local assignments, notes, and
              activity. Saved views are kept. Record changes in this browser will be lost. Shared
              KYC records and server history are not affected. Vendor requests have their own reset
              on the Vendor approvals page and are not affected here.
            </p>
            <div className="action-buttons">
              <button className="button button-secondary" onClick={() => setResetOpen(false)}>
                Keep exploring
              </button>
              <button className="button button-danger" onClick={reset}>
                Reset demo data
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {signInOpen && (
        <Dialog
          title="Sign-in isn't part of this demo"
          subtitle="ACCESS"
          onClose={() => setSignInOpen(false)}
        >
          <div className="reset-body">
            <p>
              This prototype has no sign-in. Everyone uses it as the demo operator and can see every
              tool. In production, everyone would sign in through your identity provider (SSO), with
              access set per tool and enforced on the server. That is planned for the pilot.
            </p>
            <div className="action-buttons">
              <button className="button button-secondary" onClick={() => setSignInOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </Dialog>
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <span className="toast-check">
              <Icon name="check" size={16} />
            </span>
            {toast}
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setToast('')}
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
