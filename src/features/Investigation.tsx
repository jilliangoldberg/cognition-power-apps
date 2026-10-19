import { useState, type FormEvent } from 'react';
import { dateTime } from '../core/format';
import { retrySyntheticSource, syntheticEvidence, type SourceEvidence } from './evidence';

export function Investigation() {
  const [query, setQuery] = useState('TX-DEMO-003');
  const [sources, setSources] = useState<SourceEvidence[]>([]);
  const [searched, setSearched] = useState('');
  function search(event: FormEvent) {
    event.preventDefault();
    const id = query.trim().toUpperCase();
    setSearched(id);
    setSources(syntheticEvidence(id));
  }
  const statuses = new Set(sources.map((s) => s.reportedStatus).filter(Boolean));
  const events = sources
    .flatMap((source) => source.events.map((event) => ({ ...event, source })))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const hasExample = sources.some((s) => s.outcome === 'found');
  return (
    <section className="custom-page">
      <p className="eyebrow">FOURTH-TOOL EXTENSION PROOF · SYNTHETIC ONLY</p>
      <h1>Transaction investigation</h1>
      <p>
        Read-only evidence from three fictional sources. No provider, payment instrument, or client
        business model is implied. This page does not change transactions.
      </p>
      <form className="toolbar" onSubmit={search}>
        <label htmlFor="investigation-id">Synthetic transaction ID</label>
        <input
          id="investigation-id"
          value={query}
          maxLength={64}
          required
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button button-primary" disabled={!query.trim()}>
          Investigate
        </button>
      </form>
      <p>
        Try TX-DEMO-001 (clean), 002 (conflicting), 003 (unavailable), 004 (stale), 005 (no match),
        or 006 (incomplete).
      </p>
      {searched && (
        <div aria-live="polite">
          <h2>Evidence for {searched}</h2>
          {hasExample && (
            <dl className="detail-grid">
              <div>
                <dt>Illustrative amount</dt>
                <dd>249.95 USD · curated synthetic example, not a benchmark</dd>
              </div>
              <div>
                <dt>Fictional parties</dt>
                <dd>Demo account CUST-INV-001 → Demo counterparty CP-INV-001</dd>
              </div>
              <div>
                <dt>Linked identifier</dt>
                <dd>
                  Internal reference {searched}/record · not linked to browser-local refund
                  decisions
                </dd>
              </div>
              <div>
                <dt>Current reported status</dt>
                <dd>See each source below; no single authoritative status is inferred.</dd>
              </div>
            </dl>
          )}
          <p role="status">
            {statuses.size > 1
              ? 'Reports disagree. No authoritative combined status is inferred.'
              : 'Source reports are evidence, not a verified transaction outcome.'}
          </p>
          <div className="evidence-grid">
            {sources.map((source) => (
              <article className="evidence-card" key={source.id}>
                <h3>{source.label}</h3>
                <p>
                  Lookup: {source.lookupId} · source-{source.id}
                </p>
                <strong>
                  {source.outcome === 'not-found'
                    ? 'No matching records'
                    : source.outcome === 'unavailable'
                      ? 'Unavailable · outcome unknown'
                      : source.stale
                        ? 'Stale evidence'
                        : 'Evidence retrieved'}
                </strong>
                <p>{source.reportedStatus ?? 'No status assertion available'}</p>
                <p>Last attempted: {dateTime(source.attemptedAt)}</p>
                <p>
                  Retrieved: {source.retrievedAt ? dateTime(source.retrievedAt) : 'Not retrieved'}
                </p>
                <p>
                  Completeness:{' '}
                  {source.outcome === 'unavailable'
                    ? 'Unknown'
                    : source.complete
                      ? 'Complete synthetic response'
                      : 'Incomplete · more records may exist'}
                </p>
                {(source.outcome === 'unavailable' || source.stale || !source.complete) && (
                  <button
                    className="button button-secondary"
                    onClick={() =>
                      setSources((current) =>
                        current.map((s) => (s.id === source.id ? retrySyntheticSource(s) : s)),
                      )
                    }
                  >
                    Simulate retry {source.label}
                  </button>
                )}
              </article>
            ))}
          </div>
          <h2>Reported event timeline</h2>
          <p>
            Ordered by source-reported event time, not proven causality. Retrieval time is shown
            separately above. Retries here are simulated reads, not connectivity tests.
          </p>
          {events.length ? (
            <ol className="evidence-timeline">
              {events.map((event) => (
                <li key={`${event.source.id}/${event.id}`}>
                  <details>
                    <summary>
                      {dateTime(event.occurredAt)} · {event.description}
                    </summary>
                    <p>
                      Source: {event.source.label} · Reference: {event.reference}
                    </p>
                    <p>
                      {event.source.stale
                        ? 'This evidence is stale.'
                        : 'Fictional source event; not workbench operator activity.'}
                    </p>
                  </details>
                </li>
              ))}
            </ol>
          ) : (
            <p>
              No events available. Check each source’s availability before interpreting this as an
              absence of activity.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
