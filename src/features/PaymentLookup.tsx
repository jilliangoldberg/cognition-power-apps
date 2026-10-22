import { useState, type FormEvent } from 'react';
import { Badge } from '../components/Badge';
import { openFromRow } from '../components/rowClick';
import { dateTime, money } from '../core/format';
import type { Tone } from '../core/types';
import {
  isOpenDispute,
  paymentExamples,
  samplePayments,
  searchPayments,
  type Payment,
  type PaymentSearch,
  type PaymentStatus,
} from './payments';
import './payment-lookup.css';

const statusTone: Record<PaymentStatus, Tone> = {
  Pending: 'amber',
  Authorized: 'blue',
  Settled: 'green',
  'Partially refunded': 'purple',
  Refunded: 'purple',
  Declined: 'red',
};

const emptySearch: PaymentSearch = { transactionId: '', email: '', last4: '' };
const cardLabel = (payment: Payment) => `${payment.card.brand} •••• ${payment.card.last4}`;

function describe(criteria: PaymentSearch) {
  return [
    criteria.transactionId && `transaction ${criteria.transactionId}`,
    criteria.email && `email ${criteria.email}`,
    criteria.last4 && `card ending ${criteria.last4}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function timeline(payment: Payment) {
  const declined = payment.status === 'Declined';
  return [
    { label: 'Created', at: payment.createdAt, pending: '' },
    {
      label: 'Authorized',
      at: payment.authorizedAt,
      pending: declined ? `Declined · ${payment.declineReason ?? 'No reason given'}` : 'Not yet',
    },
    { label: 'Settled', at: payment.settledAt, pending: declined ? 'Not applicable' : 'Not yet' },
    {
      label: 'Refunded',
      at: payment.refundedAt,
      pending: 'No refund',
      note:
        payment.refundedCents !== undefined
          ? `${money(payment.refundedCents)} of ${money(payment.amountCents)}`
          : '',
    },
  ];
}

export function PaymentLookup() {
  const [payments] = useState(() => samplePayments());
  const [form, setForm] = useState(emptySearch);
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ criteria: PaymentSearch; matches: Payment[] } | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function run(search: PaymentSearch) {
    const result = searchPayments(search, payments);
    if (!result.ok) {
      setForm({ ...search, ...Object.fromEntries(result.clear.map((key) => [key, ''])) });
      setError(result.error);
      setResults(null);
      setSelectedId(null);
      return;
    }
    setForm(search);
    setError('');
    setResults(result);
    setSelectedId(result.matches.length === 1 ? result.matches[0].id : null);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    run(form);
  }
  const field = (key: keyof PaymentSearch) => ({
    value: form[key],
    onChange: (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });
  const current = searchPayments(form, payments);
  const stale =
    results && (!current.ok || describe(current.criteria) !== describe(results.criteria));
  const selected = results?.matches.find((payment) => payment.id === selectedId);

  return (
    <section className="custom-page payment-lookup">
      <div>
        <p className="eyebrow">READ-ONLY LOOKUP</p>
        <h1>Payment lookup</h1>
        <p>
          Find a payment by transaction ID or customer email. Add the last 4 card digits to narrow
          an email search. Full card numbers are never shown.
        </p>
      </div>
      <form className="panel payment-form" onSubmit={submit} noValidate>
        <label>
          Transaction ID
          <input {...field('transactionId')} placeholder="TXN-4F8K2Q" maxLength={64} />
        </label>
        <label>
          Customer email
          <input
            {...field('email')}
            type="email"
            placeholder="name@example.com"
            maxLength={254}
            autoComplete="off"
          />
        </label>
        <label>
          Card last 4
          <input
            {...field('last4')}
            inputMode="numeric"
            placeholder="4242"
            maxLength={32}
            autoComplete="off"
            aria-describedby="payment-last4-help"
          />
        </label>
        <div className="payment-form-actions">
          <button className="button button-primary">Search</button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setForm(emptySearch);
              setError('');
              setResults(null);
              setSelectedId(null);
            }}
          >
            Clear
          </button>
        </div>
        <p id="payment-last4-help" className="payment-help">
          Card digits only work together with the customer’s email.
        </p>
      </form>
      <div className="payment-examples" aria-label="Example searches">
        {paymentExamples.map((example) => (
          <button
            key={example.label}
            type="button"
            className="button button-secondary"
            onClick={() => run(example.search)}
          >
            {example.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="payment-error" role="alert">
          {error}
        </p>
      )}
      {results && (
        <div className="payment-results" aria-live="polite">
          {stale && (
            <p className="payment-notice">
              Search changed. Results below are still for the previous search.
            </p>
          )}
          <p>
            {results.matches.length === 1 ? '1 payment' : `${results.matches.length} payments`} for{' '}
            {describe(results.criteria)}
          </p>
          {results.matches.length === 0 ? (
            <p className="panel payment-empty">
              No payments match. Check the transaction ID, or use the customer’s exact email.
            </p>
          ) : (
            results.matches.length > 1 && (
              <section className="panel" aria-label="Matching payments">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Transaction</th>
                        <th>Created</th>
                        <th>Merchant</th>
                        <th>Amount</th>
                        <th>Card</th>
                        <th>Status</th>
                        <th>Dispute</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.matches.map((payment) => (
                        <tr
                          key={payment.id}
                          className={`clickable-row ${payment.id === selectedId ? 'payment-selected' : ''}`}
                          onClick={openFromRow(() => setSelectedId(payment.id))}
                        >
                          <td>
                            <button
                              type="button"
                              className="text-button"
                              aria-pressed={payment.id === selectedId}
                              onClick={() => setSelectedId(payment.id)}
                            >
                              <strong>{payment.id}</strong>
                            </button>
                          </td>
                          <td>{dateTime(payment.createdAt)}</td>
                          <td>{payment.merchant}</td>
                          <td>{money(payment.amountCents)}</td>
                          <td>{cardLabel(payment)}</td>
                          <td>
                            <Badge label={payment.status} tone={statusTone[payment.status]} />
                          </td>
                          <td>
                            {isOpenDispute(payment.dispute) ? (
                              <Badge label="Open" tone="red" />
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          )}
          {selected && <PaymentDetail payment={selected} />}
        </div>
      )}
    </section>
  );
}

function PaymentDetail({ payment }: { payment: Payment }) {
  const dispute = payment.dispute;
  return (
    <section className="panel payment-detail" aria-label={`Payment ${payment.id}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{payment.id}</p>
          <h2>
            {money(payment.amountCents)} USD · {payment.merchant}
          </h2>
        </div>
        <Badge label={payment.status} tone={statusTone[payment.status]} />
      </div>
      {dispute && isOpenDispute(dispute) && (
        <div className="payment-dispute" role="note" aria-label="Open dispute">
          <strong>
            Open dispute {dispute.id} · {dispute.status}
          </strong>
          <p>
            {dispute.reason} · {money(dispute.amountCents)} disputed · opened{' '}
            {dateTime(dispute.openedAt)}
            {dispute.respondBy && <> · respond by {dateTime(dispute.respondBy)}</>}
          </p>
        </div>
      )}
      <dl className="detail-grid">
        <div>
          <dt>Customer</dt>
          <dd>
            {payment.customerName} · {payment.customerEmail}
          </dd>
        </div>
        <div>
          <dt>Card</dt>
          <dd>{cardLabel(payment)}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{money(payment.amountCents)} USD</dd>
        </div>
        <div>
          <dt>Merchant</dt>
          <dd>{payment.merchant}</dd>
        </div>
        <div>
          <dt>Dispute</dt>
          <dd>
            {!dispute
              ? 'None'
              : isOpenDispute(dispute)
                ? `${dispute.id} · ${dispute.status}`
                : `${dispute.id} · Closed, ${dispute.status.toLowerCase()} · ${dispute.reason}`}
          </dd>
        </div>
      </dl>
      <h3>Timeline</h3>
      <ol className="payment-timeline">
        {timeline(payment).map((step) => (
          <li key={step.label} className={step.at ? 'payment-step-done' : undefined}>
            <strong>{step.label}</strong>
            <span>
              {step.at ? <time dateTime={step.at}>{dateTime(step.at)}</time> : step.pending}
              {step.at && step.note ? ` · ${step.note}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
