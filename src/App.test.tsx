import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY } from './core/storage';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});

describe('workspace components (jsdom)', () => {
  it('skips to the current page content without changing the active tool', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    render(<App />);
    await user.click(screen.getByRole('link', { name: 'Skip to content' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#kyc');
    expect(screen.getByRole('heading', { name: 'KYC review queue', level: 1 })).toBeInTheDocument();
  });
  it('renders all tools through the shared navigation and handles unknown URLs', async () => {
    const user = userEvent.setup();
    window.location.hash = '#missing';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'A little less busywork.' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Workspace' });
    for (const [label, title] of [
      ['KYC review', 'KYC review queue'],
      ['Refunds', 'Refunds dashboard'],
      ['Feature flags', 'Feature flags'],
    ]) {
      await user.click(within(nav).getByRole('link', { name: new RegExp(label) }));
      expect(screen.getByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
    }
  });
  it('searches and filters a queue and clears an empty state', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    render(<App />);
    await user.type(screen.getByRole('searchbox'), 'Olivia');
    expect(screen.getByRole('button', { name: 'Open Olivia Chen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open James Wilson' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'Approved');
    expect(screen.getByText('No matching cases')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('button', { name: 'Open James Wilson' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Sort records'), 'name');
    expect(
      within(screen.getAllByRole('row')[1]).getByRole('button', { name: 'Open Amelia Brown' }),
    ).toBeInTheDocument();
  });
  it('requires a reason, applies a KYC decision, and persists across remounts', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    const view = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Approve case' }));
    const confirm = within(dialog).getByRole('button', { name: 'Confirm approve case' });
    expect(confirm).toBeDisabled();
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Synthetic evidence checked.',
    );
    await user.click(confirm);
    expect(within(dialog).getByText('Approved', { selector: '.badge' })).toBeInTheDocument();
    expect(within(dialog).getByText('Synthetic evidence checked.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).activity).toHaveLength(1);
    view.unmount();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    expect(
      within(screen.getByRole('dialog')).getByText('Approved', { selector: '.badge' }),
    ).toBeInTheDocument();
  });
  it('supports refund simulation and flag changes through the same components', async () => {
    const user = userEvent.setup();
    window.location.hash = '#refunds';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/No payment provider is connected/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Simulate refund' }));
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Try the simulated refund flow.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm simulate refund' }));
    expect(within(dialog).getByText('Simulated', { selector: '.badge' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    await user.click(
      within(screen.getByRole('navigation')).getByRole('link', { name: /Feature flags/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Open Instant payout preview' }));
    dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Enable flag' }));
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Enable the local staging preview.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm enable flag' }));
    expect(within(dialog).getByText('Enabled', { selector: '.badge' })).toBeInTheDocument();
  });
  it('resets only after confirmation and preserves unrelated browser storage', async () => {
    const user = userEvent.setup();
    localStorage.setItem('unrelated-app', 'leave alone');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    let dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Keep exploring' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reset demo data' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).activity).toEqual([]);
    expect(localStorage.getItem('unrelated-app')).toBe('leave alone');
  });
  it('preserves malformed storage until explicitly reset', async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, 'bad json');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('without overwriting');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('bad json');
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Reset demo' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset demo data' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).schemaVersion).toBe(1);
  });
  it('shows an honest warning when persistence is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Changes will last only until this page is reloaded',
    );
  });
  it('supports the search keyboard shortcut without intercepting text input', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    render(<App />);
    fireEvent.keyDown(document.body, { key: '/' });
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await user.type(screen.getByRole('searchbox'), '/');
    expect(screen.getByRole('searchbox')).toHaveValue('/');
  });
});
