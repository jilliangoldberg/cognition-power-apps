import { useState } from 'react';
import { modules } from '../modules';
import { customPages } from '../features/pages';
import type { DemoState, Page, ToolId, ToolRecord } from '../core/types';
import { ageLabel } from '../core/format';
import { workspaceItems, workItemsForView, workViews, type WorkView } from '../core/workspace';
import { Icon } from './Icon';
import { Badge } from './Badge';

export function Overview({
  data,
  navigate,
  view,
  onViewChange,
  recordHref,
  onSelect,
}: {
  data: DemoState;
  navigate: (page: Page) => void;
  view: WorkView;
  onViewChange: (view: WorkView) => void;
  recordHref: (moduleId: ToolId, record: ToolRecord) => string;
  onSelect: (moduleId: ToolId, record: ToolRecord) => void;
}) {
  const [directorySearch, setDirectorySearch] = useState('');
  const items = workspaceItems(data);
  const visible = workItemsForView(items, view);
  const directory = [
    ...modules.map((module) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      scope: 'Browser-local synthetic records',
    })),
    ...customPages.map((page) => ({
      id: page.id,
      title: page.title,
      description:
        page.id === 'investigation'
          ? 'Read-only synthetic evidence, separate from queue records.'
          : 'Independent server dataset; demo password sign-in required.',
      scope:
        page.id === 'investigation'
          ? 'Stateless synthetic evidence'
          : 'Shared synthetic workspace · excluded from local counts',
    })),
  ].filter((item) =>
    `${item.title} ${item.description}`
      .toLowerCase()
      .includes(directorySearch.trim().toLowerCase()),
  );
  return (
    <div className="work-home">
      <div className="page-heading overview-heading">
        <div>
          <p className="eyebrow">SYNTHETIC · BROWSER-LOCAL WORK</p>
          <h1>My work</h1>
          <p>Find a next item, allocate unassigned work, or inspect what is waiting.</p>
        </div>
        <Badge label="Local demo · not shared" dot={false} />
      </div>
      <p className="work-scope">
        “You” is the current demo owner label, not an authenticated identity. Counts use only this
        browser’s KYC and refund queues; Shared KYC and Investigation are independent. Flags are
        configurations, not pending tasks. No separate approver queue or independent-review
        permission is modeled.
      </p>
      <nav className="work-counts" aria-label="Local work views">
        {(Object.keys(workViews) as WorkView[]).map((key) => (
          <a
            className={`work-count ${view === key ? 'selected' : ''}`}
            href={`#overview?work=${key}`}
            aria-current={view === key ? 'page' : undefined}
            key={key}
            onClick={(event) => {
              event.preventDefault();
              onViewChange(key);
            }}
          >
            <span>{workViews[key].title}</span>
            <strong>{workItemsForView(items, key).length}</strong>
            <small>Local records · view exact list</small>
          </a>
        ))}
      </nav>
      <section className="panel work-list" aria-labelledby="work-title">
        <div className="panel-heading">
          <h2 id="work-title">
            {workViews[view].title} <span className="count-pill">{visible.length}</span>
          </h2>
          <span className="subtle">Oldest opened first · not an SLA</span>
        </div>
        <div className="work-list-help">
          <p>{workViews[view].description}</p>
          <p>
            Unassigned waiting items appear in both views. Open a record to review its module rules;
            this list does not authorize a decision.
          </p>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">{workViews[view].title} · local synthetic records</caption>
            <thead>
              <tr>
                <th scope="col">Record / tool</th>
                <th scope="col">Why it needs attention</th>
                <th scope="col">Status</th>
                <th scope="col">Local owner</th>
                <th scope="col">Opened age</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ module, record, reason }) => (
                <tr key={`${module.id}-${record.id}`}>
                  <td>
                    <a
                      className="work-record-link"
                      data-work-record={`${module.id}:${record.id}`}
                      href={recordHref(module.id, record)}
                      onClick={(event) => {
                        if (
                          event.button !== 0 ||
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return;
                        event.preventDefault();
                        onSelect(module.id, record);
                      }}
                    >
                      <strong>{record.name}</strong>
                      <span>
                        {record.id} · {module.shortTitle}
                      </span>
                    </a>
                  </td>
                  <td className="work-reason">{reason}</td>
                  <td>
                    <Badge label={record.status} tone={module.statuses[record.status]} />
                  </td>
                  <td>{record.owner}</td>
                  <td>{ageLabel(record.openedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <div className="empty-state">
            <h3>No local items in this view</h3>
            <p>Try another work view or use the tool directory below.</p>
          </div>
        )}
        <p className="work-list-help">
          Showing all {visible.length} matching local records. Record names are stable links: copy
          their link address to send a reference. Another browser needs its own matching local
          sample; no shared handoff is implemented.
        </p>
      </section>
      <section className="work-directory" aria-labelledby="directory-title">
        <div className="section-heading">
          <h2 id="directory-title">Tool directory</h2>
          <span className="subtle">Open a tool when you need its full queue or custom page</span>
        </div>
        <label className="search-input">
          <Icon name="search" size={17} />
          <input
            type="search"
            aria-label="Search tool directory"
            placeholder="Find a tool…"
            value={directorySearch}
            onChange={(event) => setDirectorySearch(event.target.value)}
            maxLength={100}
          />
        </label>
        <ul>
          {directory.map((item) => (
            <li key={item.id}>
              <button className="text-button" onClick={() => navigate(item.id)}>
                {item.title} <Icon name="arrow" size={14} />
              </button>
              <p>{item.description}</p>
              <small>{item.scope}</small>
            </li>
          ))}
        </ul>
        {directory.length === 0 && <p>No tools match that search.</p>}
      </section>
      <div className="page-note">
        <Icon name="info" size={16} />
        <span>
          Local notes and actions are demo activity, not authenticated audit history.{' '}
          <button className="text-button" onClick={() => navigate('activity')}>
            View local activity
          </button>{' '}
          ·{' '}
          <button className="text-button" onClick={() => navigate('about')}>
            About prototype
          </button>
        </span>
      </div>
    </div>
  );
}
