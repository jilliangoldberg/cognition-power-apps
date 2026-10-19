import { useCallback, useEffect, useRef, useState } from 'react';
import { getModule, modules } from './modules';
import { executeAction, type ActionRequest } from './core/actions';
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

const isTool = (page: Page): page is ToolId => modules.some((module) => module.id === page);
const pages: Page[] = ['overview', ...modules.map((module) => module.id), 'activity', 'about'];
const readPage = (): Page =>
  pages.find((page) => `#${page}` === window.location.hash) ?? 'overview';

export default function App() {
  const [page, setPage] = useState<Page>(readPage);
  const [snapshot, setSnapshot] = useState(loadDemo);
  const data = snapshot.data;
  const dataRef = useRef(data);
  const [warning, setWarning] = useState(snapshot.warning);
  const [selection, setSelection] = useState<{ moduleId: ToolId; id: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const module = isTool(page) ? getModule(page) : null;
  const title =
    module?.shortTitle ??
    (page === 'overview' ? 'Overview' : page === 'activity' ? 'Activity' : 'About prototype');
  const record = selection
    ? data.records[selection.moduleId].find((row) => row.id === selection.id)
    : null;

  function notify(message: string) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }

  const navigate = useCallback((next: Page) => {
    window.location.hash = next;
    setPage(next);
    setSelection(null);
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    const update = () => {
      setPage(readPage());
      setSelection(null);
      setMobileOpen(false);
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    if (snapshot.blocked) return;
    if (!saveDemo(data))
      setWarning(
        'Browser storage is unavailable. Changes will last only until this page is reloaded.',
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

  function onAction(request: ActionRequest) {
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
    setWarning('');
    setSelection(null);
    setResetOpen(false);
    notify('Demo reset. You’re back to the starting dataset.');
  }

  function navItem(id: Page, label: string, icon: IconName, count?: number) {
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
        {count !== undefined && <span className="nav-count">{count}</span>}
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
          <Badge label="v0.1" dot={false} />
        </div>
        <nav aria-label="Workspace">
          <p className="nav-label">WORKSPACE</p>
          {navItem('overview', 'Overview', 'grid')}
          <p className="nav-label nav-label-tools">YOUR TOOLS</p>
          {modules.map((item) =>
            navItem(item.id, item.shortTitle, item.icon, data.records[item.id].length),
          )}
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
              <span /> Local demo
            </span>
            <span className="topbar-divider" />
            <span className="subtle">Synthetic data only</span>
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
          {page === 'overview' && <Overview data={data} navigate={navigate} />}
          {module && (
            <ToolView
              key={module.id}
              module={module}
              records={data.records[module.id]}
              onSelect={(row: ToolRecord) => setSelection({ moduleId: module.id, id: row.id })}
            />
          )}
          {page === 'activity' && <ActivityView activity={data.activity} />}
          {page === 'about' && <About />}
          <footer className="workspace-footer">
            <span>
              WORKBENCH <span className="footer-dot">/</span> PROTOTYPE 0.1
            </span>
            <span>Built to start small. Designed to grow.</span>
          </footer>
        </main>
      </div>
      {selection && record && (
        <RecordDrawer
          key={`${selection.moduleId}-${selection.id}`}
          module={getModule(selection.moduleId)}
          record={record}
          activity={data.activity.filter(
            (event) => event.moduleId === selection.moduleId && event.recordId === record.id,
          )}
          onClose={() => setSelection(null)}
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
              This restores the starting synthetic records and clears all local activity. Changes in
              this browser will be lost.
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
