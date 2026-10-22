import { useRef, useState, type FormEvent } from 'react';
import type { Activity, RecordAction, ToolModule, ToolRecord } from '../core/types';
import type { MutationRequest } from '../core/actions';
import { actionBlock } from '../core/eligibility';
import { ageLabel, dateTime, initials } from '../core/format';
import { useNow } from '../core/useNow';
import { Badge } from './Badge';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import './domain-workflows.css';

type FormChoice = { version: number } & (
  | { kind: 'action'; action: RecordAction }
  | { kind: 'assignment' }
  | { kind: 'note' }
);

type Draft = { form: FormChoice; reason: string; owner: string };
const draftKey = (form: FormChoice) => (form.kind === 'action' ? form.action.id : form.kind);

export function RecordDrawer({
  module,
  record,
  records,
  activity,
  onClose,
  onAction,
  persistence = 'local',
  readOnly = false,
  onRefresh,
}: {
  module: ToolModule;
  record: ToolRecord;
  records?: ToolRecord[];
  activity: (Activity & { actorName?: string })[];
  onClose: () => void;
  onAction: (request: MutationRequest) => string | null | Promise<string | null>;
  persistence?: 'local' | 'shared';
  readOnly?: boolean;
  onRefresh?: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormChoice | null>(null);
  const [owner, setOwner] = useState(record.owner);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [closePrompt, setClosePrompt] = useState(false);
  const saving = useRef(false);
  const now = useNow();
  const available = (
    persistence === 'local' ? (module.localActions ?? module.actions) : module.actions
  ).filter((candidate) => candidate.available(record));
  const action = form?.kind === 'action' ? form.action : null;
  const blocked =
    action && !action.available(record)
      ? 'This action no longer applies to the displayed case. Your draft is retained for review or copying; choose another action.'
      : action && actionBlock(action, record, records);
  const label = action?.label ?? (form?.kind === 'assignment' ? 'Reassign owner' : 'Add note');
  const notes = activity.filter((event) => event.kind === 'note');
  const changes = activity.filter((event) => event.kind !== 'note');
  function clearForm() {
    if (form)
      setDrafts((saved) => {
        const next = { ...saved };
        delete next[draftKey(form)];
        return next;
      });
    setForm(null);
    setReason('');
    setError('');
  }
  function openForm(choice: FormChoice) {
    const key = draftKey(choice);
    const saved = drafts[key];
    setForm(saved?.form ?? choice);
    setReason(saved?.reason ?? '');
    setOwner(saved?.owner ?? record.owner);
    setError('');
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }
  function cancelForm() {
    if (form && (reason || (form.kind === 'assignment' && owner !== record.owner)))
      setDrafts((saved) => ({ ...saved, [draftKey(form)]: { form, reason, owner } }));
    setForm(null);
    setReason('');
    setError('');
  }
  function requestClose() {
    if (submitting) return;
    if (
      (form && (reason || (form.kind === 'assignment' && owner !== record.owner))) ||
      Object.keys(drafts).length
    )
      setClosePrompt(true);
    else onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form || saving.current || readOnly || blocked || closePrompt) return;
    saving.current = true;
    setSubmitting(true);
    const target = {
      moduleId: module.id,
      recordId: record.id,
      expectedVersion: form.version,
      reason,
    };
    try {
      const message = await onAction(
        form.kind === 'assignment'
          ? { ...target, kind: 'assignment', owner }
          : form.kind === 'note'
            ? { ...target, kind: 'note' }
            : { ...target, actionId: form.action.id },
      );
      if (message) setError(message);
      else clearForm();
    } catch {
      setError(
        'Save response unavailable. Your input is retained; retry the same change to check its outcome.',
      );
    } finally {
      saving.current = false;
      setSubmitting(false);
    }
  }
  return (
    <Dialog
      title="Record details"
      subtitle={`${module.shortTitle} / ${record.id}`}
      onClose={requestClose}
      drawer
    >
      <div className="drawer-body">
        {closePrompt && (
          <div className="workflow-draft-warning" role="alert">
            <strong>Keep your unsaved draft?</strong>
            <p>
              Cancel keeps drafts while this drawer stays open. Closing or reloading discards them;
              no change has been confirmed by closing.
            </p>
            <div className="action-buttons">
              <button className="button button-primary" onClick={() => setClosePrompt(false)}>
                Keep editing
              </button>
              <button className="button button-secondary" onClick={onClose}>
                Discard drafts and close
              </button>
            </div>
          </div>
        )}
        <div className="record-profile">
          <span className={`avatar avatar-large ${module.recordIcon ? 'avatar-icon' : 'avatar-0'}`}>
            {module.recordIcon ? (
              <Icon name={module.recordIcon} size={25} />
            ) : (
              initials(record.name)
            )}
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
            <dd>{ageLabel(record.openedAt, now)} · not an SLA</dd>
          </div>
          {module.details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value(record)}</dd>
            </div>
          ))}
        </dl>
        {persistence === 'local' && module.localDetails && (
          <section className="workflow-context" aria-label="Local workflow context">
            <h4 className="section-label">FICTIONAL EVIDENCE &amp; FOLLOW-UP</h4>
            <dl className="workflow-context-list">
              {module.localDetails.map((detail) => (
                <div key={detail.label}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value(record)}</dd>
                </div>
              ))}
            </dl>
            <p className="input-hint">
              Checklist items and assessment rules are illustrative—not verified client policy or
              real identity checks. Reassign owner to record a reasoned handoff; owner labels are
              not authenticated reviewers.
            </p>
          </section>
        )}
        <div className="detail-divider" />
        <h4 className="section-label">ACTIONS</h4>
        {readOnly ? (
          <p>Viewer access · shared records are read-only.</p>
        ) : form ? (
          <form className="action-form" onSubmit={submit}>
            <h3>{label}</h3>
            <p>
              {action?.confirmation ??
                (persistence === 'shared'
                  ? 'Use fictional context only. This change is saved on the server and attributed to your signed-in account; this is not compliance-grade audit storage.'
                  : form.kind === 'assignment'
                    ? 'Owners are local demo labels, not authenticated people or permissions. Explain the handoff.'
                    : 'Add fictional operational context only. Notes stay in this browser and are editable local data, not a secure audit log.')}
            </p>
            {action?.eligibility && (
              <p className="workflow-eligibility">{action.eligibility(record)}</p>
            )}
            {action?.preview && <p className="workflow-diff">{action.preview(record)}</p>}
            {blocked && (
              <p className="form-error" role="alert">
                {blocked}
              </p>
            )}
            {form.version !== record.version && (
              <p className="workflow-draft-warning">
                This draft targets version {form.version}; displayed version is {record.version}.
                Review the changed details before explicitly choosing the newer version. Input is
                retained.
              </p>
            )}
            {form.kind === 'assignment' && (
              <>
                <label htmlFor="demo-owner">New owner</label>
                <select
                  id="demo-owner"
                  disabled={submitting}
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
              {form.kind === 'note'
                ? 'Note'
                : action?.reasonLabel
                  ? `${action.reasonLabel} · Decision reason`
                  : 'Decision reason'}{' '}
              <span className="required">*</span>
            </label>
            <textarea
              id="action-reason"
              disabled={submitting}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Add context for this change…"
              minLength={5}
              maxLength={500}
              required
              rows={3}
            />
            <div className="input-hint">5–500 characters · Recorded in {persistence} activity</div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {(onRefresh || record.version !== form.version) && (
              <div className="action-buttons">
                {onRefresh && (
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={submitting}
                    onClick={onRefresh}
                  >
                    Refresh latest case (keep input)
                  </button>
                )}
                {record.version !== form.version && (
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={submitting}
                    onClick={() => {
                      setForm({ ...form, version: record.version });
                      setError(
                        'Latest version selected. Review the updated case details and confirm your change again.',
                      );
                    }}
                  >
                    Use refreshed version {record.version}
                  </button>
                )}
              </div>
            )}
            <div className="action-buttons">
              <button
                type="button"
                className="button button-secondary"
                onClick={cancelForm}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className={`button ${action?.tone === 'danger' ? 'button-danger' : 'button-primary'}`}
                type="submit"
                disabled={
                  submitting ||
                  Boolean(blocked) ||
                  reason.trim().length < 5 ||
                  (form.kind === 'assignment' && owner === record.owner)
                }
              >
                {submitting ? 'Saving…' : `Confirm ${label.toLowerCase()}`}
              </button>
            </div>
          </form>
        ) : (
          <>
            {Object.keys(drafts).length > 0 && (
              <div className="workflow-draft-warning" role="status">
                <p>
                  Draft retained in this drawer. Reopen the same action to continue; closing or
                  reloading discards it.
                </p>
                {Object.values(drafts).map((draft) => (
                  <button
                    className="button button-secondary"
                    key={draftKey(draft.form)}
                    onClick={() => openForm(draft.form)}
                  >
                    Resume{' '}
                    {draft.form.kind === 'action'
                      ? draft.form.action.label.toLowerCase()
                      : draft.form.kind}{' '}
                    draft
                  </button>
                ))}
              </div>
            )}
            <p className="action-help">
              {available.length
                ? 'Choose an action, then add a reason to confirm.'
                : (module.noActionMessage?.(record) ??
                  'No further workflow actions. You can still assign this record or add a note.')}
            </p>
            <div className="action-buttons">
              {available.map((candidate) => (
                <div className="workflow-action" key={candidate.id}>
                  <button
                    className={`button ${candidate.tone === 'primary' ? 'button-primary' : candidate.tone === 'danger' ? 'button-danger-outline' : 'button-secondary'}`}
                    onClick={() =>
                      openForm({ kind: 'action', action: candidate, version: record.version })
                    }
                    disabled={Boolean(actionBlock(candidate, record, records))}
                    aria-describedby={`eligibility-${candidate.id}`}
                  >
                    {candidate.label}
                  </button>
                  <p id={`eligibility-${candidate.id}`} className="workflow-eligibility">
                    {actionBlock(candidate, record, records) ??
                      candidate.eligibility?.(record) ??
                      'Available in this case state. Add a reason before confirming.'}
                  </p>
                  {candidate.preview && (
                    <p className="workflow-diff">{candidate.preview(record)}</p>
                  )}
                </div>
              ))}
              <button
                className="button button-secondary"
                onClick={() => openForm({ kind: 'assignment', version: record.version })}
              >
                Reassign owner
              </button>
              <button
                className="button button-secondary"
                onClick={() => openForm({ kind: 'note', version: record.version })}
              >
                Add note
              </button>
            </div>
          </>
        )}
        <div className="detail-divider" />
        <h4 className="section-label">
          {persistence.toUpperCase()} NOTES ({notes.length})
        </h4>
        {notes.length === 0 ? (
          <p className="muted activity-empty">
            No {persistence} notes. Use fictional context only.
          </p>
        ) : (
          <ol className="local-notes">
            {notes.map((note) => (
              <li key={note.id}>
                <p>{note.reason}</p>
                <small>
                  {note.actorName ?? 'Demo operator'} · {dateTime(note.at)}
                </small>
              </li>
            ))}
          </ol>
        )}
        <div className="detail-divider" />
        <h4 className="section-label">{persistence.toUpperCase()} ACTIVITY</h4>
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
                  <small>
                    {event.actorName ?? 'Demo operator'} · {dateTime(event.at)}
                  </small>
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
