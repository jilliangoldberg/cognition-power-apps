import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { Investigation } from './Investigation';
import { syntheticEvidence } from './evidence';
import { createFixtures } from '../core/fixtures';
import { STORAGE_KEY } from '../core/storage';

describe('fourth-tool custom view', () => {
  it('keeps synthetic partial failure separate from a transaction outcome and retries only its source', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    expect(screen.getByText('No response')).toBeInTheDocument();
    expect(screen.getAllByText('Completed')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Retry Bank settlement' }));
    expect(screen.queryByText('No response')).not.toBeInTheDocument();
    expect(screen.getAllByText('Completed')).toHaveLength(3);
  });
  it('reports source disagreements without inventing an authoritative combined status', async () => {
    const user = userEvent.setup();
    render(<Investigation />);
    await user.clear(screen.getByLabelText('Transaction ID'));
    await user.type(screen.getByLabelText('Transaction ID'), 'TX-DEMO-002');
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    expect(screen.getByRole('status')).toHaveTextContent('Systems disagree');
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
});
