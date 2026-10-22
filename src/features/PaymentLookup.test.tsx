import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { createFixtures } from '../core/fixtures';
import { STORAGE_KEY } from '../core/storage';
import { PaymentLookup } from './PaymentLookup';
import { looksLikeCardNumber, paymentExamples } from './payments';

const setup = () => {
  const user = userEvent.setup();
  render(<PaymentLookup />);
  return user;
};

describe('Payment lookup (jsdom)', () => {
  it('shows status, amount, merchant, timeline and the open dispute for one transaction', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Transaction ID'), 'txn-4f8k2q');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    const detail = screen.getByRole('region', { name: 'Payment TXN-4F8K2Q' });
    expect(within(detail).getByRole('heading', { level: 2 })).toHaveTextContent(
      '$184.50 USD · Northwind Outfitters',
    );
    expect(within(detail).getAllByText('Settled').length).toBeGreaterThan(0);
    expect(within(detail).getByText('Visa •••• 4242')).toBeInTheDocument();
    expect(within(detail).getByRole('note', { name: 'Open dispute' })).toHaveTextContent(
      'DP-20931 · Needs response',
    );
    const steps = within(detail).getAllByRole('listitem');
    expect(steps.map((step) => step.querySelector('strong')?.textContent)).toEqual([
      'Created',
      'Authorized',
      'Settled',
      'Refunded',
    ]);
    expect(steps[3]).toHaveTextContent('No refund');
  });

  it('lists every payment for an email and opens one from its row', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Customer email' }));
    const rows = within(screen.getByRole('region', { name: 'Matching payments' })).getAllByRole(
      'row',
    );
    expect(rows).toHaveLength(4);
    expect(screen.queryByRole('region', { name: /^Payment / })).not.toBeInTheDocument();
    await user.click(within(rows[2]).getByText('Bluebird Books'));
    const detail = screen.getByRole('region', { name: 'Payment TXN-7H3M9D' });
    expect(within(detail).getAllByRole('listitem')[3]).toHaveTextContent('$11.00 of $32.99');
    expect(within(detail).queryByRole('note')).not.toBeInTheDocument();
  });

  it('refuses card digits without an email and shows no results', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Customer email' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.type(screen.getByLabelText('Card last 4'), '4242');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Card digits need the customer’s email');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Maya/)).not.toBeInTheDocument();
  });

  it('clears a pasted full card number without echoing it anywhere', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Customer email'), 'maya.chen@example.com');
    await user.click(screen.getByLabelText('Card last 4'));
    await user.paste('4242 4242 4242 4242');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('alert')).toHaveTextContent('full card number');
    expect(screen.getByLabelText('Card last 4')).toHaveValue('');
    expect(screen.getByLabelText('Customer email')).toHaveValue('maya.chen@example.com');
    expect(document.body.textContent).not.toContain('4242 4242');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('never renders a full card number and offers no write actions', async () => {
    const user = setup();
    for (const example of paymentExamples) {
      await user.click(screen.getByRole('button', { name: example.label }));
      for (const row of screen.queryAllByRole('row').slice(1)) await user.click(row);
      expect(looksLikeCardNumber(document.body.textContent ?? '')).toBe(false);
      const allowed = ['Search', 'Clear', ...paymentExamples.map((e) => e.label)];
      const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
      expect(names.filter((name) => !allowed.includes(name) && !/^TXN-/.test(name))).toEqual([]);
    }
  });

  it('flags results as stale when the search changes, and says when nothing matches', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Refunded' }));
    expect(screen.getByText('1 payment for transaction TXN-9P4L6T')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Transaction ID'), 'X');
    expect(screen.getByText(/Results below are still for the previous search/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByText(/No payments match/)).toBeInTheDocument();
    expect(screen.queryByText(/previous search/)).not.toBeInTheDocument();
  });

  it('is reachable from the sidebar as read-only and leaves saved work untouched', async () => {
    const user = userEvent.setup();
    const raw = JSON.stringify(createFixtures());
    localStorage.setItem(STORAGE_KEY, raw);
    window.location.hash = '';
    render(<App />);
    await user.click(screen.getByRole('link', { name: 'Payment lookup' }));
    expect(window.location.hash).toBe('#payments');
    expect(screen.getByRole('heading', { name: 'Payment lookup', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open dispute' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
});
