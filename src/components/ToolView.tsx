import { useState } from 'react';
import { ageLabel, initials, shortDate } from '../core/format';
import {
  defaultFilters,
  filterRecords,
  loadViews,
  saveViews,
  type RecordFilters,
} from '../core/views';
import type { ToolModule, ToolRecord } from '../core/types';
import { Badge } from './Badge';
import { Icon } from './Icon';
import { openFromRow } from './rowClick';
import { useNow } from '../core/useNow';

export function ToolView({
  module,
  records,
  onSelect,
  currentOwner = 'You',
  filters: controlledFilters,
  onFiltersChange,
  recordHref,
}: {
  module: ToolModule;
  records: ToolRecord[];
  onSelect: (record: ToolRecord) => void;
  currentOwner?: string;
  filters?: RecordFilters;
  onFiltersChange?: (filters: RecordFilters) => void;
  recordHref?: (record: ToolRecord) => string;
}) {
  const [localFilters, setLocalFilters] = useState(defaultFilters);
  const filters = controlledFilters ?? localFilters;
  const setFilters = (next: RecordFilters) => {
    setLocalFilters(next);
    onFiltersChange?.(next);
  };
  const [localViews, setLocalViews] = useState(() => loadViews(module));
  const [viewName, setViewName] = useState('');
  const [viewError, setViewError] = useState('');
  const now = useNow();
  const { search, status, owner, sort, agingOnly } = filters;
  const updateFilters = (change: Partial<RecordFilters>) => setFilters({ ...filters, ...change });
  const owners = Array.from(
    new Set([
      ...module.owners,
      ...records.map((record) => record.owner),
      ...(owner === 'all' ? [] : [owner]),
    ]),
  );
  const visible = filterRecords(records, module, filters, now);
  function storeViews(views: typeof localViews.views) {
    const saved = saveViews(module.id, views);
    setLocalViews({
      views,
      blocked: false,
      warning: saved
        ? ''
        : 'Views are available for this visit only; browser storage is unavailable.',
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="title-line">
            <h1>{module.title}</h1>
          </div>
          <p>{module.description}</p>
        </div>
      </div>
      {recordHref ? (
        <div className="workspace-queue-scope">
          <button
            className="text-button"
            onClick={() => document.getElementById('queue-results')?.focus()}
          >
            {visible.length} matching records · current filters
          </button>
          <button className="text-button" onClick={() => setFilters(defaultFilters)}>
            All {records.length} records · clear filters
          </button>
          <p>Record IDs are stable links you can copy to reference a record.</p>
        </div>
      ) : (
        <div className="metrics">
          {module.metrics(records).map((metric) => (
            <div className="metric" key={metric.label}>
              <span className="metric-label">{metric.label}</span>
              <strong>{metric.value}</strong>
              <span className="metric-hint">{metric.hint}</span>
            </div>
          ))}
        </div>
      )}
      <section
        id="queue-results"
        tabIndex={-1}
        className={`panel records-panel ${recordHref ? 'workspace-local-queue' : ''}`}
        aria-label={module.title}
      >
        <div className="panel-heading">
          <div className="title-line">
            <h2>
              {recordHref ? 'Matching' : 'All'} {module.recordLabel}
            </h2>
            <span className="count-pill">{recordHref ? visible.length : records.length}</span>
          </div>
        </div>
        <div className="table-toolbar">
          <label className="search-input">
            <Icon name="search" size={17} />
            <input
              type="search"
              placeholder={`Search ${module.recordLabel}…`}
              value={search}
              onChange={(event) => updateFilters({ search: event.target.value })}
              maxLength={500}
              aria-label={`Search ${module.recordLabel}`}
            />
            <kbd>/</kbd>
          </label>
          <div className="table-filters">
            <label className="select-wrap">
              <span className="sr-only">Filter by status</span>
              <select
                value={status}
                onChange={(event) => updateFilters({ status: event.target.value })}
              >
                <option value="all">All statuses</option>
                {Object.keys(module.statuses).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <Icon name="down" size={14} />
            </label>
            <label className="select-wrap">
              <span className="sr-only">Filter by owner</span>
              <select
                value={owner}
                onChange={(event) => updateFilters({ owner: event.target.value })}
              >
                <option value="all">All owners</option>
                {owners.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <Icon name="down" size={14} />
            </label>
            <label className="select-wrap">
              <span className="sr-only">Sort records</span>
              <select
                value={sort}
                onChange={(event) =>
                  updateFilters({ sort: event.target.value as RecordFilters['sort'] })
                }
              >
                <option value="updated">Last updated</option>
                <option value="opened">Oldest opened</option>
                <option value="name">Name A–Z</option>
                <option value="id">Record ID</option>
              </select>
              <Icon name="down" size={14} />
            </label>
          </div>
        </div>
        <div className="view-toolbar">
          <div className="view-presets" aria-label="Quick views">
            <button className="button button-secondary" onClick={() => setFilters(defaultFilters)}>
              All records
            </button>
            <button
              className="button button-secondary"
              aria-pressed={owner === currentOwner}
              onClick={() => setFilters({ ...defaultFilters, owner: currentOwner })}
            >
              My records
            </button>
            <button
              className="button button-secondary"
              aria-pressed={owner === 'Unassigned'}
              onClick={() => setFilters({ ...defaultFilters, owner: 'Unassigned' })}
            >
              Unassigned
            </button>
            {module.isOpen && (
              <label className="aging-filter">
                <input
                  type="checkbox"
                  checked={agingOnly}
                  onChange={(event) => updateFilters({ agingOnly: event.target.checked })}
                />{' '}
                Open 48h+
              </label>
            )}
          </div>
          <form
            className="save-view-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (localViews.blocked) return;
              const name = viewName.trim();
              if (!name) {
                setViewError('Enter a view name.');
                return;
              }
              if (localViews.views.some((view) => view.name.toLowerCase() === name.toLowerCase())) {
                setViewError('Choose a unique view name.');
                return;
              }
              if (localViews.views.length >= 8) {
                setViewError('Delete a view before saving another (limit 8 per tool).');
                return;
              }
              storeViews([...localViews.views, { name, filters: { ...filters } }]);
              setViewName('');
              setViewError('');
            }}
          >
            <label className="sr-only" htmlFor="view-name">
              View name
            </label>
            <input
              id="view-name"
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
              placeholder="Name this view…"
              maxLength={40}
              required
            />
            <button className="button button-secondary" disabled={localViews.blocked}>
              Save view
            </button>
          </form>
          <p className="view-help">Views save your filters and sorting.</p>
          {viewError && (
            <p className="form-error" role="alert">
              {viewError}
            </p>
          )}
          {localViews.warning && (
            <p className="view-warning" role="alert">
              {localViews.warning}
            </p>
          )}
          {localViews.blocked && (
            <button className="text-button" onClick={() => storeViews([])}>
              Clear saved views
            </button>
          )}
          {localViews.views.length > 0 && (
            <div className="saved-views" aria-label="Saved local views">
              {localViews.views.map((view) => (
                <span className="saved-view" key={view.name}>
                  <button className="text-button" onClick={() => setFilters({ ...view.filters })}>
                    {view.name}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete view ${view.name}`}
                    onClick={() =>
                      storeViews(
                        localViews.views.filter((candidate) => candidate.name !== view.name),
                      )
                    }
                  >
                    <Icon name="close" size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{module.primaryColumn}</th>
                <th>{module.secondaryColumn}</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Time open</th>
                <th>Updated</th>
                <th>
                  <span className="sr-only">Open record</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((record, index) => (
                <tr
                  key={record.id}
                  className="clickable-row"
                  onClick={openFromRow(() => onSelect(record))}
                >
                  <td>
                    <button
                      className="record-link"
                      data-work-record={`${module.id}:${record.id}`}
                      onClick={() => onSelect(record)}
                      aria-label={`Open ${record.name}`}
                    >
                      <span className={`avatar avatar-${module.recordIcon ? 'icon' : index % 4}`}>
                        {module.recordIcon ? (
                          <Icon name={module.recordIcon} size={18} />
                        ) : (
                          initials(record.name)
                        )}
                      </span>
                      <span>
                        <strong>{record.name}</strong>
                        <small>{record.subtitle}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className="secondary-value">{module.secondaryValue(record)}</span>
                    {recordHref ? (
                      <a
                        className="record-id workspace-record-reference"
                        href={recordHref(record)}
                        aria-label={`Record reference ${record.id}`}
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
                          onSelect(record);
                        }}
                      >
                        {record.id}
                      </a>
                    ) : (
                      <small className="record-id">{record.id}</small>
                    )}
                  </td>
                  <td>
                    <Badge label={record.status} tone={module.statuses[record.status]} />
                  </td>
                  <td>
                    <span className="owner">
                      {record.owner !== 'Unassigned' && (
                        <span className={`owner-dot ${record.owner === 'You' ? 'you' : ''}`} />
                      )}
                      {record.owner}
                    </span>
                  </td>
                  <td
                    className="date-cell"
                    title={
                      record.openedAt ? `Opened ${shortDate(record.openedAt)}` : 'Not recorded'
                    }
                  >
                    {ageLabel(record.openedAt, now)}
                  </td>
                  <td className="date-cell">{shortDate(record.updatedAt)}</td>
                  <td className="row-arrow">
                    <Icon name="chevron" size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="search" size={25} />
            </span>
            <h3>No matching {module.recordLabel}</h3>
            <p>Try another search or clear your filters.</p>
            <button
              className="button button-secondary"
              onClick={() => {
                setFilters(defaultFilters);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        <div className="table-footer">
          <span>
            Showing {visible.length} of {records.length} {module.recordLabel}
          </span>
          <span>
            Open a record to view details <Icon name="arrow" size={14} />
          </span>
        </div>
      </section>
    </>
  );
}
