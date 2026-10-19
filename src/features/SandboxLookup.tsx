import { useRef, useState, type FormEvent } from 'react';
import type { SandboxResult } from '../../server/sandbox';
import { dateTime } from '../core/format';
import { api, HttpError } from './api';

export function SandboxLookup({ onUnauthorized }: { onUnauthorized?: () => void }) {
  const [id, setId] = useState('');
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [previous, setPrevious] = useState<SandboxResult | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState('');
  async function lookup(event: FormEvent) {
    event.preventDefault();
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    const retained = result?.outcome === 'found' ? result : previous;
    setPrevious(retained?.record?.id === id.trim() ? retained : null);
    setResult(null);
    try {
      const next = await api<SandboxResult>(
        `/sandbox/payment-intents/${encodeURIComponent(id.trim())}`,
      );
      setResult(next);
      if (next.outcome !== 'unavailable') setPrevious(null);
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        setPrevious(null);
        onUnauthorized?.();
      }
      setError('Lookup unavailable. No external outcome is inferred.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const shown =
    result?.outcome === 'found' ? result : previous?.record?.id === id.trim() ? previous : null;
  return (
    <section className="evidence-card" aria-label="Read-only sandbox lookup">
      <h2>Read-only sandbox lookup</h2>
      <p>
        Optional Stripe test-mode PaymentIntent snapshot. Demonstration choice, not a claim about
        the client’s provider. Credentials stay on the server. No create, refund, or other write API
        exists.
      </p>
      <form className="toolbar" onSubmit={lookup}>
        <label htmlFor="sandbox-id">Sandbox PaymentIntent ID</label>
        <input
          id="sandbox-id"
          disabled={busy}
          value={id}
          pattern="pi_[A-Za-z0-9]+"
          maxLength={103}
          required
          onChange={(e) => {
            setId(e.target.value);
            setResult(null);
            setPrevious(null);
            setError('');
          }}
        />
        <button className="button button-secondary" disabled={busy}>
          {busy ? 'Retrieving…' : 'Retrieve sandbox snapshot'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status">
          <strong>{result.outcome}</strong>
          <p>{result.message}</p>
          <p>Attempted: {dateTime(result.attemptedAt)}</p>
        </div>
      )}
      {shown?.record && (
        <dl className="detail-grid">
          <div>
            <dt>Source / freshness</dt>
            <dd>
              {shown.source} · {dateTime(shown.retrievedAt!)} ·{' '}
              {result?.outcome === 'found'
                ? 'Snapshot at retrieval, not continuously refreshed'
                : 'Stale / unverified after failed refresh'}
            </dd>
          </div>
          <div>
            <dt>Provider ID</dt>
            <dd>{shown.record.id}</dd>
          </div>
          <div>
            <dt>Original provider status</dt>
            <dd>{shown.record.originalStatus}</dd>
          </div>
          <div>
            <dt>Normalized display label</dt>
            <dd>{shown.record.normalizedStatus}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>
              {shown.record.amount} {shown.record.currency.toUpperCase()} minor units · no
              currency/FX conversion
            </dd>
          </div>
          <div>
            <dt>Provider-created time</dt>
            <dd>{dateTime(shown.record.createdAt)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
