import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Investigation } from './Investigation';

describe('Investigation read-only extension (jsdom, not browser E2E)', () => {
  it.each([
    ['001', 'Clean reports', 'Evidence retrieved'],
    ['002', 'Conflicting reports', 'Evidence retrieved'],
    ['003', 'Unavailable source', 'Unavailable · outcome unknown'],
    ['004', 'Stale evidence', 'Stale evidence'],
    ['005', 'No matching records', 'No matching records'],
    ['006', 'Incomplete response', 'Incomplete · more records may exist'],
  ])('makes fixture %s (%s) reachable without editing an ID', async (suffix, label, expected) => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.click(screen.getByRole('button', { name: `TX-DEMO-${suffix} · ${label}` }));
    expect(
      screen.getByRole('heading', { name: `Evidence for TX-DEMO-${suffix}` }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(expected, { exact: false }).length).toBeGreaterThan(0);
    if (suffix === '002') expect(screen.getByRole('status')).toHaveTextContent('Reports disagree');
    if (suffix === '005') {
      expect(screen.queryByText('Illustrative amount')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Simulate retry/ })).not.toBeInTheDocument();
    }
  });

  it('filters only timeline events, leaving missing-source context and retry visible', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    const internal = screen.getByRole('article', { name: 'Internal records' }).innerHTML;
    const processing = screen.getByRole('article', { name: 'Processing events' }).innerHTML;
    await user.selectOptions(screen.getByLabelText('Timeline source'), '2');
    expect(screen.getByText(/No events available for the selected source/)).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Simulate retry Reconciliation reports' }));
    expect(screen.getByRole('article', { name: 'Internal records' }).innerHTML).toBe(internal);
    expect(screen.getByRole('article', { name: 'Processing events' }).innerHTML).toBe(processing);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText(/Simulated retry completed for this source only/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Simulate retry/ })).not.toBeInTheDocument();
  });

  it('keeps event and retrieval provenance separate, with stale and incomplete labels', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.click(screen.getByRole('button', { name: 'TX-DEMO-004 · Stale evidence' }));
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(
      within(rows[2]).getByText(/Source: Reconciliation reports · Reference:/),
    ).toBeInTheDocument();
    expect(within(rows[2]).getByText(/Retrieved:/)).toBeInTheDocument();
    expect(within(rows[2]).getByText('This evidence is stale.')).toBeInTheDocument();
    expect(
      screen.getByText(/Ordered by source-reported event time, not proven causality/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'TX-DEMO-006 · Incomplete response' }));
    expect(within(screen.getByRole('list')).getByText(/Incomplete response/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simulate retry Processing events' }));
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
  });

  it('normalizes search and never shows old results as the edited query', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.clear(screen.getByLabelText('Synthetic transaction ID'));
    await user.type(screen.getByLabelText('Synthetic transaction ID'), ' tx-demo-001 ');
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    expect(screen.getByRole('heading', { name: 'Evidence for TX-DEMO-001' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Synthetic transaction ID'));
    await user.type(screen.getByLabelText('Synthetic transaction ID'), 'unknown');
    expect(
      screen.getByText(/Input changed. Results below are still for TX-DEMO-001/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    expect(screen.getByRole('heading', { name: 'Evidence for UNKNOWN' })).toBeInTheDocument();
    expect(screen.queryByText(/Input changed/)).not.toBeInTheDocument();
    expect(screen.getAllByText('No matching records', { selector: 'strong' })).toHaveLength(3);
  });

  it('resets source filtering and retries when a different fixture is selected', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    await user.selectOptions(screen.getByLabelText('Timeline source'), '0');
    await user.click(screen.getByRole('button', { name: 'Simulate retry Reconciliation reports' }));
    await user.click(screen.getByRole('button', { name: 'TX-DEMO-002 · Conflicting reports' }));
    expect(screen.getByLabelText('Timeline source')).toHaveValue('all');
    expect(screen.queryByText(/Simulated retry completed/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'No authoritative combined status is inferred',
    );
    expect(screen.queryByRole('button', { name: /Simulate retry/ })).not.toBeInTheDocument();
  });

  it('uses no network or persisted writes during synthetic investigation and retry', async () => {
    const user = userEvent.setup();
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const removals = vi.spyOn(Storage.prototype, 'removeItem');
    render(<Investigation />);
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    await user.click(screen.getByRole('button', { name: 'Simulate retry Reconciliation reports' }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
    expect(removals).not.toHaveBeenCalled();
  });
});
