import { useState, type FormEvent } from 'react';
import { Badge } from '../components/Badge';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { dateTime, money } from '../core/format';
import {
  approvalBlocker,
  createVendorFixtures,
  dataAccessOptions,
  departments,
  loadVendors,
  newVendorRequest,
  requiredTeams,
  reviewTeams,
  reviewVendorRequest,
  reviseVendorRequest,
  saveVendors,
  vendorStatus,
  type ReviewTeam,
  type VendorDetails,
  type VendorRequest,
  type VendorState,
} from './vendors';

const blankDetails: VendorDetails = {
  vendor: '',
  requester: '',
  department: 'Operations',
  purpose: '',
  annualCents: 0,
  budgetOwner: '',
  dataAccess: 'Public information only',
  securityReviewed: false,
  contractReviewed: false,
};

function RequestForm({
  request,
  onSave,
  onClose,
}: {
  request: VendorRequest | null;
  onSave: (details: VendorDetails) => void;
  onClose: () => void;
}) {
  const [details, setDetails] = useState(request?.details ?? blankDetails);
  const [spend, setSpend] = useState(request ? (request.details.annualCents / 100).toFixed(2) : '');
  const [error, setError] = useState('');
  const update = <K extends keyof VendorDetails>(key: K, value: VendorDetails[K]) =>
    setDetails((current) => ({ ...current, [key]: value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d+(\.\d{1,2})?$/.test(spend)) {
      setError('Enter annual USD spend with at most two decimal places.');
      return;
    }
    try {
      onSave({ ...details, annualCents: Math.round(Number(spend) * 100) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the request.');
    }
  }
  return (
    <Dialog
      title={request ? 'Edit and resubmit vendor request' : 'New vendor request'}
      subtitle="FICTIONAL DETAILS ONLY"
      onClose={onClose}
    >
      <form className="vendor-form" onSubmit={submit}>
        <p>
          {request
            ? 'Resubmitting creates a new revision and resets every review. Previous decisions remain in the local history.'
            : 'Describe a business need, then simulate the required departmental reviews.'}
        </p>
        <label>
          Vendor name
          <input
            required
            minLength={2}
            maxLength={120}
            value={details.vendor}
            onChange={(e) => update('vendor', e.target.value)}
          />
        </label>
        <label>
          Fictional requester
          <input
            required
            minLength={2}
            maxLength={120}
            value={details.requester}
            onChange={(e) => update('requester', e.target.value)}
          />
        </label>
        <label>
          Requesting department
          <select
            value={details.department}
            onChange={(e) => update('department', e.target.value as VendorDetails['department'])}
          >
            {departments.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </select>
        </label>
        <label>
          Business need
          <textarea
            required
            minLength={10}
            maxLength={1000}
            value={details.purpose}
            onChange={(e) => update('purpose', e.target.value)}
          />
        </label>
        <label>
          Annual spend (USD)
          <input
            required
            inputMode="decimal"
            maxLength={12}
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            aria-describedby="vendor-spend-help"
          />
        </label>
        <p id="vendor-spend-help" className="subtle">
          Illustrative annual estimate, not an approved budget or financial commitment.
        </p>
        <label>
          Budget owner
          <input
            maxLength={120}
            value={details.budgetOwner}
            onChange={(e) => update('budgetOwner', e.target.value)}
            placeholder="Optional at submission; required for Finance approval"
          />
        </label>
        <label>
          Vendor data access
          <select
            value={details.dataAccess}
            onChange={(e) =>
              setDetails((current) => ({
                ...current,
                dataAccess: e.target.value as VendorDetails['dataAccess'],
                securityReviewed: false,
              }))
            }
          >
            {dataAccessOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Synthetic review prerequisites</legend>
          <p>Demo checkboxes only—not uploaded documents, verification, or real sign-off.</p>
          <label className="vendor-check">
            <input
              type="checkbox"
              checked={details.securityReviewed}
              disabled={details.dataAccess === 'Public information only'}
              onChange={(e) => update('securityReviewed', e.target.checked)}
            />
            Synthetic security assessment reviewed
          </label>
          <label className="vendor-check">
            <input
              type="checkbox"
              checked={details.contractReviewed}
              onChange={(e) => update('contractReviewed', e.target.checked)}
            />
            Synthetic contract reviewed
          </label>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="action-buttons">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary">
            {request ? 'Resubmit for fresh reviews' : 'Submit demo request'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ReviewCard({
  request,
  team,
  blocked,
  onReview,
}: {
  request: VendorRequest;
  team: ReviewTeam;
  blocked: boolean;
  onReview: (team: ReviewTeam, decision: 'Approved' | 'Changes requested', reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const required = requiredTeams(request.details).includes(team);
  const review = request.reviews[team];
  const blocker = approvalBlocker(request.details, team);
  const pending = required && review.status === 'Pending';
  return (
    <section className="evidence-card" aria-label={`${team} review`}>
      <div className="vendor-card-heading">
        <h3>{team}</h3>
        <Badge
          label={required ? review.status : 'Not required'}
          tone={
            !required
              ? 'neutral'
              : review.status === 'Approved'
                ? 'green'
                : review.status === 'Changes requested'
                  ? 'red'
                  : 'amber'
          }
        />
      </div>
      <p>
        {team === 'Finance'
          ? 'Confirm a budget owner and review the annual spend.'
          : team === 'Security'
            ? 'Review the synthetic assessment for internal or customer data access.'
            : 'Review the synthetic contract before onboarding.'}
      </p>
      {!required && (
        <p>Skipped by this demo’s public-information-only rule. Real company policy may differ.</p>
      )}
      {pending && (
        <>
          {blocker && <p className="vendor-blocker">{blocker}</p>}
          <label htmlFor={`vendor-reason-${team}`}>{team} review reason</label>
          <textarea
            id={`vendor-reason-${team}`}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain this simulated decision (5–1,000 characters)."
          />
          <div className="action-buttons">
            <button
              className="button button-primary"
              disabled={blocked || !!blocker || reason.trim().length < 5}
              onClick={() => onReview(team, 'Approved', reason)}
            >
              Simulate {team} approval
            </button>
            <button
              className="button button-secondary"
              disabled={blocked || reason.trim().length < 5}
              onClick={() => onReview(team, 'Changes requested', reason)}
            >
              Request changes from {team}
            </button>
          </div>
        </>
      )}
      {required && !pending && (
        <p>
          <strong>Recorded reason:</strong> {review.reason}
        </p>
      )}
    </section>
  );
}

export function VendorOnboarding() {
  const [snapshot, setSnapshot] = useState(loadVendors);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [form, setForm] = useState<{ request: VendorRequest | null } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const requests = snapshot.data.requests;
  const visible = requests.filter(
    (request) =>
      (statusFilter === 'All statuses' || vendorStatus(request) === statusFilter) &&
      `${request.id} ${request.details.vendor} ${request.details.requester} ${request.details.department}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const selected = visible.find((request) => request.id === selectedId) ?? visible[0];

  function commit(data: VendorState) {
    const saved = saveVendors(data);
    setSnapshot({
      data,
      blocked: false,
      warning: saved
        ? ''
        : 'Vendor changes are in memory only. Browser storage is unavailable; leaving this page may lose them.',
    });
    setError('');
    return saved;
  }
  function saveRequest(details: VendorDetails) {
    if (snapshot.blocked || !form) return;
    const next = form.request
      ? reviseVendorRequest(form.request, details)
      : newVendorRequest(details);
    const saved = commit({
      ...snapshot.data,
      requests: form.request
        ? requests.map((request) => (request.id === next.id ? next : request))
        : [next, ...requests],
    });
    setForm(null);
    setSelectedId(next.id);
    setSearch('');
    setStatusFilter('All statuses');
    setMessage(
      saved
        ? `${next.details.vendor}: revision ${next.revision} saved in this browser.`
        : 'Request updated for this visit only.',
    );
  }
  function review(team: ReviewTeam, decision: 'Approved' | 'Changes requested', reason: string) {
    if (snapshot.blocked || !selected) return;
    try {
      const next = reviewVendorRequest(selected, team, decision, reason);
      const saved = commit({
        ...snapshot.data,
        requests: requests.map((request) => (request.id === next.id ? next : request)),
      });
      setSelectedId(next.id);
      setSearch('');
      setStatusFilter('All statuses');
      setMessage(
        `${team} simulation recorded${saved ? ' locally' : ' for this visit only'}. No external action was taken.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record review.');
    }
  }
  return (
    <section className="custom-page vendor-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CROSS-DEPARTMENT EXTENSION · LOCAL SIMULATION</p>
          <h1>Vendor onboarding & spend approvals</h1>
          <p>One business request. Finance, Security, and Legal working from the same context.</p>
        </div>
        <button
          className="button button-primary"
          disabled={snapshot.blocked}
          onClick={() => setForm({ request: null })}
        >
          New vendor request <Icon name="arrow" size={16} />
        </button>
      </div>
      <div className="vendor-notice">
        <strong>Start in financial operations. Extend across the company.</strong>
        <p>
          This page reuses Workbench’s shell, navigation, badges, dialogs, and formatting with a new
          departmental review model. All identities and decisions are simulated in this browser—not
          authenticated approvals. No vendor is provisioned, no contract is signed, and no money is
          committed. Use fictional details only.
        </p>
      </div>
      {snapshot.warning && (
        <p className="warning-banner" role="alert">
          {snapshot.warning}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="vendor-notice" role="status">
          {message}
        </p>
      )}
      <div className="metrics">
        {['In review', 'Changes requested', 'Ready for onboarding'].map((status) => (
          <div className="metric" key={status}>
            <span className="metric-label">{status}</span>
            <strong>{requests.filter((request) => vendorStatus(request) === status).length}</strong>
            <span className="metric-hint">Synthetic requests · all departments</span>
          </div>
        ))}
        <div className="metric">
          <span className="metric-label">Requested annual spend</span>
          <strong>
            {money(requests.reduce((sum, request) => sum + request.details.annualCents, 0))}
          </strong>
          <span className="metric-hint">Sample USD · not approved or committed</span>
        </div>
      </div>
      <section className="panel" aria-label="Vendor requests">
        <div className="table-toolbar vendor-filters">
          <label>
            Search vendors
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedId(null);
              }}
              placeholder="Vendor, ID, requester, department"
            />
          </label>
          <label>
            Request status
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSelectedId(null);
              }}
            >
              {['All statuses', 'In review', 'Changes requested', 'Ready for onboarding'].map(
                (status) => (
                  <option key={status}>{status}</option>
                ),
              )}
            </select>
          </label>
          <span className="subtle">
            {visible.length} of {requests.length} sample requests
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Vendor / request</th>
                <th>Department</th>
                <th>Annual spend</th>
                <th>Status</th>
                <th>Reviews</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((request) => (
                <tr
                  key={request.id}
                  className={selected?.id === request.id ? 'vendor-selected' : ''}
                >
                  <td>
                    <button
                      className="text-button"
                      aria-label={`Open ${request.details.vendor}`}
                      aria-pressed={selected?.id === request.id}
                      onClick={() => {
                        setSelectedId(request.id);
                        setError('');
                      }}
                    >
                      <strong>{request.details.vendor}</strong>
                    </button>
                    <div className="subtle">
                      {request.id} · revision {request.revision}
                    </div>
                  </td>
                  <td>{request.details.department}</td>
                  <td>{money(request.details.annualCents)}</td>
                  <td>
                    <Badge
                      label={vendorStatus(request)}
                      tone={
                        vendorStatus(request) === 'Ready for onboarding'
                          ? 'green'
                          : vendorStatus(request) === 'Changes requested'
                            ? 'red'
                            : 'amber'
                      }
                    />
                  </td>
                  <td>
                    {
                      requiredTeams(request.details).filter(
                        (team) => request.reviews[team].status === 'Approved',
                      ).length
                    }{' '}
                    / {requiredTeams(request.details).length} complete
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <p className="vendor-empty">
            No matching requests. Clear filters or create a new fictional request.
          </p>
        )}
      </section>
      {selected && (
        <section className="vendor-detail" aria-label="Selected vendor request">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {selected.id} · REVISION {selected.revision}
              </p>
              <h2>{selected.details.vendor}</h2>
            </div>
            <button
              className="button button-secondary"
              disabled={snapshot.blocked}
              onClick={() => setForm({ request: selected })}
            >
              Edit & resubmit
            </button>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Requester / department</dt>
              <dd>
                {selected.details.requester} · {selected.details.department}
              </dd>
            </div>
            <div>
              <dt>Budget owner</dt>
              <dd>{selected.details.budgetOwner || 'Missing · Finance approval blocked'}</dd>
            </div>
            <div>
              <dt>Annual spend estimate</dt>
              <dd>{money(selected.details.annualCents)} USD</dd>
            </div>
            <div>
              <dt>Data access</dt>
              <dd>{selected.details.dataAccess}</dd>
            </div>
            <div>
              <dt>Business need</dt>
              <dd>{selected.details.purpose}</dd>
            </div>
          </dl>
          <div className="vendor-progress">
            <strong>{vendorStatus(selected)}</strong>
            <p>
              {vendorStatus(selected) === 'Ready for onboarding'
                ? 'All required demo reviews are complete. This is only a handoff marker: the vendor is not onboarded and no spend is authorized.'
                : 'Finance and Legal review every request. This illustrative policy also requires Security for internal or customer data. Any edit resets all reviews.'}
            </p>
          </div>
          <div className="evidence-grid vendor-reviews">
            {reviewTeams.map((team) => (
              <ReviewCard
                key={`${selected.id}/${selected.revision}/${team}`}
                request={selected}
                team={team}
                blocked={snapshot.blocked}
                onReview={review}
              />
            ))}
          </div>
          <h3>Local decision history</h3>
          <p>
            Browser-editable simulation labels, not verified people or a compliance audit trail.
            History for earlier revisions is retained.
          </p>
          <ol className="evidence-timeline">
            {[...selected.history].reverse().map((event) => (
              <li key={event.id}>
                <strong>{event.action}</strong>
                <p>
                  {event.actor} · <time dateTime={event.at}>{dateTime(event.at)}</time>
                </p>
                <p>{event.reason}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="vendor-reset">
        <p>
          Stored separately from KYC, refunds, flags, and shared SQLite. Not shared between users;
          simultaneous browser tabs are not coordinated. Vendor history appears here, not in the
          original tools’ Activity page.
        </p>
        <button className="text-button" onClick={() => setResetOpen(true)}>
          Reset vendor demo
        </button>
      </div>
      {form && (
        <RequestForm request={form.request} onSave={saveRequest} onClose={() => setForm(null)} />
      )}
      {resetOpen && (
        <Dialog
          title="Reset vendor demo?"
          subtitle="VENDOR DATA ONLY"
          onClose={() => setResetOpen(false)}
        >
          <div className="vendor-form">
            <p>
              This replaces vendor requests and their local history with three synthetic examples.
              Other local tools, saved views, and shared KYC are unchanged.
            </p>
            <div className="action-buttons">
              <button className="button button-secondary" onClick={() => setResetOpen(false)}>
                Cancel
              </button>
              <button
                className="button button-danger"
                onClick={() => {
                  const saved = commit(createVendorFixtures());
                  setSelectedId(null);
                  setSearch('');
                  setStatusFilter('All statuses');
                  setMessage(
                    saved
                      ? 'Vendor demo reset locally.'
                      : 'Vendor demo reset for this visit only. Saved browser data could not be replaced.',
                  );
                  setResetOpen(false);
                }}
              >
                Confirm vendor reset
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
