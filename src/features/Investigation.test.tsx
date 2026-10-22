import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Investigation } from './Investigation';

const row = (name: string) => screen.getByRole('row', { name });
const timeline = () => within(screen.getByRole('list')).queryAllByRole('listitem');

describe('Investigation read-only extension (jsdom, not browser E2E)', () => {
  it.each([
    ['001', 'All systems agree', 'All 3 systems agree: Completed'],
    ['002', 'Systems disagree', 'Systems disagree'],
    ['003', 'A system is down', 'Bank settlement didn’t respond'],
    ['004', 'Out-of-date data', 'Bank settlement data is out of date'],
    ['005', 'Not found anywhere', 'No system has a record of this transaction'],
    ['006', 'Partial data', 'Payment processor returned partial data'],
  ])(
    'makes fixture %s (%s) reachable in one click with a plain verdict',
    async (suffix, label, verdict) => {
      const user = userEvent.setup();
      render(<Investigation />);
      await user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('heading', { name: `TX-DEMO-${suffix}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('status')).toHaveTextContent(verdict);
      expect(screen.getAllByRole('row')).toHaveLength(4);
      if (suffix === '005') {
        expect(screen.queryByText('Amount')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Retry/ })).not.toBeInTheDocument();
        expect(screen.getAllByText('Not found')).toHaveLength(3);
      }
    },
  );

  it('shows the default example on load and never infers a combined status on disagreement', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    expect(screen.getByRole('heading', { name: 'TX-DEMO-003' })).toBeInTheDocument();
    expect(within(row('Bank settlement')).getByText('No response')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Systems disagree' }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Bank settlement says Pending review');
    expect(status).not.toHaveTextContent('agree:');
    expect(screen.queryByRole('button', { name: /^Retry/ })).not.toBeInTheDocument();
  });

  it('retries only the selected source and leaves the other rows untouched', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    const ledger = row('Ledger').innerHTML;
    const processor = row('Payment processor').innerHTML;
    expect(timeline()).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Retry Bank settlement' }));
    expect(row('Ledger').innerHTML).toBe(ledger);
    expect(row('Payment processor').innerHTML).toBe(processor);
    expect(within(row('Bank settlement')).getByText('Completed')).toBeInTheDocument();
    expect(
      within(row('Bank settlement')).getByText(/Refreshed just now \(simulated, no real request\)/),
    ).toBeInTheDocument();
    expect(timeline()).toHaveLength(3);
    expect(screen.getByRole('status')).toHaveTextContent('All 3 systems agree: Completed');
    expect(screen.queryByRole('button', { name: /^Retry/ })).not.toBeInTheDocument();
  });

  it('labels stale and partial sources, and retry recovers the missing detail', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.click(screen.getByRole('button', { name: 'Out-of-date data' }));
    expect(
      within(row('Bank settlement')).getByText('Out of date: last updated 90 min ago'),
    ).toBeInTheDocument();
    expect(timeline()).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Partial data' }));
    expect(
      within(row('Payment processor')).getByText('Partial response: some details missing'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry Payment processor' }));
    expect(timeline()).toHaveLength(4);
    expect(screen.getByText(/Processor fee and payout details received/)).toBeInTheDocument();
  });

  it('normalizes search and never shows old results as the edited query', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.clear(screen.getByLabelText('Transaction ID'));
    await user.type(screen.getByLabelText('Transaction ID'), ' tx-demo-001 ');
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    expect(screen.getByRole('heading', { name: 'TX-DEMO-001' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Transaction ID'));
    await user.type(screen.getByLabelText('Transaction ID'), 'unknown');
    expect(
      screen.getByText(/Input changed. Results below are still for TX-DEMO-001/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    expect(screen.getByRole('heading', { name: 'UNKNOWN' })).toBeInTheDocument();
    expect(screen.queryByText(/Input changed/)).not.toBeInTheDocument();
    expect(screen.getAllByText('No record for this ID')).toHaveLength(3);
    expect(screen.getByText('No events found for this ID.')).toBeInTheDocument();
  });

  it('does not treat an unresponsive system as proof of no activity', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.click(screen.getByRole('button', { name: 'Retry Bank settlement' }));
    await user.click(screen.getByRole('button', { name: 'A system is down' }));
    expect(within(row('Bank settlement')).getByText('No response')).toBeInTheDocument();
    expect(screen.queryByText(/Refreshed just now/)).not.toBeInTheDocument();
  });

  it('uses no network or persisted writes during synthetic investigation and retry', async () => {
    const user = userEvent.setup();
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const removals = vi.spyOn(Storage.prototype, 'removeItem');
    render(<Investigation />);
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    await user.click(screen.getByRole('button', { name: 'Retry Bank settlement' }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
    expect(removals).not.toHaveBeenCalled();
  });
});
