import { useState } from 'react';
import { modules } from '../modules';
import { customPages } from '../features/pages';
import type { DemoState, Page, ToolId, ToolRecord } from '../core/types';
import { ageLabel } from '../core/format';
import { workspaceItems, workItemsForView, workViews, type WorkView } from '../core/workspace';
import { Icon } from './Icon';
import { Badge } from './Badge';
import { openFromRow } from './rowClick';

const pageDescriptions: Record<(typeof customPages)[number]['id'], string> = {
  investigation: 'Look up a transaction and review its evidence.',
  vendors: 'Take a vendor request through Finance, Security, and Legal reviews.',
};

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
  const next = workItemsForView(items, 'mine')[0];
  const directory = [
    ...modules.map((module) => ({
      id: module.id,
      title: module.title,
      description: module.description,
    })),
    ...customPages.map((page) => ({
      id: page.id,
      title: page.title,
      description: pageDescriptions[page.id],
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
          <h1>My work</h1>
          <p>
            {next
              ? 'Pick up where you left off, or grab something from the backlog.'
              : 'You’re all caught up. Grab something from the backlog.'}
          </p>
        </div>
        {next && (
          <button
            className="button button-soft"
            onClick={() => onSelect(next.module.id, next.record)}
          >
            Start next item <Icon name="arrow" size={14} />
          </button>
        )}
      </div>
      <nav className="work-counts" aria-label="Work views">
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
            <small>{workViews[key].hint}</small>
          </a>
        ))}
      </nav>
      <section className="panel work-list" aria-labelledby="work-title">
        <div className="panel-heading">
          <h2 id="work-title">
            {workViews[view].title} <span className="count-pill">{visible.length}</span>
          </h2>
          <span className="subtle">Oldest first</span>
        </div>
        <p className="work-list-help">{workViews[view].description}</p>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">{workViews[view].title}</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Next step</th>
                <th scope="col">Status</th>
                <th scope="col">Owner</th>
                <th scope="col">Age</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ module, record, reason }) => (
                <tr
                  key={`${module.id}-${record.id}`}
                  className="clickable-row"
                  onClick={openFromRow(() => onSelect(module.id, record))}
                >
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
            <h3>Nothing here right now</h3>
            <p>Check another view or open a tool below.</p>
          </div>
        )}
      </section>
      <section className="work-directory" aria-labelledby="directory-title">
        <div className="section-heading">
          <h2 id="directory-title">Tool directory</h2>
          <span className="subtle">Open a full queue or page</span>
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
            </li>
          ))}
        </ul>
        {directory.length === 0 && <p>No tools match that search.</p>}
      </section>
    </div>
  );
}
