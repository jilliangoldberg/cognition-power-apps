import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { Investigation } from './Investigation';
import { syntheticEvidence } from './evidence';
import { SandboxLookup } from './SandboxLookup';
import { createFixtures } from '../core/fixtures';
import { STORAGE_KEY } from '../core/storage';

describe('fourth-tool custom view', () => {
  it('keeps synthetic partial failure separate from a transaction outcome and retries only its source', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    expect(screen.getByText('Unavailable · outcome unknown')).toBeInTheDocument();
    expect(screen.getAllByText('Evidence retrieved')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Simulate retry Reconciliation reports' }));
    expect(screen.queryByText('Unavailable · outcome unknown')).not.toBeInTheDocument();
    expect(screen.getAllByText('Evidence retrieved')).toHaveLength(3);
  });
  it('reports source disagreements without inventing an authoritative combined status', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.clear(screen.getByLabelText('Synthetic transaction ID'));
    await user.type(screen.getByLabelText('Synthetic transaction ID'), 'TX-DEMO-002');
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    expect(screen.getByRole('status')).toHaveTextContent('Reports disagree');
  });
  it('distinguishes no-match, unavailable, stale, and incomplete evidence at a fixed clock', () => {
    const clock = new Date('2026-10-19T06:00:00Z');
    expect(syntheticEvidence('TX-DEMO-003', clock)[2].outcome).toBe('unavailable');
    expect(syntheticEvidence('TX-DEMO-004', clock)[2]).toMatchObject({
      stale: true,
      retrievedAt: '2026-10-19T04:30:00.000Z',
      attemptedAt: clock.toISOString(),
    });
    expect(syntheticEvidence('TX-DEMO-005', clock).every((s) => s.outcome === 'not-found')).toBe(
      true,
    );
    expect(syntheticEvidence('TX-DEMO-006', clock)[1].complete).toBe(false);
  });
  it('adds custom navigation without replacing or invalidating existing v2 saved work', async () => {
    const user = userEvent.setup();
    const data = createFixtures();
    data.records.kyc[0].owner = 'Saved local owner';
    const raw = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, raw);
    render(<App />);
    await user.click(screen.getByRole('link', { name: 'Investigation' }));
    expect(screen.getByRole('heading', { name: 'Transaction investigation' })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    await user.click(screen.getByRole('link', { name: /KYC review/ }));
    expect(screen.getByText('Saved local owner', { selector: 'span.owner' })).toBeInTheDocument();
  });
  it('keeps the original tools usable when the shared API is unavailable', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    window.location.hash = '#shared-kyc';
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Shared API unavailable');
    await user.click(screen.getByRole('link', { name: /Refunds/ }));
    expect(screen.getByRole('heading', { name: 'Refunds dashboard' })).toBeInTheDocument();
  });
});

describe('sandbox snapshots (mock transport)', () => {
  it('retains a prior snapshot as stale after a failed refresh, not as current evidence', async () => {
    const user = userEvent.setup();
    const fetcher = vi.spyOn(globalThis, 'fetch');
    fetcher.mockResolvedValueOnce(
      Response.json({
        source: 'Stripe test mode',
        outcome: 'found',
        attemptedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        message: 'Single snapshot',
        record: {
          id: 'pi_example',
          originalStatus: 'processing',
          normalizedStatus: 'Reported in progress',
          amount: 1000,
          currency: 'usd',
          createdAt: new Date().toISOString(),
        },
      }),
    );
    render(<SandboxLookup />);
    await user.type(screen.getByLabelText('Sandbox PaymentIntent ID'), 'pi_example');
    await user.click(screen.getByRole('button', { name: 'Retrieve sandbox snapshot' }));
    expect(await screen.findByText('processing')).toBeInTheDocument();
    fetcher.mockResolvedValueOnce(
      Response.json({
        source: 'Stripe test mode',
        outcome: 'unavailable',
        attemptedAt: new Date().toISOString(),
        message: 'Provider unavailable',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Retrieve sandbox snapshot' }));
    expect(await screen.findByText(/Stale \/ unverified after failed refresh/)).toBeInTheDocument();
    expect(screen.getByText('processing')).toBeInTheDocument();
  });
});
