import { useState, type FormEvent } from 'react';
import type { Activity, RecordAction, ToolModule, ToolRecord } from '../core/types';
import type { ActionRequest } from '../core/actions';
import { dateTime, initials } from '../core/format';
import { Badge } from './Badge';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

export function RecordDrawer({
  module,
  record,
  activity,
  onClose,
  onAction,
}: {
  module: ToolModule;
  record: ToolRecord;
  activity: Activity[];
  onClose: () => void;
  onAction: (request: ActionRequest) => string | null;
}) {
  const [action, setAction] = useState<RecordAction | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const available = module.actions.filter((candidate) => candidate.available(record));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!action) return;
    const message = onAction({
      moduleId: module.id,
      recordId: record.id,
      actionId: action.id,
      expectedVersion: record.version,
      reason,
    });
    if (message) setError(message);
    else {
      setAction(null);
      setReason('');
      setError('');
    }
  }
  return (
    <Dialog
      title="Record details"
      subtitle={`${module.shortTitle} / ${record.id}`}
      onClose={onClose}
      drawer
    >
      <div className="drawer-body">
        <div className="record-profile">
          <span
            className={`avatar avatar-large ${module.id === 'flags' ? 'avatar-flag' : 'avatar-0'}`}
          >
            {module.id === 'flags' ? <Icon name="flag" size={25} /> : initials(record.name)}
          </span>
          <div>
            <h3>{record.name}</h3>
            <p>{record.subtitle}</p>
          </div>
        </div>
        <div className="record-meta">
          <Badge label={record.status} tone={module.statuses[record.status]} />
          <span>Owner: {record.owner}</span>
        </div>
        <div className="notice">
          <Icon name="info" size={18} />
          <p>{module.notice}</p>
        </div>
        <h4 className="section-label">OVERVIEW</h4>
        <dl className="detail-grid">
          {module.details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value(record)}</dd>
            </div>
          ))}
        </dl>
        <div className="detail-divider" />
        <h4 className="section-label">ACTIONS</h4>
        {action ? (
          <form className="action-form" onSubmit={submit}>
            <h3>{action.label}</h3>
            <p>{action.confirmation}</p>
            <label htmlFor="action-reason">
              Decision reason <span className="required">*</span>
            </label>
            <textarea
              id="action-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Add context for this change…"
              minLength={5}
              maxLength={500}
              required
              rows={3}
            />
            <div className="input-hint">5–500 characters · Recorded in local activity</div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="action-buttons">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setAction(null);
                  setError('');
                }}
              >
                Cancel
              </button>
              <button
                className={`button ${action.tone === 'danger' ? 'button-danger' : 'button-primary'}`}
                type="submit"
                disabled={reason.trim().length < 5}
              >
                Confirm {action.label.toLowerCase()}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="action-help">
              {available.length
                ? 'Choose an action, then add a reason to confirm.'
                : 'This record is resolved. There are no further actions.'}
            </p>
            <div className="action-buttons">
              {available.map((candidate) => (
                <button
                  key={candidate.id}
                  className={`button ${candidate.tone === 'primary' ? 'button-primary' : candidate.tone === 'danger' ? 'button-danger-outline' : 'button-secondary'}`}
                  onClick={() => {
                    setAction(candidate);
                    setError('');
                  }}
                >
                  {candidate.label}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="detail-divider" />
        <h4 className="section-label">LOCAL ACTIVITY</h4>
        {activity.length === 0 ? (
          <p className="muted activity-empty">No changes yet. Actions you take will appear here.</p>
        ) : (
          <ol className="record-activity">
            {activity.map((event) => (
              <li key={event.id}>
                <span className="activity-dot">
                  <Icon name="check" size={12} />
                </span>
                <div>
                  <strong>{event.action}</strong>
                  <p>{event.reason}</p>
                  <small>Demo operator · {dateTime(event.at)}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <footer className="drawer-footer">
        <span>
          Version {record.version} · Updated {dateTime(record.updatedAt)}
        </span>
        <Icon name="shield" size={15} />
      </footer>
    </Dialog>
  );
}
