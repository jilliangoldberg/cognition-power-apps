import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { createFixtures } from '../core/fixtures';
import { STORAGE_KEY } from '../core/storage';
import { VendorOnboarding } from './VendorOnboarding';
import { createVendorFixtures, VENDOR_STORAGE_KEY } from './vendors';

describe('vendor onboarding extension', () => {
  it('registers a discoverable page and preserves Investigation and saved original tool work', async () => {
    const user = userEvent.setup();
    const data = createFixtures();
    data.records.kyc[0].owner = 'Saved owner';
    const raw = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, raw);
    const fetcher = vi.spyOn(globalThis, 'fetch');
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Vendor approvals/ }));
    expect(
      screen.getByRole('heading', { name: 'Vendor onboarding & spend approvals' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Investigation' }));
    expect(screen.getByRole('heading', { name: 'Transaction investigation' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /KYC review/ }));
    expect(screen.getByText('Saved owner', { selector: 'span.owner' })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('submits a request, simulates required reviews, and persists a handoff marker without external writes', async () => {
    const user = userEvent.setup();
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const view = render(<VendorOnboarding />);
    await user.click(screen.getByRole('button', { name: 'New vendor request' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Vendor name'), 'Cedar Demo Studio');
    await user.type(dialog.getByLabelText('Fictional requester'), 'Taylor Demo');
    await user.selectOptions(dialog.getByLabelText('Requesting department'), 'Engineering');
    await user.type(
      dialog.getByLabelText('Business need'),
      'Create illustrations from public information only.',
    );
    await user.type(dialog.getByLabelText('Annual spend (USD)'), '2499.95');
    await user.type(dialog.getByLabelText('Budget owner'), 'Demo Engineering lead');
    await user.click(dialog.getByLabelText('Synthetic contract reviewed'));
    await user.click(dialog.getByRole('button', { name: 'Submit demo request' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const security = within(screen.getByRole('region', { name: 'Security review' }));
    expect(security.getByText('Not required')).toBeInTheDocument();
    for (const team of ['Finance', 'Legal']) {
      const stage = within(screen.getByRole('region', { name: `${team} review` }));
      await user.type(
        stage.getByLabelText(`${team} review reason`),
        'Reviewed the synthetic request.',
      );
      await user.click(stage.getByRole('button', { name: `Simulate ${team} approval` }));
    }
    const detail = within(screen.getByRole('region', { name: 'Selected vendor request' }));
    expect(
      detail.getByText(/vendor is not onboarded and no spend is authorized/),
    ).toBeInTheDocument();
    expect(detail.getByText('Demo Finance reviewer', { exact: false })).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(VENDOR_STORAGE_KEY)!).requests[0].details.annualCents,
    ).toBe(249995);
    view.unmount();
    render(<VendorOnboarding />);
    expect(screen.getByRole('heading', { name: 'Cedar Demo Studio' })).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('blocks missing prerequisites, requests changes, and resets prior decisions on resubmission', async () => {
    const user = userEvent.setup();
    render(<VendorOnboarding />);
    const security = within(screen.getByRole('region', { name: 'Security review' }));
    await user.type(
      security.getByLabelText('Security review reason'),
      'Missing the synthetic assessment.',
    );
    expect(security.getByRole('button', { name: 'Simulate Security approval' })).toBeDisabled();
    await user.click(security.getByRole('button', { name: 'Request changes from Security' }));
    expect(security.getByText('Changes requested')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit & resubmit' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByLabelText('Synthetic security assessment reviewed'));
    await user.click(dialog.getByRole('button', { name: 'Resubmit for fresh reviews' }));
    expect(screen.getByText('Resubmitted revision 2; all reviews reset')).toBeInTheDocument();
    const next = within(screen.getByRole('region', { name: 'Security review' }));
    expect(next.getByText('Pending')).toBeInTheDocument();
    await user.type(
      next.getByLabelText('Security review reason'),
      'Assessment now reviewed for the demo.',
    );
    expect(next.getByRole('button', { name: 'Simulate Security approval' })).toBeEnabled();
    expect(screen.getByText('Security: Changes requested · revision 1')).toBeInTheDocument();
  });

  it('resets approvals on edits to a ready request, even when only spend changes', async () => {
    const user = userEvent.setup();
    render(<VendorOnboarding />);
    await user.click(screen.getByRole('button', { name: 'Open Maple Demo Design' }));
    await user.click(screen.getByRole('button', { name: 'Edit & resubmit' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.clear(dialog.getByLabelText('Annual spend (USD)'));
    await user.type(dialog.getByLabelText('Annual spend (USD)'), '5000');
    await user.click(dialog.getByRole('button', { name: 'Resubmit for fresh reviews' }));
    expect(
      within(screen.getByRole('region', { name: 'Finance review' })).getByText('Pending'),
    ).toBeInTheDocument();
    expect(screen.getByText('Finance: Approved · revision 1')).toBeInTheDocument();
  });

  it('filters by department/name and status with an empty state', async () => {
    const user = userEvent.setup();
    render(<VendorOnboarding />);
    await user.selectOptions(screen.getByLabelText('Request status'), 'Changes requested');
    const list = within(screen.getByRole('region', { name: 'Vendor requests' }));
    expect(list.getByRole('button', { name: 'Open Harbor Demo Recruiting' })).toBeInTheDocument();
    expect(
      list.queryByRole('button', { name: 'Open Juniper Demo Analytics' }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Search vendors'), 'Engineering');
    expect(screen.getByText(/No matching requests/)).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Selected vendor request' }),
    ).not.toBeInTheDocument();
  });

  it('leaves corrupt saved vendor data untouched until an explicit vendor-only reset', async () => {
    const user = userEvent.setup();
    localStorage.setItem(VENDOR_STORAGE_KEY, 'unreadable saved data');
    localStorage.setItem(STORAGE_KEY, 'original data must stay unchanged');
    render(<VendorOnboarding />);
    expect(screen.getByRole('alert')).toHaveTextContent('read-only');
    expect(screen.getByRole('button', { name: 'New vendor request' })).toBeDisabled();
    expect(localStorage.getItem(VENDOR_STORAGE_KEY)).toBe('unreadable saved data');
    await user.click(screen.getByRole('button', { name: 'Reset vendor demo' }));
    await user.click(screen.getByRole('button', { name: 'Confirm vendor reset' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(VENDOR_STORAGE_KEY)!)).toEqual(createVendorFixtures());
    expect(localStorage.getItem(STORAGE_KEY)).toBe('original data must stay unchanged');
  });

  it('does not erase vendor work when resetting the original local tools', async () => {
    const user = userEvent.setup();
    const raw = JSON.stringify(createVendorFixtures());
    localStorage.setItem(VENDOR_STORAGE_KEY, raw);
    window.location.hash = '#vendors';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset demo data' }),
    );
    expect(localStorage.getItem(VENDOR_STORAGE_KEY)).toBe(raw);
    expect(
      screen.getByRole('heading', { name: 'Vendor onboarding & spend approvals' }),
    ).toBeInTheDocument();
  });

  it('warns about failed saves but preserves decisions in memory', async () => {
    const user = userEvent.setup();
    render(<VendorOnboarding />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await user.type(screen.getByLabelText('Finance review reason'), 'Synthetic budget reviewed.');
    await user.click(screen.getByRole('button', { name: 'Simulate Finance approval' }));
    expect(screen.getByRole('alert')).toHaveTextContent('in memory only');
    expect(
      within(screen.getByRole('region', { name: 'Finance review' })).getByText('Approved'),
    ).toBeInTheDocument();
    expect(localStorage.getItem(VENDOR_STORAGE_KEY)).toBeNull();
  });

  it('rejects fractional-cent spend and keeps the entered form intact', async () => {
    const user = userEvent.setup();
    render(<VendorOnboarding />);
    await user.click(screen.getByRole('button', { name: 'New vendor request' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Vendor name'), 'Demo Vendor');
    await user.type(dialog.getByLabelText('Fictional requester'), 'Demo Requester');
    await user.type(
      dialog.getByLabelText('Business need'),
      'A fictional business need for this request.',
    );
    await user.type(dialog.getByLabelText('Annual spend (USD)'), '20.001');
    await user.click(dialog.getByRole('button', { name: 'Submit demo request' }));
    expect(dialog.getByRole('alert')).toHaveTextContent('at most two decimal places');
    expect(dialog.getByLabelText('Vendor name')).toHaveValue('Demo Vendor');
  });
});
