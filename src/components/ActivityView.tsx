import { useState } from 'react';
import { getModule, modules } from '../modules';
import type { Activity } from '../core/types';
import { dateTime } from '../core/format';
import { Icon } from './Icon';
import { Badge } from './Badge';

export function ActivityView({ activity }: { activity: Activity[] }) {
  const [filter, setFilter] = useState('all');
  const visible = activity.filter((event) => filter === 'all' || event.moduleId === filter);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Activity</h1>
          <p>Every decision, note, and reassignment, with its reason.</p>
        </div>
      </div>
      <div className="notice activity-notice">
        <Icon name="info" size={18} />
        <p>
          Activity is stored in this browser and cleared when you reset the demo. It isn’t a
          compliance-grade audit log.
        </p>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div className="title-line">
            <h2>Workspace activity</h2>
            <span className="count-pill">{activity.length}</span>
          </div>
          <label className="select-wrap">
            <span className="sr-only">Filter activity by tool</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All tools</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.shortTitle}
                </option>
              ))}
            </select>
            <Icon name="down" size={14} />
          </label>
        </div>
        {visible.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="activity" size={26} />
            </span>
            <h3>No activity yet</h3>
            <p>
              {filter === 'all'
                ? 'Take an action in one of your tools to get started.'
                : 'No changes have been made in this tool.'}
            </p>
          </div>
        ) : (
          <div className="activity-list">
            {visible.map((event) => (
              <article key={event.id} className="activity-item">
                <span className="activity-dot">
                  <Icon name="check" size={12} />
                </span>
                <div className="activity-item-body">
                  <div className="activity-item-title">
                    <h3>{event.action}</h3>
                    <Badge label={getModule(event.moduleId).shortTitle} dot={false} />
                  </div>
                  <p>
                    {event.recordName} <span className="subtle">· {event.recordId}</span>
                  </p>
                  {event.kind !== 'note' && (
                    <div className="state-change">
                      {event.before}
                      <Icon name="arrow" size={13} />
                      {event.after}
                    </div>
                  )}
                  <blockquote>{event.reason}</blockquote>
                  <small>Demo operator · {dateTime(event.at)}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
