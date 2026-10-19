import { useState, type FormEvent } from 'react';
import type { Activity, RecordAction, ToolModule, ToolRecord } from '../core/types';
import type { MutationRequest } from '../core/actions';
import { ageLabel, dateTime, initials } from '../core/format';
import { Badge } from './Badge';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

type FormChoice = { version: number } & (
  | { kind: 'action'; action: RecordAction }
  | { kind: 'assignment' }
  | { kind: 'note' }
);

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
  onAction: (request: MutationRequest) => string | null;
}) {
  const [form, setForm] = useState<FormChoice | null>(null);
  const [owner, setOwner] = useState(record.owner);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const available = module.actions.filter((candidate) => candidate.available(record));
  const action = form?.kind === 'action' ? form.action : null;
  const label = action?.label ?? (form?.kind === 'assignment' ? 'Reassign owner' : 'Add note');
  const notes = activity.filter((event) => event.kind === 'note');
  const changes = activity.filter((event) => event.kind !== 'note');
  function clearForm() {
    setForm(null);
    setReason('');
    setError('');
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    const target = {
      moduleId: module.id,
      recordId: record.id,
      expectedVersion: form.version,
      reason,
    };
    const message = onAction(
      form.kind === 'assignment'
        ? { ...target, kind: 'assignment', owner }
        : form.kind === 'note'
          ? { ...target, kind: 'note' }
          : { ...target, actionId: form.action.id },
    );
    if (message) setError(message);
    else clearForm();
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
          <div>
            <dt>Opened</dt>
            <dd>
              {record.openedAt ? dateTime(record.openedAt) : 'Not recorded in older demo data'}
            </dd>
          </div>
          <div>
            <dt>Age since opening</dt>
            <dd>{ageLabel(record.openedAt)} · not an SLA</dd>
          </div>
          {module.details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value(record)}</dd>
            </div>
          ))}
        </dl>
        <div className="detail-divider" />
        <h4 className="section-label">ACTIONS</h4>
        {form ? (
          <form className="action-form" onSubmit={submit}>
            <h3>{label}</h3>
            <p>
              {action?.confirmation ??
                (form.kind === 'assignment'
                  ? 'Owners are local demo labels, not authenticated people or permissions. Explain the handoff.'
                  : 'Add fictional operational context only. Notes stay in this browser and are editable local data, not a secure audit log.')}
            </p>
            {form.kind === 'assignment' && (
              <>
                <label htmlFor="demo-owner">New owner</label>
                <select
                  id="demo-owner"
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                >
                  {Array.from(new Set([record.owner, ...module.owners])).map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </>
            )}
            <label htmlFor="action-reason">
              {form.kind === 'note' ? 'Note' : 'Decision reason'}{' '}
              <span className="required">*</span>
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
              <button type="button" className="button button-secondary" onClick={clearForm}>
                Cancel
              </button>
              <button
                className={`button ${action?.tone === 'danger' ? 'button-danger' : 'button-primary'}`}
                type="submit"
                disabled={
                  reason.trim().length < 5 || (form.kind === 'assignment' && owner === record.owner)
                }
              >
                Confirm {label.toLowerCase()}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="action-help">
              {available.length
                ? 'Choose an action, then add a reason to confirm.'
                : (module.noActionMessage?.(record) ??
                  'No further workflow actions. You can still assign this record or add a note.')}
            </p>
            <div className="action-buttons">
              {available.map((candidate) => (
                <button
                  key={candidate.id}
                  className={`button ${candidate.tone === 'primary' ? 'button-primary' : candidate.tone === 'danger' ? 'button-danger-outline' : 'button-secondary'}`}
                  onClick={() => {
                    setForm({ kind: 'action', action: candidate, version: record.version });
                    setReason('');
                    setError('');
                  }}
                >
                  {candidate.label}
                </button>
              ))}
              <button
                className="button button-secondary"
                onClick={() => {
                  clearForm();
                  setOwner(record.owner);
                  setForm({ kind: 'assignment', version: record.version });
                }}
              >
                Reassign owner
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  clearForm();
                  setForm({ kind: 'note', version: record.version });
                }}
              >
                Add note
              </button>
            </div>
          </>
        )}
        <div className="detail-divider" />
        <h4 className="section-label">LOCAL NOTES ({notes.length})</h4>
        {notes.length === 0 ? (
          <p className="muted activity-empty">No local notes. Use fictional context only.</p>
        ) : (
          <ol className="local-notes">
            {notes.map((note) => (
              <li key={note.id}>
                <p>{note.reason}</p>
                <small>Demo operator · {dateTime(note.at)}</small>
              </li>
            ))}
          </ol>
        )}
        <div className="detail-divider" />
        <h4 className="section-label">LOCAL ACTIVITY</h4>
        {changes.length === 0 ? (
          <p className="muted activity-empty">
            No workflow changes yet. Initial sample states have no invented operator history.
          </p>
        ) : (
          <ol className="record-activity">
            {changes.map((event) => (
              <li key={event.id}>
                <span className="activity-dot">
                  <Icon name="check" size={12} />
                </span>
                <div>
                  <strong>{event.action}</strong>
                  <p>
                    {event.before} → {event.after}
                  </p>
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
