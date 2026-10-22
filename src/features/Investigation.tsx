import { useState, type FormEvent } from 'react';
import { Badge } from '../components/Badge';
import { dateTime, money } from '../core/format';
import type { Tone } from '../core/types';
import {
  canRetrySyntheticSource,
  investigationExamples,
  looksLikeCardNumber,
  retrySyntheticSource,
  summarizeEvidence,
  syntheticEvidence,
  type SourceEvidence,
} from './evidence';
import './investigation.css';

function sourceStatus(source: SourceEvidence): { label: string; tone: Tone } {
  if (source.outcome === 'unavailable') return { label: 'No response', tone: 'amber' };
  if (source.outcome === 'not-found') return { label: 'Not found', tone: 'neutral' };
  return {
    label: source.reportedStatus ?? 'Unknown',
    tone: source.reportedStatus === 'Completed' ? 'green' : 'amber',
  };
}

function sourceNote(source: SourceEvidence): string {
  if (source.outcome === 'unavailable') return 'Didn’t respond. Outcome unknown.';
  if (source.outcome === 'not-found') return 'No record for this ID';
  if (source.stale) {
    const minutes = Math.round(
      (Date.parse(source.attemptedAt) - Date.parse(source.retrievedAt!)) / 60_000,
    );
    return `Out of date: last updated ${minutes} min ago`;
  }
  if (!source.complete) return 'Partial response: some details missing';
  if (source.retryCount > 0) return 'Refreshed just now (simulated, no real request)';
  return 'Up to date';
}

export function Investigation() {
  const [query, setQuery] = useState('TX-DEMO-003');
  const [sources, setSources] = useState<SourceEvidence[]>(() => syntheticEvidence('TX-DEMO-003'));
  const [searched, setSearched] = useState('TX-DEMO-003');
  const [refused, setRefused] = useState(false);
  function investigate(id: string) {
    setRefused(false);
    setQuery(id);
    setSearched(id);
    setSources(syntheticEvidence(id));
  }
  function search(event: FormEvent) {
    event.preventDefault();
    if (looksLikeCardNumber(query)) {
      setQuery('');
      setRefused(true);
      return;
    }
    const id = query.trim().toUpperCase();
    if (id) investigate(id);
  }
  const summary = summarizeEvidence(sources);
  const events = sources
    .flatMap((source) => source.events.map((event) => ({ ...event, source })))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const payment = sources.find((source) => source.payment)?.payment;
  return (
    <section className="custom-page investigation">
      <p className="eyebrow">READ-ONLY LOOKUP</p>
      <h1>Transaction investigation</h1>
      <p>
        When a customer asks “did my payment go through?”, check what the ledger, the payment
        processor and the bank settlement report each say, and see whether they agree.
      </p>
      <form className="toolbar" onSubmit={search}>
        <label htmlFor="investigation-id">Transaction ID</label>
        <input
          id="investigation-id"
          value={query}
          maxLength={64}
          required
          aria-describedby={refused ? 'investigation-refused' : undefined}
          onChange={(e) => {
            setRefused(false);
            setQuery(e.target.value);
          }}
        />
        <button className="button button-primary" disabled={!query.trim()}>
          Investigate
        </button>
      </form>
      <div className="investigation-examples" aria-label="Example transactions">
        <span>Try an example:</span>
        {investigationExamples.map((example) => (
          <button
            key={example.id}
            type="button"
            className="button button-secondary"
            aria-pressed={searched === example.id}
            onClick={() => investigate(example.id)}
          >
            {example.label}
          </button>
        ))}
      </div>
      {refused && (
        <p id="investigation-refused" role="alert" className="investigation-notice">
          That looks like a full card number, so it was cleared. Search by transaction ID instead.
        </p>
      )}
      {searched && !refused && query.trim().toUpperCase() !== searched && (
        <p className="investigation-notice">
          Input changed. Results below are still for {searched}; investigate to replace them.
        </p>
      )}
      {searched && (
        <div className="investigation-results" aria-live="polite">
          <div className="investigation-header">
            <h2>{searched}</h2>
            {payment && (
              <dl>
                <div>
                  <dt>Customer</dt>
                  <dd>
                    {payment.customerName}
                    <span className="investigation-sub">{payment.customerEmail}</span>
                  </dd>
                </div>
                <div>
                  <dt>Merchant</dt>
                  <dd>{payment.merchant}</dd>
                </div>
                <div>
                  <dt>Card</dt>
                  <dd>
                    {payment.card.brand} •••• {payment.card.last4}
                  </dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{money(payment.amountCents)} USD</dd>
                </div>
              </dl>
            )}
          </div>
          <div role="status" className={`investigation-verdict verdict-${summary.tone}`}>
            <strong>{summary.headline}</strong>
            <p>{summary.nextStep}</p>
          </div>
          <div className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">System</th>
                    <th scope="col">Reported status</th>
                    <th scope="col">Data as of</th>
                    <th scope="col">Notes</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => {
                    const status = sourceStatus(source);
                    return (
                      <tr key={source.id} aria-label={source.label}>
                        <th scope="row">{source.label}</th>
                        <td>
                          <Badge label={status.label} tone={status.tone} />
                        </td>
                        <td>{source.retrievedAt ? dateTime(source.retrievedAt) : '—'}</td>
                        <td className="investigation-note">{sourceNote(source)}</td>
                        <td>
                          {canRetrySyntheticSource(source) && (
                            <button
                              className="button button-secondary"
                              aria-label={`Retry ${source.label}`}
                              onClick={() =>
                                setSources((current) =>
                                  current.map((s) =>
                                    s.id === source.id ? retrySyntheticSource(s) : s,
                                  ),
                                )
                              }
                            >
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <h3>What happened</h3>
          {events.length ? (
            <ol className="investigation-timeline">
              {events.map((event) => (
                <li key={`${event.source.id}/${event.id}`}>
                  <time dateTime={event.occurredAt}>{dateTime(event.occurredAt)}</time>
                  <span>
                    {event.description}{' '}
                    <span className="investigation-source">· {event.source.label}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p>
              {sources.some((source) => source.outcome === 'unavailable')
                ? 'No events yet. A system didn’t respond, so this isn’t proof nothing happened.'
                : 'No events found for this ID.'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
