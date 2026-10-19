import { useState } from 'react';
import { initials, shortDate } from '../core/format';
import type { ToolModule, ToolRecord } from '../core/types';
import { Badge } from './Badge';
import { Icon } from './Icon';

export function ToolView({
  module,
  records,
  onSelect,
}: {
  module: ToolModule;
  records: ToolRecord[];
  onSelect: (record: ToolRecord) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('updated');
  const query = search.trim().toLowerCase();
  const visible = records
    .filter(
      (record) =>
        (status === 'all' || record.status === status) &&
        [
          record.name,
          record.subtitle,
          record.id,
          record.owner,
          record.status,
          module.secondaryValue(record),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'id'
          ? a.id.localeCompare(b.id)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="title-line">
            <h1>{module.title}</h1>
            <Badge label="Demo" tone="purple" dot={false} />
          </div>
          <p>{module.description}</p>
        </div>
      </div>
      <div className="metrics">
        {module.metrics(records).map((metric) => (
          <div className="metric" key={metric.label}>
            <span className="metric-label">{metric.label}</span>
            <strong>{metric.value}</strong>
            <span className="metric-hint">{metric.hint}</span>
          </div>
        ))}
      </div>
      <section className="panel records-panel" aria-label={module.title}>
        <div className="panel-heading">
          <div className="title-line">
            <h2>All {module.recordLabel}</h2>
            <span className="count-pill">{records.length}</span>
          </div>
          <span className="subtle panel-hint">
            <Icon name="box" size={14} /> Synthetic dataset
          </span>
        </div>
        <div className="table-toolbar">
          <label className="search-input">
            <Icon name="search" size={17} />
            <input
              type="search"
              placeholder={`Search ${module.recordLabel}…`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={`Search ${module.recordLabel}`}
            />
            <kbd>/</kbd>
          </label>
          <div className="table-filters">
            <label className="select-wrap">
              <span className="sr-only">Filter by status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All statuses</option>
                {Object.keys(module.statuses).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <Icon name="down" size={14} />
            </label>
            <label className="select-wrap">
              <span className="sr-only">Sort records</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="updated">Last updated</option>
                <option value="name">Name A–Z</option>
                <option value="id">Record ID</option>
              </select>
              <Icon name="down" size={14} />
            </label>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{module.primaryColumn}</th>
                <th>{module.secondaryColumn}</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Updated</th>
                <th>
                  <span className="sr-only">Open record</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((record, index) => (
                <tr key={record.id}>
                  <td>
                    <button
                      className="record-link"
                      onClick={() => onSelect(record)}
                      aria-label={`Open ${record.name}`}
                    >
                      <span
                        className={`avatar avatar-${module.id === 'flags' ? 'flag' : index % 4}`}
                      >
                        {module.id === 'flags' ? (
                          <Icon name="flag" size={18} />
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
                    <small className="record-id">{record.id}</small>
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
                setSearch('');
                setStatus('all');
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
      <div className="page-note">
        <Icon name="info" size={16} />
        <span>Local demo only. Changes are saved in this browser, not shared with a team.</span>
      </div>
    </>
  );
}
