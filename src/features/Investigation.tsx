import { useState, type FormEvent } from 'react';
import { dateTime, money } from '../core/format';
import {
  canRetrySyntheticSource,
  investigationExamples,
  retrySyntheticSource,
  syntheticEvidence,
  type SourceEvidence,
} from './evidence';
import './investigation.css';

export function Investigation() {
  const [query, setQuery] = useState('TX-DEMO-003');
  const [sources, setSources] = useState<SourceEvidence[]>([]);
  const [searched, setSearched] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  function investigate(id: string) {
    setQuery(id);
    setSearched(id);
    setSources(syntheticEvidence(id));
    setSourceFilter('all');
  }
  function search(event: FormEvent) {
    event.preventDefault();
    const id = query.trim().toUpperCase();
    if (id) investigate(id);
  }
  const statuses = new Set(sources.map((s) => s.reportedStatus).filter(Boolean));
  const events = sources
    .filter((source) => sourceFilter === 'all' || source.id === sourceFilter)
    .flatMap((source) => source.events.map((event) => ({ ...event, source })))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const contextSource = sources.find((source) => source.amountCents !== undefined);
  return (
    <section className="custom-page investigation">
      <p className="eyebrow">READ-ONLY EXTENSION · SYNTHETIC ONLY</p>
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
      <div className="investigation-examples" aria-label="Synthetic investigation examples">
        {investigationExamples.map((example) => (
          <button
            key={example.id}
            type="button"
            className="button button-secondary"
            onClick={() => investigate(example.id)}
          >
            {example.id} · {example.label}
          </button>
        ))}
      </div>
      {searched && query.trim().toUpperCase() !== searched && (
        <p className="investigation-notice">
          Input changed. Results below are still for {searched}; investigate to replace them.
        </p>
      )}
      {searched && (
        <div aria-live="polite">
          <h2>Evidence for {searched}</h2>
          {contextSource && contextSource.amountCents !== undefined && (
            <dl className="detail-grid">
              <div>
                <dt>Illustrative amount</dt>
                <dd>
                  {money(contextSource.amountCents)} USD · reported by {contextSource.label};
                  curated synthetic example, not a benchmark
                </dd>
              </div>
              <div>
                <dt>Current reported status</dt>
                <dd>See each source below; no single authoritative status is inferred.</dd>
              </div>
            </dl>
          )}
          <p role="status" className="investigation-notice">
            {statuses.size > 1
              ? 'Reports disagree. No authoritative combined status is inferred.'
              : 'Source reports are evidence, not a verified transaction outcome.'}
          </p>
          <p>
            {sources.filter((source) => source.outcome === 'found').length}/{sources.length} sources
            returned evidence. A complete response covers only this fictional lookup, not a complete
            transaction history. Related references are context, not linked browser-local refund
            decisions or authenticated records.
          </p>
          <div className="evidence-grid">
            {sources.map((source) => (
              <article className="evidence-card" key={source.id} aria-label={source.label}>
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
                <p>
                  Source-reported status: {source.reportedStatus ?? 'No status assertion available'}
                </p>
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
                {source.relatedReferences.length > 0 && (
                  <details>
                    <summary>Related reference context</summary>
                    <dl className="investigation-references">
                      {source.relatedReferences.map((related) => (
                        <div key={`${related.kind}/${related.reference}`}>
                          <dt>{related.kind}</dt>
                          <dd>{related.reference}</dd>
                        </div>
                      ))}
                    </dl>
                    <p>
                      Provenance: {source.label} · retrieved {dateTime(source.retrievedAt)}.
                    </p>
                  </details>
                )}
                {canRetrySyntheticSource(source) && (
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
                {source.retryCount > 0 && (
                  <p className="investigation-notice">
                    Simulated retry completed for this source only. No external request was made;
                    reported event times were not replaced by the retry time.
                  </p>
                )}
              </article>
            ))}
          </div>
          <h2>Reported event timeline</h2>
          <p>
            Ordered by source-reported event time, not proven causality. Retrieval time is shown
            separately above. Retries here are simulated reads, not connectivity tests.
          </p>
          <label className="investigation-filter">
            Timeline source
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <p>{events.length} reported events shown. Source cards above always show all sources.</p>
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
                      Retrieved: {dateTime(event.source.retrievedAt)} ·{' '}
                      {event.source.complete
                        ? 'Complete synthetic response'
                        : 'Incomplete response'}
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
              No events available{sourceFilter === 'all' ? '' : ' for the selected source'}. Check
              each source’s availability before interpreting this as an absence of activity.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
